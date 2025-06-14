from flask import Blueprint, jsonify, request, current_app
from db_utils import get_db_connection
from auth_utils import token_required
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime
import threading
import base64
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

# Remove all the console logging to improve performance
dashboard_bp = Blueprint('dashboard_bp', __name__)

# Global thread pool for parallel processing
thread_pool = ThreadPoolExecutor(max_workers=2)

# Global model variable that persists across requests
_MODEL = None

def get_yolo_model():
    """Get cached YOLO model - load only once"""
    global _MODEL
    if _MODEL is None:
        # Load model with appropriate weights - use absolute path to be safe
        _MODEL = YOLO(r'H:\Code\Final Year Projectsss\CamWatch\code\runs\detect\train3\weights\best.pt')
    return _MODEL

# Weapon classes from your trained model
WEAPON_CLASSES = {
    0: 'automatic rifle',
    1: 'granade launcher', 
    2: 'knife',
    3: 'machine gun',
    4: 'pistol',
    5: 'rocket launcher',
    6: 'shotgun',
    7: 'sniper',
    8: 'sword'  # This was missing!
}

# Lower the thresholds to improve detection rates

# Adjusted thresholds based on detection logs
CLASS_THRESHOLDS = {
    0: 0.30,  # automatic rifle
    1: 0.30,  # granade launcher 
    2: 0.35,  # knife
    3: 0.30,  # machine gun
    4: 0.25,  # pistol - lowered from 0.45 to 0.25
    5: 0.30,  # rocket launcher
    6: 0.35,  # shotgun
    7: 0.35,  # sniper
    8: 0.40,  # sword - lowered from 0.50 to 0.40
}

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
    data = request.get_json()
    
    if not data or 'image_b64' not in data:
        return jsonify({"success": False, "message": "No image data provided."}), 400

    image_b64 = data.get('image_b64')
    
    try:
        # Decode image
        image_data = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"success": False, "message": "Invalid image data."}), 400
        
        # Resize for faster processing
        image = cv2.resize(image, (320, 320))
        
        # Get the pre-loaded model
        model = get_yolo_model()
        
        # Run detection with lower confidence threshold
        results = model(image, conf=0.20, verbose=False, save=False)
        
        # Analyze results
        return analyze_weapon_detection(results, image_data)
        
    except Exception as e:
        return jsonify({"success": False, "message": f"Analysis error: {e}"}), 500

def analyze_weapon_detection(results, image_data):
    """Weapon detection analysis with optimized thresholds"""
    detected_weapons = []
    weapon_detected = False
    highest_confidence = 0.0
    
    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls)
                confidence = float(box.conf)
                
                # Check if it's a weapon with adequate confidence
                if class_id in WEAPON_CLASSES and confidence >= CLASS_THRESHOLDS.get(class_id, 0.25):
                    weapon_name = WEAPON_CLASSES[class_id]
                    weapon_detected = True
                    highest_confidence = max(highest_confidence, confidence)
                    
                    detected_weapons.append({
                        'weapon': weapon_name,
                        'confidence': round(confidence, 3)
                    })
    
    if weapon_detected:
        # Save detection in background
        thread_pool.submit(save_weapon_detection, image_data, detected_weapons, highest_confidence)
        
        return jsonify({
            "success": True,
            "weapon_detected": True,
            "weapons": detected_weapons,
            "confidence": highest_confidence,
            "message": f"🚨 WEAPON DETECTED: {', '.join([w['weapon'] for w in detected_weapons])}"
        }), 200
    else:
        return jsonify({
            "success": True,
            "weapon_detected": False,
            "weapons": [],
            "confidence": 0,
            "message": "✅ No weapons detected"
        }), 200

def save_weapon_detection(image_data, weapons, confidence):
    """Save weapon detection to database with image"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"detection_{timestamp}_{int(confidence * 100)}.jpg"
        
        # Save image to disk
        static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        detections_dir = os.path.join(static_dir, 'detections')
        os.makedirs(detections_dir, exist_ok=True)
        
        image_path = os.path.join(detections_dir, filename)
        
        with open(image_path, 'wb') as f:
            f.write(image_data)
            
        # Get server URL from config or environment
        server_url = os.getenv('SERVER_URL', 'http://localhost:5000')
        image_url = f"{server_url}/static/detections/{filename}"
        
        # Create detection record with image URL
        weapon_names = [w['weapon'] for w in weapons]
        details = f"Detected weapons: {', '.join(weapon_names)}"
        
        cursor.execute('''
            INSERT INTO detection_logs
            (camera_id, detection_type, confidence, details, image_path, detected_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (1, 'weapon', confidence, details, image_url, datetime.now()))
        
        conn.commit()
        conn.close()
    except Exception as e:
        current_app.logger.error(f"Error saving detection: {e}")