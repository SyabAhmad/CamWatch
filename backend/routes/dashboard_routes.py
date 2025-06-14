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
import torch
import time  # Import time for timestamp management
import json
load_dotenv()

# Remove all the console logging to improve performance
dashboard_bp = Blueprint('dashboard_bp', __name__)

# Global thread pool for parallel processing
thread_pool = ThreadPoolExecutor(max_workers=2)

# Global model variable that persists across requests
_MODEL = None

# Update these functions for better detection

def get_yolo_model():
    """Get cached YOLO model - load only once with optimized settings"""
    global _MODEL
    if _MODEL is None:
        # Load model with appropriate weights
        model_path = r'H:\Code\Final Year Projectsss\CamWatch\code\runs\detect\train3\weights\best.pt'
        _MODEL = YOLO(model_path)
        
        # Force model to CPU or CUDA depending on availability
        device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        _MODEL.to(device)
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

# More precise class-specific thresholds based on detection patterns

# Fine-tuned thresholds based on real-world results
CLASS_THRESHOLDS = {
    0: 0.28,  # automatic rifle
    1: 0.25,  # granade launcher 
    2: 0.30,  # knife - lower to catch more knives
    3: 0.28,  # machine gun
    4: 0.22,  # pistol - much lower to detect pistols better
    5: 0.30,  # rocket launcher
    6: 0.32,  # shotgun
    7: 0.30,  # sniper
    8: 0.35,  # sword - lowered from previous setting
}

RECENT_DETECTIONS = {}  # Store recent detections for each class

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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Get the most recent detections (adjust limit as needed)
        cursor.execute('''
            SELECT d.id, d.camera_id, d.detection_type, d.confidence, 
                   d.details, d.image_path, d.detected_at, c.name AS camera_name
            FROM detection_logs d
            LEFT JOIN cameras c ON d.camera_id = c.id
            ORDER BY d.detected_at DESC
            LIMIT 10
        ''')
        
        detections = cursor.fetchall()
        
        # Format the results
        results = []
        for detection in detections:
            details = detection['details']
            if details and isinstance(details, str):
                try:
                    details = json.loads(details)
                except:
                    pass  # Keep as string if not valid JSON
                    
            results.append({
                "id": detection['id'],
                "camera_id": detection['camera_id'],
                "camera_name": detection['camera_name'] or "Unknown Camera",
                "detection_type": detection['detection_type'],
                "confidence": float(detection['confidence']),
                "details": details,
                "image_url": detection['image_path'],
                "detected_at": detection['detected_at'].isoformat()
            })
            
        return jsonify({"success": True, "detections": results})
        
    except Exception as e:
        current_app.logger.error(f"Error fetching recent detections: {e}")
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
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
    camera_id = data.get('camera_id')  # Get camera_id from request if available
    
    try:
        # Decode image
        image_data = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"success": False, "message": "Invalid image data."}), 400
        
        # Resize to optimal YOLO detection size (multiple of 32)
        image = cv2.resize(image, (416, 416))
        
        # Apply image enhancements
        # Normalize image
        image = cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX)
        
        # Optimize contrast
        alpha = 1.2  # contrast control
        beta = 10    # brightness control
        image = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
        
        # Run YOLO detection with optimized parameters
        model = get_yolo_model()
        
        # Better parameters for real-time detection
        results = model(image, 
                      conf=0.20,        # Lower base threshold
                      iou=0.45,         # Intersection over Union threshold
                      max_det=20,       # Maximum detections
                      verbose=False)
        
        # Analyze results
        # Pass camera_id to analyze_weapon_detection
        return analyze_weapon_detection(results, image_data, camera_id)
        
    except Exception as e:
        return jsonify({"success": False, "message": f"Analysis error: {e}"}), 500

def analyze_weapon_detection(results, image_data, camera_id=None):
    global RECENT_DETECTIONS
    
    detected_weapons = []
    weapon_detected = False
    highest_confidence = 0.0
    
    current_time = time.time()
    
    # Clean up old entries (older than 10 seconds)
    for class_id in list(RECENT_DETECTIONS.keys()):
        RECENT_DETECTIONS[class_id] = [d for d in RECENT_DETECTIONS[class_id] 
                                      if current_time - d['time'] < 10]
        if not RECENT_DETECTIONS[class_id]:
            del RECENT_DETECTIONS[class_id]
    
    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls)
                confidence = float(box.conf)
                
                # Basic threshold check
                if class_id in WEAPON_CLASSES and confidence >= CLASS_THRESHOLDS.get(class_id, 0.25):
                    weapon_name = WEAPON_CLASSES[class_id]
                    
                    # Record this detection
                    if class_id not in RECENT_DETECTIONS:
                        RECENT_DETECTIONS[class_id] = []
                    
                    RECENT_DETECTIONS[class_id].append({
                        'confidence': confidence,
                        'time': current_time
                    })
                    
                    # Count recent detections for this class
                    recent_count = len(RECENT_DETECTIONS[class_id])
                    
                    # Apply temporal consistency - boost confidence if detected multiple times
                    if recent_count > 1:
                        # Calculate average confidence of recent detections
                        avg_conf = sum(d['confidence'] for d in RECENT_DETECTIONS[class_id]) / recent_count
                        
                        # Boost confidence based on consistency (up to 20% boost for 3+ detections)
                        boost_factor = min(1.0 + (recent_count * 0.05), 1.2)
                        confidence = min(confidence * boost_factor, 0.99)
                    
                    weapon_detected = True
                    highest_confidence = max(highest_confidence, confidence)
                    
                    detected_weapons.append({
                        'weapon': weapon_name,
                        'confidence': round(confidence, 3),
                        'consistent_detections': recent_count
                    })
    
    # Rest of the function remains the same
    if weapon_detected:
        # Save latest detection (for real-time display)
        save_latest_weapon_detection(image_data, detected_weapons, highest_confidence, camera_id)
        
        # Also save a historical record (for the detection history)
        save_weapon_detection(image_data, detected_weapons, highest_confidence, camera_id)
        
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

def save_weapon_detection(image_data, weapons, confidence, camera_id=None):
    """
    Save weapon detection to database with image as a new historical record.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Generate unique filename with timestamp
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
        
        # Create more detailed JSON for the details field
        weapon_names = [w['weapon'] for w in weapons]
        detection_details = {
            "weapons": weapons,
            "description": f"Detected weapons: {', '.join(weapon_names)}",
            "detection_count": len(weapons)
        }
        
        # Convert to JSON string
        import json
        details_json = json.dumps(detection_details)
        
        # Insert as a new historical record - detection_type is 'weapon' for these
        cursor.execute('''
            INSERT INTO detection_logs
            (camera_id, detection_type, confidence, details, image_path, detected_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (camera_id, 'weapon', confidence, details_json, image_url, datetime.now()))
        
        detection_id = cursor.fetchone()[0]
        conn.commit()
        
        current_app.logger.info(f"Saved weapon detection #{detection_id} with confidence {confidence:.2f}")
        return detection_id
        
    except Exception as e:
        current_app.logger.error(f"Error saving detection: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def save_latest_weapon_detection(image_data, weapons, confidence, camera_id=None):
    """
    Save or update the latest weapon detection in the database.
    Instead of creating multiple rows, this updates a single row to contain
    the most recent detection information.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"latest_detection_{timestamp}_{int(confidence * 100)}.jpg"
        
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
        
        # Create more detailed JSON for the details field
        weapon_names = [w['weapon'] for w in weapons]
        detection_details = {
            "weapons": weapons,
            "description": f"Detected weapons: {', '.join(weapon_names)}",
            "detection_count": len(weapons)
        }
        
        # Convert to JSON string
        import json
        details_json = json.dumps(detection_details)
        
        # Check if we already have a detection record
        cursor.execute("SELECT id FROM detection_logs WHERE detection_type='latest_weapon' LIMIT 1")
        existing_record = cursor.fetchone()
        
        if existing_record:
            # Update existing record
            cursor.execute('''
                UPDATE detection_logs
                SET camera_id = %s,
                    confidence = %s,
                    details = %s,
                    image_path = %s,
                    detected_at = %s
                WHERE id = %s
            ''', (camera_id, confidence, details_json, image_url, datetime.now(), existing_record[0]))
            
            detection_id = existing_record[0]
            current_app.logger.info(f"Updated latest weapon detection #{detection_id} with confidence {confidence:.2f}")
        else:
            # Insert new record
            cursor.execute('''
                INSERT INTO detection_logs
                (camera_id, detection_type, confidence, details, image_path, detected_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            ''', (camera_id, 'latest_weapon', confidence, details_json, image_url, datetime.now()))
            
            detection_id = cursor.fetchone()[0]
            current_app.logger.info(f"Created new latest weapon detection #{detection_id} with confidence {confidence:.2f}")
        
        conn.commit()
        return detection_id
        
    except Exception as e:
        current_app.logger.error(f"Error saving latest detection: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

@dashboard_bp.route('/latest-detection', methods=['GET'])
@token_required
def get_latest_detection(current_user):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        cursor.execute('''
            SELECT id, camera_id, confidence, details, image_path, detected_at 
            FROM detection_logs 
            WHERE detection_type='latest_weapon' 
            ORDER BY detected_at DESC LIMIT 1
        ''')
        
        detection = cursor.fetchone()
        
        if detection:
            # Get camera name if available
            camera_name = "Unknown"
            if detection['camera_id']:
                cursor.execute("SELECT name FROM cameras WHERE id = %s", (detection['camera_id'],))
                camera = cursor.fetchone()
                if camera:
                    camera_name = camera['name']
            
            # Format result
            result = {
                "id": detection['id'],
                "camera_id": detection['camera_id'],
                "camera_name": camera_name,
                "confidence": float(detection['confidence']),
                "details": detection['details'],
                "image_url": detection['image_path'],
                "detected_at": detection['detected_at'].isoformat()
            }
            return jsonify({"success": True, "detection": result})
        else:
            return jsonify({"success": True, "detection": None, "message": "No detections found"})
            
    except Exception as e:
        current_app.logger.error(f"Error fetching latest detection: {e}")
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()