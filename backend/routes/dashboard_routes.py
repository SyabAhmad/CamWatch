from flask import Blueprint, jsonify, request, current_app
from db_utils import get_db_connection
from auth_utils import token_required
import psycopg2
import psycopg2.extras
import requests
import os
from dotenv import load_dotenv
import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime
import threading
import time
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

dashboard_bp = Blueprint('dashboard_bp', __name__)

LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080/v1/chat/completions")

# Global thread pool for parallel processing
thread_pool = ThreadPoolExecutor(max_workers=4)

# Global model cache
yolo_model = None
model_lock = threading.Lock()

def get_optimized_yolo_model():
    """Get cached, optimized YOLO model"""
    global yolo_model
    if yolo_model is None:
        with model_lock:
            if yolo_model is None:
                current_app.logger.info("🚀 Loading optimized YOLO model...")
                # yolo_model = YOLO('yolov8n.pt')  # Use nano for speed
                yolo_model = YOLO(r'H:\Code\Final Year Projectsss\CamWatch\code\runs\detect\train3\weights\best.pt')  # Use nano for speed
                
                # Optimize for real-time
                yolo_model.overrides['verbose'] = False
                yolo_model.overrides['save'] = False
                yolo_model.overrides['show'] = False
                
                # Warm up with dummy image
                dummy_img = np.zeros((320, 320, 3), dtype=np.uint8)
                yolo_model(dummy_img, conf=0.3, iou=0.45, verbose=False)
                
                current_app.logger.info("⚡ YOLO model optimized for real-time!")
    return yolo_model

# Load fine-tuned YOLOv8m model for weapons detection
# yolo_model = YOLO('yolov8m.pt')  # Replace with your fine-tuned model path
# # yolo_model = YOLO(r'H:\Code\Final Year Projectsss\CamWatch\code\runs\detect\train3\weights\best.pt')  # Use nano for speed
# # Weapon classes (aligned with fine-tuned model)
# WEAPON_CLASSES = [
#     'knife', 'scissors', 'bottle',
#     'gun', 'rifle', 'pistol',
#     'baseball bat', 'hammer',
#     'axe', 'sword'
# ]
WEAPON_CLASSES = [
    'automatic rifle', 'granade launcher', 'knife', 'machine gun', 'pistol', 'rocket launcher', 'shotgun', 'sniper', 'sword'
]
# Suspicious objects
SUSPICIOUS_CLASSES = [
    'backpack', 'handbag', 'suitcase'
]

@dashboard_bp.route('/cameras', methods=['GET'])
@token_required
def get_dashboard_cameras(current_user):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT id, name, location, ip_address, rtsp_url, is_active FROM cameras ORDER BY id ASC")
            cameras = cur.fetchall()
            cameras_list = [dict(cam_record) for cam_record in cameras]
            return jsonify({"success": True, "data": cameras_list}), 200
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error fetching cameras: {db_error}")
        return jsonify({"success": False, "message": "Database error fetching cameras."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error fetching cameras: {e}")
        return jsonify({"success": False, "message": "An unexpected error occurred."}), 500
    finally:
        if conn:
            conn.close()

@dashboard_bp.route('/cameras/<int:camera_id>/status', methods=['PUT'])
@token_required
def toggle_camera_status(current_user, camera_id):
    data = request.get_json()
    is_active = data.get('is_active')

    if is_active is None or not isinstance(is_active, bool):
        return jsonify({"success": False, "message": "Invalid 'is_active' status provided."}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "UPDATE cameras SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING id, name, is_active",
                (is_active, camera_id)
            )
            updated_camera = cur.fetchone()
            if not updated_camera:
                conn.rollback()
                return jsonify({"success": False, "message": "Camera not found."}), 404
            conn.commit()
            return jsonify({"success": True, "message": "Camera status updated.", "data": dict(updated_camera)}), 200
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error updating camera: {db_error}")
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": "Database error updating camera."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error updating camera: {e}")
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": "An unexpected error occurred."}), 500
    finally:
        if conn:
            conn.close()

@dashboard_bp.route('/recent-detections', methods=['GET'])
@token_required
def get_dashboard_recent_detections(current_user):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Fixed query - removed dl.bbox since it doesn't exist
            cur.execute("""
                SELECT 
                    dl.id,
                    dl.camera_id,
                    dl.detection_type,
                    dl.confidence,
                    dl.detected_at,
                    dl.image_path,
                    COALESCE(c.name, 'Local Webcam') as camera_name
                FROM detection_logs dl
                LEFT JOIN cameras c ON dl.camera_id = c.id
                ORDER BY dl.detected_at DESC
                LIMIT 50
            """)
            detections = cur.fetchall()
            detections_list = []
            for det_record in detections:
                det_dict = dict(det_record)
                if 'detected_at' in det_dict and hasattr(det_dict['detected_at'], 'isoformat'):
                    det_dict['detected_at'] = det_dict['detected_at'].isoformat()
                det_dict['details'] = f"{det_dict.get('detection_type', 'Unknown')} detection with {det_dict.get('confidence', 0):.2%} confidence"
                detections_list.append(det_dict)
            current_app.logger.info(f"Fetched {len(detections_list)} detections")
            return jsonify({"success": True, "data": detections_list}), 200
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error fetching detections: {db_error}")
        return jsonify({"success": False, "message": "Database error fetching detections."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error fetching detections: {e}")
        return jsonify({"success": False, "message": "An unexpected error occurred."}), 500
    finally:
        if conn:
            conn.close()

@dashboard_bp.route('/analyze-frame', methods=['POST'])
@token_required
def analyze_frame_route(current_user):
    current_app.logger.info("Received /analyze-frame request")
    data = request.get_json()
    
    if not data or 'image_b64' not in data:
        current_app.logger.warning("No valid JSON or image data")
        return jsonify({"success": False, "message": "No image data provided."}), 400

    image_b64 = data.get('image_b64')
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Name objects in image (e.g., bottle, rifle, knife). Max 4 words."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
                ]
            }
        ]
    }

    try:
        response = requests.post(LLAMA_SERVER_URL, json=payload, timeout=60)
        if response.ok:
            result = response.json()
            description = result.get('choices', [{}])[0].get('message', {}).get('content', 'No description.')
            current_app.logger.info(f"SmolVLM description: {description}")
            return jsonify({"success": True, "description": description}), 200
        else:
            current_app.logger.error(f"SmolVLM error: {response.text}")
            return jsonify({"success": False, "message": "SmolVLM server error."}), 502
    except Exception as e:
        current_app.logger.error(f"Error contacting SmolVLM: {e}")
        return jsonify({"success": False, "message": f"SmolVLM error: {e}"}), 500

def analyze_detections_realtime(results, image_data, image_b64, is_realtime):
    """Ultra-fast detection analysis using YOUR CUSTOM TRAINED MODEL"""
    detected_objects = []
    weapon_detected = False
    weapon_types = []
    highest_weapon_confidence = 0.0
    
    # ✅ YOUR ACTUAL TRAINED WEAPON CLASSES (from data.yaml)
    YOUR_WEAPON_CLASSES = {
        0: 'automatic rifle',
        1: 'granade launcher', 
        2: 'knife',
        3: 'machine gun',
        4: 'pistol',
        5: 'rocket launcher',
        6: 'shotgun',
        7: 'sniper',
        8: 'sword'
    }
    
    current_app.logger.info("🎯 ANALYZING WITH YOUR CUSTOM WEAPON MODEL...")
    
    # Process YOLO results from YOUR trained model
    for result in results:
        boxes = result.boxes
        if boxes is not None:
            current_app.logger.info(f"📦 Found {len(boxes)} detections")
            
            for box in boxes:
                class_id = int(box.cls)
                confidence = float(box.conf)
                
                # ✅ CHECK YOUR CUSTOM WEAPON CLASSES FIRST
                if class_id in YOUR_WEAPON_CLASSES:
                    weapon_name = YOUR_WEAPON_CLASSES[class_id]
                    is_custom_weapon = True
                    current_app.logger.warning(f"🚨 CUSTOM WEAPON FOUND: {weapon_name} (ID:{class_id}, conf:{confidence:.3f})")
                else:
                    # Fallback to standard YOLO classes
                    weapon_name = results[0].names[class_id].lower() if class_id in results[0].names else f"object_{class_id}"
                    is_custom_weapon = False
                    current_app.logger.info(f"📝 Standard object: {weapon_name} (ID:{class_id}, conf:{confidence:.3f})")
                
                detected_objects.append({
                    'object': weapon_name,
                    'confidence': round(confidence, 3),
                    'class_id': class_id,
                    'is_custom_weapon': is_custom_weapon
                })
                
                # ✅ IMMEDIATE WEAPON DETECTION - VERY LOW THRESHOLD
                if is_custom_weapon and confidence > 0.15:  # Very low threshold for trained model
                    weapon_detected = True
                    weapon_types.append(weapon_name)
                    highest_weapon_confidence = max(highest_weapon_confidence, confidence)
                    current_app.logger.error(f"🚨🚨🚨 WEAPON ALERT: {weapon_name} detected with {confidence:.3f} confidence!")
    
    # ✅ IMMEDIATE RESPONSE
    if weapon_detected:
        description = f"🚨 WEAPON DETECTED: {', '.join(weapon_types)} ({highest_weapon_confidence:.2%} confidence)"
        
        # Save immediately in background (don't block)
        def immediate_save():
            try:
                save_weapon_detection_fast(image_data, weapon_types, highest_weapon_confidence)
                current_app.logger.info(f"✅ Weapon saved: {weapon_types}")
            except Exception as e:
                current_app.logger.error(f"Save error: {e}")
        
        thread_pool.submit(immediate_save)
        
        return {
            "success": True,
            "description": description,
            "weapon_detected": True,
            "detected_objects": detected_objects,
            "weapon_types": weapon_types,
            "confidence": highest_weapon_confidence,
            "processing_time": "ultra_fast",
            "ai_description": f"TRAINED MODEL DETECTED: {', '.join(weapon_types)}",
            "smol_used": False,
            "suspicious_detected": False,
            "alert_level": "CRITICAL"
        }
    else:
        # ✅ MINIMAL RESPONSE FOR SAFE FRAMES
        current_app.logger.info(f"✅ Safe scan: {len(detected_objects)} objects, no weapons")
        return {
            "success": True,
            "description": f"✅ Safe - {len(detected_objects)} objects monitored",
            "weapon_detected": False,
            "detected_objects": [],  # Don't send objects for safe frames
            "weapon_types": [],
            "confidence": 0,
            "processing_time": "ultra_fast",
            "ai_description": "",
            "smol_used": False
        }

def save_weapon_detection(image_data, weapon_types, confidence, description):
    """Fast database save for real-time detections"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Save image in background
            images_dir = os.path.join(os.path.dirname(__file__), '..', 'detection_images')
            os.makedirs(images_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Include milliseconds
            image_filename = f"realtime_weapon_{timestamp}.jpg"
            image_path = os.path.join(images_dir, image_filename)
            
            with open(image_path, 'wb') as f:
                f.write(image_data)
            
            # Fast database insert
            cur.execute("""
                INSERT INTO detection_logs 
                (camera_id, detection_type, confidence, detected_at, image_path)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                1, 'weapon', confidence, datetime.now(), image_filename
            ))
            
            conn.commit()
            current_app.logger.info(f"⚡ Real-time detection saved: {weapon_types}")
            
    except Exception as e:
        current_app.logger.error(f"❌ Fast save failed: {e}")
    finally:
        if conn:
            conn.close()

@dashboard_bp.route('/analyze-frame-smart', methods=['POST'])
@token_required
def analyze_frame_smart(current_user):
    """SILENT ultra-fast analysis - NO LOGGING"""
    data = request.get_json()
    image_b64 = data.get('image_b64')
    silent_mode = data.get('silent', False)
    
    if not image_b64:
        return jsonify({"success": False}), 400
    
    try:
        # ✅ SILENT decode
        import base64
        image_data = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # ✅ FAST resize
        image = cv2.resize(image, (320, 320))
        
        # ✅ SILENT YOLO
        model = get_optimized_yolo_model()
        results = model(image, conf=0.15, verbose=False, save=False)
        
        # ✅ SILENT analysis
        return analyze_detections_silent(results, image_data, image_b64)
        
    except Exception as e:
        if not silent_mode:
            current_app.logger.error(f"Analysis error: {e}")
        return jsonify({"success": False}), 500

def analyze_detections_silent(results, image_data, image_b64):
    """SILENT detection analysis - NO LOGGING"""
    weapon_detected = False
    weapon_types = []
    confidence = 0
    detected_objects = []
    
    WEAPON_CLASSES = {
        0: 'automatic rifle', 1: 'granade launcher', 2: 'knife',
        3: 'machine gun', 4: 'pistol', 5: 'rocket launcher',
        6: 'shotgun', 7: 'sniper', 8: 'sword'
    }
    
    # ✅ FAST processing
    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls)
                conf = float(box.conf)
                
                if class_id in WEAPON_CLASSES and conf > 0.15:
                    weapon_detected = True
                    weapon_name = WEAPON_CLASSES[class_id]
                    weapon_types.append(weapon_name)
                    confidence = max(confidence, conf)
                    
                    detected_objects.append({
                        'object': weapon_name,
                        'confidence': conf,
                        'class_id': class_id
                    })
                    
                    # ✅ SILENT background save
                    thread_pool.submit(save_detection_silent, image_data, weapon_name, conf)
    
    # ✅ MINIMAL response
    if weapon_detected:
        return jsonify({
            "success": True,
            "weapon_detected": True,
            "weapon_types": weapon_types,
            "confidence": confidence,
            "description": f"🚨 {', '.join(weapon_types)} detected",
            "detected_objects": detected_objects
        }), 200
    else:
        return jsonify({
            "success": True,
            "weapon_detected": False,
            "description": "✅ Safe"
        }), 200

def save_detection_silent(image_data, weapon_name, confidence):
    """SILENT save - NO LOGGING"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO detection_logs 
                (camera_id, detection_type, confidence, detected_at)
                VALUES (%s, %s, %s, %s)
            """, (1, 'weapon', confidence, datetime.now()))
            conn.commit()
    except:
        pass  # Silent failure
    finally:
        if conn:
            conn.close()