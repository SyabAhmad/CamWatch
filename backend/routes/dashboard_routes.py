from flask import Blueprint, jsonify, request, current_app
from db_utils import get_db_connection
from auth_utils import token_required # Assuming staff also need to be authenticated
import psycopg2
import psycopg2.extras
import requests
import os
from dotenv import load_dotenv
import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime

load_dotenv() 

dashboard_bp = Blueprint('dashboard_bp', __name__)

LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080/v1/chat/completions")

# Load YOLO model (add this at the top)
# yolo_model = YOLO('yolov8n.pt')  # or yolov8s.pt for better accuracy
yolo_model = YOLO('yolov8s.pt')  # or yolov8s.pt for better accuracy

# Improved weapon classes with more comprehensive detection
WEAPON_CLASSES = [
    'knife', 'scissors', 'bottle',  # Common objects that can be weapons
    'gun', 'rifle', 'pistol',      # Firearms (rarely detected by COCO)
    'baseball bat', 'hammer',       # Blunt weapons
    'axe', 'sword'                  # Other sharp weapons
]

# Additional suspicious objects
SUSPICIOUS_CLASSES = [
    'backpack', 'handbag', 'suitcase'  # Could contain weapons
]

@dashboard_bp.route('/cameras', methods=['GET'])
@token_required
def get_dashboard_cameras(current_user):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Fetch all cameras, or you can limit them, e.g., ORDER BY created_at LIMIT 4
            cur.execute("SELECT id, name, location, ip_address, rtsp_url, is_active FROM cameras ORDER BY id ASC")
            cameras = cur.fetchall()
            
            cameras_list = []
            for cam_record in cameras:
                cam_dict = dict(cam_record)
                # Convert datetime or other specific types if necessary, though not present in current select
                cameras_list.append(cam_dict)
            return jsonify({"success": True, "data": cameras_list}), 200
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error fetching dashboard cameras: {db_error}")
        return jsonify({"success": False, "message": "Database error fetching cameras."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error fetching dashboard cameras: {e}")
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
        return jsonify({"success": False, "message": "Invalid 'is_active' status provided. Must be true or false."}), 400

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
                return jsonify({"success": False, "message": "Camera not found or update failed."}), 404
            
            conn.commit()
            return jsonify({"success": True, "message": "Camera status updated.", "data": dict(updated_camera)}), 200
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error updating camera status: {db_error}")
        if conn: conn.rollback()
        return jsonify({"success": False, "message": "Database error updating camera status."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error updating camera status: {e}")
        if conn: conn.rollback()
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
            # Updated query WITHOUT details column since it doesn't exist
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
                # Add placeholder details since frontend expects it
                det_dict['details'] = f"Weapon detection with {det_dict.get('confidence', 0):.2%} confidence"
                detections_list.append(det_dict)

            current_app.logger.info(f"Fetched {len(detections_list)} detections from database")
            return jsonify({"success": True, "data": detections_list}), 200
            
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error fetching recent detections: {db_error}")
        return jsonify({"success": False, "message": "Database error fetching detections."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error fetching recent detections: {e}")
        return jsonify({"success": False, "message": "An unexpected error occurred."}), 500
    finally:
        if conn:
            conn.close()

@dashboard_bp.route('/analyze-frame', methods=['POST'])
@token_required
def analyze_frame_route(current_user):
    current_app.logger.info("Received /analyze-frame request")
    data = request.get_json()
    
    if not data:
        current_app.logger.warning("No JSON data received")
        return jsonify({"success": False, "message": "No JSON data provided."}), 400
    
    image_b64 = data.get('image_b64')
    current_app.logger.info(f"Image data length: {len(image_b64) if image_b64 else 0}")

    if not image_b64:
        return jsonify({"success": False, "message": "No image data provided."}), 400

    # Prepare llama.cpp vision prompt
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "just name things in the image. like if you see botle, say bottle, if weapon say gun/knife. no more then 4 words"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
                ]
            }
        ]
    }

    try:
        current_app.logger.info(f"Sending request to llama.cpp at {LLAMA_SERVER_URL}")
        response = requests.post(LLAMA_SERVER_URL, json=payload, timeout=60)
        current_app.logger.info(f"Llama.cpp response: {response.status_code}")
        
        if response.ok:
            result = response.json()
            description = (
                result.get('choices', [{}])[0]
                .get('message', {})
                .get('content', 'No description found.')
            )
            current_app.logger.info(f"Description extracted: {description}")
            return jsonify({"success": True, "description": description}), 200
        else:
            current_app.logger.error(f"Llama.cpp error: {response.text}")
            return jsonify({"success": False, "message": "Llama.cpp server error."}), 502
    except Exception as e:
        current_app.logger.error(f"Error contacting AI: {str(e)}")
        return jsonify({"success": False, "message": f"Error contacting AI: {str(e)}"}), 500

@dashboard_bp.route('/analyze-frame-smart', methods=['POST'])
@token_required
def analyze_frame_smart(current_user):
    current_app.logger.info("Received /analyze-frame-smart request")
    data = request.get_json()
    
    if not data:
        return jsonify({"success": False, "message": "No JSON data provided."}), 400
    
    image_b64 = data.get('image_b64')
    if not image_b64:
        return jsonify({"success": False, "message": "No image data provided."}), 400

    conn = None
    try:
        # Step 1: Decode base64 image for YOLO
        import base64
        image_data = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        current_app.logger.info("Running YOLO detection...")
        
        # Step 2: Run YOLO detection with LOWER confidence for better detection
        results = yolo_model(image, conf=0.25)  # Reduced from 0.3 to 0.25
        
        # Step 3: Check for weapons with improved logic
        detected_objects = []
        weapon_detected = False
        suspicious_detected = False
        highest_weapon_confidence = 0.0
        weapon_types = []
        suspicious_types = []
        smol_description = ""
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls)
                    class_name = yolo_model.names[class_id].lower()
                    confidence = float(box.conf)
                    
                    detected_objects.append({
                        'object': class_name,
                        'confidence': round(confidence, 2)
                    })
                    
                    # Check if it's a weapon with better matching
                    is_weapon = any(weapon.lower() in class_name or class_name in weapon.lower() 
                                  for weapon in WEAPON_CLASSES)
                    
                    # Check if it's suspicious
                    is_suspicious = any(suspicious.lower() in class_name or class_name in suspicious.lower() 
                                      for suspicious in SUSPICIOUS_CLASSES)
                    
                    if is_weapon:
                        weapon_detected = True
                        weapon_types.append(class_name)
                        highest_weapon_confidence = max(highest_weapon_confidence, confidence)
                        current_app.logger.warning(f"🚨 WEAPON DETECTED: {class_name} (confidence: {confidence:.3f})")
                    
                    elif is_suspicious and confidence > 0.5:  # Higher threshold for suspicious items
                        suspicious_detected = True
                        suspicious_types.append(class_name)
                        current_app.logger.info(f"⚠️ Suspicious object: {class_name} (confidence: {confidence:.3f})")
        
        current_app.logger.info(f"YOLO detected: {detected_objects}")
        
        # Step 4: Create basic description
        description = f"Objects detected: {', '.join([obj['object'] for obj in detected_objects])}"
        
        # Step 5: ONLY send to SmolVLM if weapon detected (not for every frame!)
        if weapon_detected:
            current_app.logger.info("🎯 WEAPON DETECTED! Sending to SmolVLM for detailed analysis...")
            
            # Send to SmolVLM for detailed description
            payload = {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"SECURITY ALERT: A weapon ({', '.join(weapon_types)}) was detected in this image. Describe what you see focusing on: 1) The weapon type and location, 2) Person's actions/behavior, 3) Immediate threat level. Be concise but specific."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
                        ]
                    }
                ]
            }
            
            try:
                current_app.logger.info("📡 Sending weapon detection to SmolVLM...")
                response = requests.post(LLAMA_SERVER_URL, json=payload, timeout=60)
                
                if response.ok:
                    result = response.json()
                    smol_description = (
                        result.get('choices', [{}])[0]
                        .get('message', {})
                        .get('content', 'No detailed description available.')
                    )
                    description = f"⚠️ WEAPON ALERT: {smol_description}"
                    current_app.logger.info(f"✅ SmolVLM analysis completed")
                else:
                    smol_description = f"Weapon detected: {', '.join(weapon_types)} (confidence: {highest_weapon_confidence:.2%})"
                    description = f"⚠️ WEAPON DETECTED: {smol_description}"
                    current_app.logger.warning(f"SmolVLM HTTP error: {response.status_code}")
                    
            except Exception as e:
                current_app.logger.error(f"❌ SmolVLM error (continuing anyway): {e}")
                smol_description = f"Weapon detected: {', '.join(weapon_types)} (confidence: {highest_weapon_confidence:.2%})"
                description = f"⚠️ WEAPON DETECTED: {smol_description}"

            # Save to database for weapon detections
            try:
                conn = get_db_connection()
                current_app.logger.info("💾 Saving weapon detection to database...")
                
                with conn.cursor() as cur:
                    # Save image to disk
                    image_filename = None
                    try:
                        images_dir = os.path.join(os.path.dirname(__file__), '..', 'detection_images')
                        os.makedirs(images_dir, exist_ok=True)
                        
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        image_filename = f"weapon_detection_{timestamp}.jpg"
                        image_path = os.path.join(images_dir, image_filename)
                        
                        with open(image_path, 'wb') as f:
                            f.write(image_data)
                        
                        current_app.logger.info(f"📸 Saved detection image: {image_filename}")
                    except Exception as img_error:
                        current_app.logger.error(f"❌ Failed to save image: {img_error}")
                        image_filename = None

                    # Insert detection into database
                    cur.execute("""
                        INSERT INTO detection_logs 
                        (camera_id, detection_type, confidence, detected_at, image_path)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        1,  # Default camera_id
                        'weapon',
                        highest_weapon_confidence,
                        datetime.now(),
                        image_filename
                    ))
                    
                    detection_id = cur.fetchone()[0]
                    conn.commit()
                    
                    current_app.logger.info(f"✅ Weapon detection saved with ID: {detection_id}")
                    
            except Exception as db_error:
                current_app.logger.error(f"💥 Database error: {db_error}")
                if conn:
                    conn.rollback()
        
        # Step 6: Return response with appropriate flags
        return jsonify({
            "success": True, 
            "description": description,
            "weapon_detected": weapon_detected,
            "suspicious_detected": suspicious_detected,
            "detected_objects": detected_objects,
            "processing_time": "fast" if not weapon_detected else "detailed_analysis",
            "ai_description": smol_description if weapon_detected else "",
            "weapon_types": weapon_types,
            "suspicious_types": suspicious_types,
            "confidence": highest_weapon_confidence if weapon_detected else 0,
            "smol_used": weapon_detected  # Flag to show if SmolVLM was used
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"💥 Error in smart analysis: {str(e)}")
        return jsonify({"success": False, "message": f"Analysis error: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()