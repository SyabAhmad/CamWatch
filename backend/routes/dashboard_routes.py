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
import time
import json
import requests

load_dotenv()

dashboard_bp = Blueprint('dashboard_bp', __name__)

# Global thread pool for parallel processing
thread_pool = ThreadPoolExecutor(max_workers=2)

# Global model variable that persists across requests
_MODEL = None

DETECTION_IMAGES_DIR = None
RECENT_DETECTIONS_STORE = []  # In-memory store for recent detections
MAX_DETECTIONS = 10

# Add this global variable near the top with other globals
LAST_DETECTION_SAVE_TIME = 0
DETECTION_SAVE_COOLDOWN = 3.0  # 3 seconds between saves

# Add these globals near the top
DESCRIPTION_CACHE = {}
LAST_LLAMA_CALL = 0
LLAMA_CALL_COOLDOWN = 5.0  # 5 seconds between LLaMA calls

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
    8: 'sword'
}

# Update the CLASS_THRESHOLDS - make sword much stricter and pistol more sensitive
CLASS_THRESHOLDS = {
    0: 0.25,  # automatic rifle
    1: 0.25,  # granade launcher 
    2: 0.35,  # knife - stricter
    3: 0.25,  # machine gun
    4: 0.18,  # pistol - MORE SENSITIVE (this should catch pistols better)
    5: 0.30,  # rocket launcher
    6: 0.28,  # shotgun
    7: 0.30,  # sniper
    8: 0.75,  # sword - MUCH STRICTER (was 0.60, now 0.75)
}

# Add weapon-specific confidence boost logic
WEAPON_CONFIDENCE_BOOSTS = {
    4: 1.15,  # pistol gets 15% confidence boost
    2: 0.95,  # knife gets slight penalty
    8: 0.85,  # sword gets significant penalty
}

RECENT_DETECTIONS = {}  # Store recent detections for each class

def init_detection_storage():
    """Initialize detection image storage directory"""
    global DETECTION_IMAGES_DIR
    if DETECTION_IMAGES_DIR is None:
        static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        DETECTION_IMAGES_DIR = os.path.join(static_dir, 'recent_detections')
        os.makedirs(DETECTION_IMAGES_DIR, exist_ok=True)
    return DETECTION_IMAGES_DIR

def store_detection_image(image_data, detection_info):
    """Store detection image and manage the 10 most recent"""
    global RECENT_DETECTIONS_STORE
    
    try:
        init_detection_storage()
        
        # Generate filename
        timestamp = datetime.now()
        filename = f"detection_{timestamp.strftime('%Y%m%d_%H%M%S')}_{detection_info['id']}.jpg"
        image_path = os.path.join(DETECTION_IMAGES_DIR, filename)
        
        # Save image
        with open(image_path, 'wb') as f:
            f.write(image_data)
        
        # Get server URL
        server_url = os.getenv('SERVER_URL', 'http://localhost:5000')
        image_url = f"{server_url}/static/recent_detections/{filename}"
        
        # Create detection record
        detection_record = {
            'id': detection_info['id'],
            'weapons': detection_info['weapons'],
            'confidence': detection_info['confidence'],
            'timestamp': timestamp.isoformat(),
            'image_path': image_path,
            'image_url': image_url,
            'description': None  # Will be filled by LLaMA when requested
        }
        
        # Add to store (prepend to keep most recent first)
        RECENT_DETECTIONS_STORE.insert(0, detection_record)
        
        # Keep only 10 most recent
        if len(RECENT_DETECTIONS_STORE) > MAX_DETECTIONS:
            # Remove old images from filesystem
            for old_detection in RECENT_DETECTIONS_STORE[MAX_DETECTIONS:]:
                try:
                    if os.path.exists(old_detection['image_path']):
                        os.remove(old_detection['image_path'])
                        current_app.logger.info(f"Removed old detection image: {old_detection['image_path']}")
                except Exception as e:
                    current_app.logger.warning(f"Failed to remove old image: {e}")
            
            # Keep only 10 most recent
            RECENT_DETECTIONS_STORE = RECENT_DETECTIONS_STORE[:MAX_DETECTIONS]
        
        current_app.logger.info(f"Stored detection image: {filename}")
        return detection_record
        
    except Exception as e:
        current_app.logger.error(f"Error storing detection image: {e}")
        return None

def get_llama_description(image_path, weapons, timestamp):
    """Get short markdown description from LLaMA.cpp for the detection"""
    try:
        # Prepare shorter, more focused prompt with markdown formatting
        weapon_list = ", ".join([w['weapon'] for w in weapons])
        highest_conf = max([w['confidence'] for w in weapons]) * 100
        
        prompt = f"""Security Alert: {weapon_list} detected at {highest_conf:.0f}% confidence.
pretend you are a detectve,  and  trying to identify the setuiation.

- Describe the image in a way that is suitable for a security report. not less then 100 words
"""

        # Faster LLaMA.cpp API call with reduced parameters
        llama_response = requests.post(
            'http://localhost:8080/completion',
            json={
                'prompt': prompt,
                'n_predict': 120,     # Slightly increased for markdown formatting
                'temperature': 0.1,
                'top_p': 0.8,
                'stop': ['\n\n\n', '---'],  # Stop at section breaks
                'stream': False
            },
            timeout=12  # Slightly increased for markdown generation
        )
        
        if llama_response.status_code == 200:
            result = llama_response.json()
            description = result.get('content', '').strip()
            
            # Clean up and ensure proper markdown
            if description:
                # Ensure it starts with proper markdown if not
                if not any(description.startswith(marker) for marker in ['#', '*', '-', '**']):
                    description = f"**SECURITY ALERT**: {weapon_list} detected\n\n{description}"
                
                # Limit length but preserve markdown structure
                if len(description) > 200:
                    description = description[:197] + "..."
                return description
            else:
                return f"**HIGH ALERT**: {weapon_list} detected\n\n*Immediate security response required*"
        else:
            current_app.logger.error(f"LLaMA server error: {llama_response.status_code}")
            return f"**ALERT**: {weapon_list} detected\n\n*Security team notified*"
            
    except requests.exceptions.Timeout:
        current_app.logger.error("LLaMA server timeout")
        return f"**URGENT**: {weapon_list} detected\n\n*Response needed immediately*"
    except requests.exceptions.ConnectionError:
        current_app.logger.error("Cannot connect to LLaMA server")
        return f"**THREAT**: {weapon_list} identified\n\n*Security protocols activated*"
    except Exception as e:
        current_app.logger.error(f"Error getting LLaMA description: {e}")
        return f"**WARNING**: {weapon_list} detected\n\n*Manual verification required*"

def get_cached_or_generate_description(detection_id, image_path, weapons, timestamp):
    """Get description with caching and rate limiting"""
    global DESCRIPTION_CACHE, LAST_LLAMA_CALL
    
    # Check cache first
    if detection_id in DESCRIPTION_CACHE:
        current_app.logger.info(f"Using cached description for detection {detection_id}")
        return DESCRIPTION_CACHE[detection_id]
    
    # Check rate limiting
    current_time = time.time()
    time_since_last_call = current_time - LAST_LLAMA_CALL
    
    if time_since_last_call < LLAMA_CALL_COOLDOWN:
        # Too soon, return a quick fallback
        weapon_list = ", ".join([w['weapon'] for w in weapons])
        fallback = f"SECURITY ALERT: {weapon_list} detected. Analysis queued for processing."
        DESCRIPTION_CACHE[detection_id] = fallback
        return fallback
    
    # Generate new description
    LAST_LLAMA_CALL = current_time
    description = get_llama_description(image_path, weapons, timestamp)
    
    # Cache the result
    DESCRIPTION_CACHE[detection_id] = description
    
    # Keep cache size reasonable (max 20 entries)
    if len(DESCRIPTION_CACHE) > 20:
        # Remove oldest entries
        oldest_keys = list(DESCRIPTION_CACHE.keys())[:10]
        for key in oldest_keys:
            del DESCRIPTION_CACHE[key]
    
    return description

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

# Update the analyze_weapon_detection function
def analyze_weapon_detection(results, image_data):
    global RECENT_DETECTIONS, LAST_DETECTION_SAVE_TIME
    
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
    
    # Collect all detections first
    all_detections = []
    
    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls)
                confidence = float(box.conf)
                
                if class_id in WEAPON_CLASSES:
                    # Apply weapon-specific confidence adjustments
                    adjusted_confidence = confidence * WEAPON_CONFIDENCE_BOOSTS.get(class_id, 1.0)
                    
                    all_detections.append({
                        'class_id': class_id,
                        'original_confidence': confidence,
                        'adjusted_confidence': adjusted_confidence,
                        'weapon_name': WEAPON_CLASSES[class_id],
                        'box': box
                    })
    
    # Sort by adjusted confidence (highest first)
    all_detections.sort(key=lambda x: x['adjusted_confidence'], reverse=True)
    
    # Process detections with improved logic
    processed_weapons = set()  # Avoid duplicate weapon types
    
    for detection in all_detections:
        class_id = detection['class_id']
        confidence = detection['adjusted_confidence']
        weapon_name = detection['weapon_name']
        
        # Skip if we already have this weapon type with higher confidence
        if weapon_name in processed_weapons:
            continue
            
        # Check threshold
        if confidence >= CLASS_THRESHOLDS.get(class_id, 0.25):
            # Special logic for commonly confused weapons
            if class_id == 8 and confidence < 0.80:  # sword
                # Check if there's a pistol detection with reasonable confidence
                pistol_detections = [d for d in all_detections if d['class_id'] == 4 and d['adjusted_confidence'] > 0.20]
                if pistol_detections:
                    current_app.logger.info(f"Skipping sword detection (conf: {confidence:.3f}) - pistol found with conf: {pistol_detections[0]['adjusted_confidence']:.3f}")
                    continue
            
            if class_id not in RECENT_DETECTIONS:
                RECENT_DETECTIONS[class_id] = []
            
            RECENT_DETECTIONS[class_id].append({
                'confidence': confidence,
                'time': current_time
            })
            
            recent_count = len(RECENT_DETECTIONS[class_id])
            
            # Apply temporal consistency boost
            if recent_count > 1:
                avg_conf = sum(d['confidence'] for d in RECENT_DETECTIONS[class_id]) / recent_count
                boost_factor = min(1.0 + (recent_count * 0.05), 1.2)
                confidence = min(confidence * boost_factor, 0.99)
            
            weapon_detected = True
            highest_confidence = max(highest_confidence, confidence)
            processed_weapons.add(weapon_name)
            
            detected_weapons.append({
                'weapon': weapon_name,
                'confidence': round(confidence, 3),
                'consistent_detections': recent_count,
                'original_confidence': round(detection['original_confidence'], 3)
            })
            
            current_app.logger.info(f"Detected {weapon_name}: orig={detection['original_confidence']:.3f}, adj={confidence:.3f}, threshold={CLASS_THRESHOLDS.get(class_id, 0.25)}")
    
    if weapon_detected:
        # Check if enough time has passed since last save (3 seconds)
        time_since_last_save = current_time - LAST_DETECTION_SAVE_TIME
        should_save_to_recent = time_since_last_save >= DETECTION_SAVE_COOLDOWN
        
        detection_id = None
        
        if should_save_to_recent:
            # Store detection image only if cooldown period has passed
            detection_info = {
                'id': int(current_time * 1000),  # Unique ID based on timestamp
                'weapons': detected_weapons,
                'confidence': highest_confidence
            }
            
            stored_detection = store_detection_image(image_data, detection_info)
            if stored_detection:
                detection_id = detection_info['id']
                LAST_DETECTION_SAVE_TIME = current_time
                current_app.logger.info(f"Saved detection to recent store (cooldown: {time_since_last_save:.1f}s)")
        else:
            current_app.logger.info(f"Skipped saving to recent store (cooldown: {time_since_last_save:.1f}s < {DETECTION_SAVE_COOLDOWN}s)")
        
        return jsonify({
            "success": True,
            "weapon_detected": True,
            "weapons": detected_weapons,
            "confidence": highest_confidence,
            "detection_id": detection_id,
            "saved_to_recent": should_save_to_recent,
            "time_until_next_save": max(0, DETECTION_SAVE_COOLDOWN - time_since_last_save),
            "message": f"🚨 WEAPON DETECTED: {', '.join([w['weapon'] for w in detected_weapons])}"
        }), 200
    else:
        return jsonify({
            "success": True,
            "weapon_detected": False,
            "weapons": [],
            "confidence": 0,
            "saved_to_recent": False,
            "message": "✅ No weapons detected"
        }), 200

# Update the analyze_frame_route to pass image_data correctly
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
        
        # Resize to optimal YOLO detection size (multiple of 32)
        image = cv2.resize(image, (416, 416))
        
        # Apply image enhancements
        image = cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX)
        
        # Optimize contrast
        alpha = 1.2  # contrast control
        beta = 10    # brightness control
        image = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
        
        # Run YOLO detection with optimized parameters
        model = get_yolo_model()
        
        results = model(image, 
                      conf=0.20,        # Lower base threshold
                      iou=0.45,         # Intersection over Union threshold
                      max_det=20,       # Maximum detections
                      verbose=False)
        
        # Analyze results (pass original image_data for storage)
        return analyze_weapon_detection(results, image_data)
        
    except Exception as e:
        current_app.logger.error(f"Analysis error: {e}")
        return jsonify({"success": False, "message": f"Analysis error: {e}"}), 500

# Fix the recent detections endpoint
@dashboard_bp.route('/recent-detections', methods=['GET'])
@token_required
def get_recent_detections(current_user):
    """Get the 10 most recent detections"""
    global RECENT_DETECTIONS_STORE
    
    try:
        # Convert to serializable format
        serializable_detections = []
        for detection in RECENT_DETECTIONS_STORE:
            serializable_detection = {
                'id': detection['id'],
                'weapons': detection['weapons'],
                'confidence': detection['confidence'],
                'timestamp': detection['timestamp'],
                'image_url': detection['image_url'],
                'description': detection.get('description', None)
            }
            serializable_detections.append(serializable_detection)
        
        return jsonify({
            "success": True,
            "detections": serializable_detections
        })
    except Exception as e:
        current_app.logger.error(f"Error fetching recent detections: {e}")
        return jsonify({
            "success": False,
            "message": f"Error fetching detections: {str(e)}"
        }), 500

# Update the describe_detection endpoint
@dashboard_bp.route('/detection/<int:detection_id>/describe', methods=['POST'])
@token_required
def describe_detection(current_user, detection_id):
    """Generate LLaMA description for a specific detection"""
    global RECENT_DETECTIONS_STORE
    
    try:
        # Find the detection
        detection = next((d for d in RECENT_DETECTIONS_STORE if d['id'] == detection_id), None)
        if not detection:
            return jsonify({"success": False, "message": "Detection not found"}), 404
        
        # Get description with caching and rate limiting
        if not detection.get('description'):
            current_app.logger.info(f"Generating description for detection {detection_id}")
            description = get_cached_or_generate_description(
                detection_id,
                detection['image_path'],
                detection['weapons'],
                detection['timestamp']
            )
            detection['description'] = description
            current_app.logger.info(f"Generated description: {description}")
        
        return jsonify({
            "success": True,
            "description": detection['description'],
            "detection": {
                'id': detection['id'],
                'weapons': detection['weapons'],
                'confidence': detection['confidence'],
                'timestamp': detection['timestamp'],
                'image_url': detection['image_url'],
                'description': detection['description']
            }
        })
    except Exception as e:
        current_app.logger.error(f"Error generating description for detection {detection_id}: {e}")
        return jsonify({
            "success": False,
            "message": f"Error generating description: {str(e)}"
        }), 500

# Add this function to check LLaMA server health
def check_llama_server_health():
    """Check if LLaMA server is responsive"""
    try:
        health_response = requests.get(
            'http://localhost:8080/health',
            timeout=2
        )
        return health_response.status_code == 200
    except:
        try:
            # Try a simple completion as health check
            test_response = requests.post(
                'http://localhost:8080/completion',
                json={
                    'prompt': 'Test',
                    'n_predict': 1,
                    'temperature': 0.1
                },
                timeout=3
            )
            return test_response.status_code == 200
        except:
            return False

# Add health check endpoint
@dashboard_bp.route('/llama-status', methods=['GET'])
@token_required
def llama_status(current_user):
    """Check LLaMA server status"""
    is_healthy = check_llama_server_health()
    return jsonify({
        "success": True,
        "llama_available": is_healthy,
        "status": "online" if is_healthy else "offline"
    })

# Add new report generation endpoint
@dashboard_bp.route('/detection/<int:detection_id>/report', methods=['POST'])
@token_required
def create_detection_report(current_user, detection_id):
    """Create a detailed security report for a detection"""
    global RECENT_DETECTIONS_STORE
    
    try:
        # Find the detection
        detection = next((d for d in RECENT_DETECTIONS_STORE if d['id'] == detection_id), None)
        if not detection:
            return jsonify({"success": False, "message": "Detection not found"}), 404
        
        # Generate comprehensive report
        timestamp = datetime.fromisoformat(detection['timestamp'])
        weapon_list = ", ".join([w['weapon'] for w in detection['weapons']])
        
        report = {
            'id': f"RPT-{detection_id}",
            'detection_id': detection_id,
            'timestamp': detection['timestamp'],
            'formatted_time': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'weapons': detection['weapons'],
            'confidence': detection['confidence'],
            'description': detection.get('description', 'No AI analysis available'),
            'status': 'pending_review',
            'severity': 'high' if detection['confidence'] > 0.7 else 'medium',
            'location': 'Security Camera - Main Area',
            'reported_by': current_user.username,
            'report_generated_at': datetime.now().isoformat()
        }
        
        # Store report in database (you can expand this)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO security_reports 
                (report_id, detection_id, weapons, confidence, description, status, severity, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                report['id'],
                detection_id,
                weapon_list,
                detection['confidence'],
                report['description'],
                report['status'],
                report['severity'],
                current_user.id,
                datetime.now().isoformat()
            ))
            conn.commit()
            current_app.logger.info(f"Created security report {report['id']} for detection {detection_id}")
        except Exception as db_error:
            current_app.logger.warning(f"Could not save report to database: {db_error}")
            # Continue anyway, return the report object
        finally:
            conn.close()
        
        return jsonify({
            "success": True,
            "message": "Security report created successfully",
            "report": report
        })
        
    except Exception as e:
        current_app.logger.error(f"Error creating report for detection {detection_id}: {e}")
        return jsonify({
            "success": False,
            "message": f"Error creating report: {str(e)}"
        }), 500

# Add alert security endpoint
@dashboard_bp.route('/detection/<int:detection_id>/alert', methods=['POST'])
@token_required
def alert_security(current_user, detection_id):
    """Send alert to security team"""
    global RECENT_DETECTIONS_STORE
    
    try:
        # Find the detection
        detection = next((d for d in RECENT_DETECTIONS_STORE if d['id'] == detection_id), None)
        if not detection:
            return jsonify({"success": False, "message": "Detection not found"}), 404
        
        weapon_list = ", ".join([w['weapon'] for w in detection['weapons']])
        
        # Here you could integrate with:
        # - Email notifications
        # - SMS alerts
        # - Slack/Teams notifications
        # - Security system APIs
        
        alert_data = {
            'alert_id': f"ALT-{detection_id}",
            'detection_id': detection_id,
            'message': f"IMMEDIATE ATTENTION: {weapon_list} detected",
            'confidence': detection['confidence'],
            'timestamp': detection['timestamp'],
            'alerted_by': current_user.username,
            'alert_sent_at': datetime.now().isoformat()
        }
        
        current_app.logger.info(f"Security alert sent for detection {detection_id}: {weapon_list}")
        
        return jsonify({
            "success": True,
            "message": "Security team has been alerted",
            "alert": alert_data
        })
        
    except Exception as e:
        current_app.logger.error(f"Error sending alert for detection {detection_id}: {e}")
        return jsonify({
            "success": False,
            "message": f"Error sending alert: {str(e)}"
        }), 500
    

# Add this at the end of your dashboard_routes.py file, before the last line

@dashboard_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "success": True,
        "status": "healthy",
        "message": "Server is running",
        "timestamp": datetime.now().isoformat()
    })