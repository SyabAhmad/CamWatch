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
import gc
import glob # Import glob to find files

load_dotenv()

dashboard_bp = Blueprint('dashboard_bp', __name__)

# Global thread pool for parallel processing
thread_pool = ThreadPoolExecutor(max_workers=2)

# Global model variable that persists across requests
_MODEL = None

# Track model loading time
_MODEL_LOAD_TIME = 0
_MODEL_KEEP_ALIVE_SECONDS = 3600  # 1 hour

DETECTION_IMAGES_DIR = None
# REMOVE THIS: RECENT_DETECTIONS_STORE = []  # In-memory store for recent detections
# REMOVE THIS: MAX_DETECTIONS = 10

# Add this global variable near the top with other globals
LAST_DETECTION_SAVE_TIME = 0
DETECTION_SAVE_COOLDOWN = 5.0  # INCREASED to 5 seconds between saves

# Add these globals near the top
DESCRIPTION_CACHE = {}
LAST_LLAMA_CALL = 0
LLAMA_CALL_COOLDOWN = 5.0  # 5 seconds between LLaMA calls

def get_yolo_model():
    """Get cached YOLO model with better persistence"""
    global _MODEL, _MODEL_LOAD_TIME
    
    current_time = time.time()
    
    # Check if model exists and is recent
    if _MODEL is not None:
        # Reset model timeout on every call
        _MODEL_LOAD_TIME = current_time
        return _MODEL
        
    current_app.logger.info("Loading YOLO model...")
    
    # Try to force garbage collection before loading model
    gc.collect()
    
    # Load model with appropriate weights
    # Ensure this path is correct for your trained model
    model_path = r'H:\Code\Final Year Projectsss\CamWatch\code\runs\detect\train7\weights\best.pt'
    if not os.path.exists(model_path):
         current_app.logger.error(f"Model file not found at {model_path}")
         # Fallback or raise error
         raise FileNotFoundError(f"Model file not found at {model_path}")

    _MODEL = YOLO(model_path)
    
    # Force model to CPU or CUDA depending on availability  
    device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    _MODEL.to(device)
    
    # Set load time
    _MODEL_LOAD_TIME = current_time
    
    current_app.logger.info(f"YOLO model loaded successfully on {device}")
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

# Make thresholds simpler and more reliable:
CLASS_THRESHOLDS = {
    0: 0.25,  # automatic rifle
    1: 0.25,  # granade launcher
    2: 0.70,  # knife - VERY STRICT
    3: 0.25,  # machine gun
    4: 0.20,  # pistol - sensitive
    5: 0.30,  # rocket launcher
    6: 0.25,  # shotgun
    7: 0.30,  # sniper
    8: 0.85,  # sword - VERY STRICT
}

WEAPON_CONFIDENCE_BOOSTS = {
    4: 1.15,  # pistol gets 15% boost
    2: 0.70,  # knife gets penalty
    8: 0.60,  # sword gets heavy penalty
}

# REMOVE THIS: RECENT_DETECTIONS = {}  # Store recent detections for each class

def init_detection_storage():
    """Initialize detection image storage directory"""
    global DETECTION_IMAGES_DIR
    if DETECTION_IMAGES_DIR is None:
        static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        DETECTION_IMAGES_DIR = os.path.join(static_dir, 'recent_detections')
        os.makedirs(DETECTION_IMAGES_DIR, exist_ok=True)
        current_app.logger.info(f"Detection images directory initialized at: {DETECTION_IMAGES_DIR}")
    return DETECTION_IMAGES_DIR

def store_detection_image(image_data, detection_info):
    """Store detection image and return its URL"""
    try:
        init_detection_storage()
        
        # Generate filename using the detection ID from frontend (timestamp)
        # This assumes the frontend ID is unique and based on timestamp
        filename = f"detection_{detection_info['id']}.jpg"
        image_path = os.path.join(DETECTION_IMAGES_DIR, filename)
        
        # Save image
        with open(image_path, 'wb') as f:
            f.write(image_data)
        
        # Get server URL
        server_url = os.getenv('SERVER_URL', 'http://localhost:5000')
        image_url = f"{server_url}/static/recent_detections/{filename}"
        
        current_app.logger.info(f"Stored detection image: {filename}")
        return image_path, image_url # Return both path and URL
        
    except Exception as e:
        current_app.logger.error(f"Error storing detection image: {e}")
        return None, None

# Function to find image path by detection ID
def find_image_path_by_id(detection_id):
    """Find the image path for a given detection ID"""
    init_detection_storage()
    # Search for files matching the pattern detection_ID.jpg
    search_pattern = os.path.join(DETECTION_IMAGES_DIR, f"detection_{detection_id}.jpg")
    files = glob.glob(search_pattern)
    
    if files:
        # Assuming the ID is unique, there should be only one match
        return files[0]
    return None


def get_llama_description(image_path, weapons, timestamp):
    """Get short markdown description from LLaMA.cpp for the detection"""
    # Ensure image_path exists before proceeding
    if not image_path or not os.path.exists(image_path):
        current_app.logger.error(f"Image file not found for LLaMA description: {image_path}")
        weapon_list = ", ".join([w['weapon'] for w in weapons])
        return f"**ALERT**: {weapon_list} detected. Image not available for detailed analysis."

    try:
        # Prepare shorter, more focused prompt with markdown formatting
        weapon_list = ", ".join([w['weapon'] for w in weapons])
        highest_conf = max([w['confidence'] for w in weapons]) * 100

        # Read image data to potentially send to LLaMA if it supports image input
        # For now, we'll just use the text prompt
        # with open(image_path, 'rb') as f:
        #     image_bytes = f.read()
        # image_b64 = base64.b64encode(image_bytes).decode('utf-8')

        # --- MODIFIED PROMPT ---
        prompt = f"""Act as a highly experienced security detective analyzing a critical threat.
Based on the image, describe the situation for an urgent security report.
Focus on identifying the weapon ({weapon_list} detected at {highest_conf:.0f}% confidence), the subject's actions, posture, and any potential immediate threat indicators.
Use clear, concise language suitable for a security briefing.
Start with a strong security alert statement.
Provide a detailed analysis, not less than 100 words, highlighting the potential danger.
Format the report using markdown for readability.
"""
        # --- END MODIFIED PROMPT ---

        # Faster LLaMA.cpp API call with reduced parameters
        llama_response = requests.post(
            'http://localhost:8080/completion',
            json={
                'prompt': prompt,
                'n_predict': 200,     # Increased prediction length for more detail
                'temperature': 0.3,   # Slightly higher temp for more varied descriptions
                'top_p': 0.9,
                'stop': ['\n\n\n', '---', '##', 'Report End'],  # Stop at section breaks or explicit end
                'stream': False
            },
            timeout=20  # Increased timeout slightly
        )

        if llama_response.status_code == 200:
            result = llama_response.json()
            description = result.get('content', '').strip()

            # Clean up and ensure proper markdown
            if description:
                # Ensure it starts with proper markdown if not
                if not any(description.startswith(marker) for marker in ['#', '*', '-', '**', '>']):
                     description = f"**SECURITY THREAT ANALYSIS**: {weapon_list} detected\n\n{description}"

                # Limit length but preserve markdown structure
                # Frontend will handle expandable view
                # if len(description) > 200:
                #     description = description[:197] + "..."
                return description
            else:
                return f"**HIGH ALERT**: {weapon_list} detected\n\n*Immediate security response required*"
        else:
            current_app.logger.error(f"LLaMA server error: {llama_response.status_code} - {llama_response.text}")
            return f"**ALERT**: {weapon_list} detected\n\n*Security team notified*"

    except requests.exceptions.Timeout:
        current_app.logger.error("LLaMA server timeout")
        return f"**URGENT**: {weapon_list} detected\n\n*Response needed immediately*"
    except requests.exceptions.ConnectionError:
        current_app.logger.error("Cannot connect to LLaMA server. Is LLaMA.cpp running?")
        return f"**THREAT**: {weapon_list} identified\n\n*LLaMA server offline - manual analysis required*"
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
        DESCRIPTION_CACHE[detection_id] = fallback # Cache the fallback too
        return fallback
    
    # Generate new description
    LAST_LLAMA_CALL = current_time
    description = get_llama_description(image_path, weapons, timestamp)
    
    # Cache the result
    DESCRIPTION_CACHE[detection_id] = description
    
    # Keep cache size reasonable (max 20 entries)
    if len(DESCRIPTION_CACHE) > 20:
        # Remove oldest entries (simple FIFO)
        oldest_keys = list(DESCRIPTION_CACHE.keys())[:len(DESCRIPTION_CACHE) - 20]
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

# Replace analyze_weapon_detection with this SIMPLE version:
def analyze_weapon_detection(results, image_data):
    global LAST_DETECTION_SAVE_TIME
    
    detected_weapons = []
    current_time = time.time()
    
    current_app.logger.info(f"Analyzing {len(results)} detection results")
    
    # Simple detection processing - NO COMPLEX LOGIC
    for result in results:
        if result.boxes is not None:
            current_app.logger.info(f"Found {len(result.boxes)} detections")
            
            for box in result.boxes:
                class_id = int(box.cls.item())
                confidence = float(box.conf.item())
                
                current_app.logger.info(f"Detection: class_id={class_id}, confidence={confidence:.3f}")
                
                if class_id in WEAPON_CLASSES:
                    weapon_name = WEAPON_CLASSES[class_id]
                    threshold = CLASS_THRESHOLDS.get(class_id, 0.25)
                    boost = WEAPON_CONFIDENCE_BOOSTS.get(class_id, 1.0)
                    
                    # Apply boost
                    adjusted_confidence = confidence * boost
                    
                    current_app.logger.info(f"Weapon {weapon_name}: {confidence:.3f} -> {adjusted_confidence:.3f} (threshold: {threshold})")
                    
                    # Simple threshold check
                    if adjusted_confidence >= threshold:
                        detected_weapons.append({
                            'weapon': weapon_name,
                            'confidence': round(adjusted_confidence, 3),
                            'original_confidence': round(confidence, 3)
                        })
                        current_app.logger.info(f"✅ DETECTED: {weapon_name} ({adjusted_confidence:.3f})")
    
    # Remove duplicates (keep highest confidence)
    unique_weapons = {}
    for weapon in detected_weapons:
        weapon_name = weapon['weapon']
        if weapon_name not in unique_weapons or weapon['confidence'] > unique_weapons[weapon_name]['confidence']:
            unique_weapons[weapon_name] = weapon
    
    final_weapons = list(unique_weapons.values())
    
    if final_weapons:
        highest_confidence = max(w['confidence'] for w in final_weapons)
        
        # Simple save logic - save every 5 seconds
        time_since_last_save = current_time - LAST_DETECTION_SAVE_TIME
        should_save = time_since_last_save >= DETECTION_SAVE_COOLDOWN
        
        detection_id = None
        image_url = None
        image_path = None

        if should_save:
            # Generate a unique ID (using timestamp)
            detection_id = int(current_time * 1000)
            detection_info_for_save = {
                'id': detection_id,
                'weapons': final_weapons,
                'confidence': highest_confidence
            }
            
            # Store image and get path/URL
            image_path, image_url = store_detection_image(image_data, detection_info_for_save)
            
            if image_path and image_url:
                LAST_DETECTION_SAVE_TIME = current_time
                current_app.logger.info(f"✅ Saved detection image for ID: {detection_id}")
            else:
                 # If image saving failed, don't return ID/URL
                 detection_id = None
                 image_url = None
                 image_path = None


        return jsonify({
            "success": True,
            "weapon_detected": True,
            "weapons": final_weapons,
            "confidence": highest_confidence,
            "detection_id": detection_id, # Return ID and URL for frontend to save
            "image_url": image_url,
            "saved_to_backend": should_save, # Indicate if image was saved
            "message": f"🚨 WEAPON DETECTED: {', '.join([w['weapon'] for w in final_weapons])}"
        }), 200
    else:
        return jsonify({
            "success": True,
            "weapon_detected": False,
            "weapons": [],
            "confidence": 0,
            "detection_id": None,
            "image_url": None,
            "saved_to_backend": False,
            "message": "✅ No weapons detected"
        }), 200

# Update the analyze_frame_route to be simpler:
@dashboard_bp.route('/analyze-frame', methods=['POST'])
@token_required
def analyze_frame_route(current_user):
    # Add this to keep model loaded persistently
    model = get_yolo_model()  # This will refresh the model timeout
    
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

        current_app.logger.info(f"Received image: {image.shape}")

        # Resize to 640x640 (standard YOLO size)
        image = cv2.resize(image, (640, 640))
        
        # Convert to RGB for YOLO
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Run detection with good parameters
        model = get_yolo_model()
        results = model(image_rgb,
                      conf=0.20,        # Base confidence
                      iou=0.45,         # IoU threshold
                      max_det=15,       # Max detections
                      verbose=False)

        return analyze_weapon_detection(results, image_data)

    except Exception as e:
        current_app.logger.error(f"Analysis error: {e}")
        return jsonify({"success": False, "message": f"Analysis error: {str(e)}"}), 500

# REMOVE THIS ENDPOINT: @dashboard_bp.route('/recent-detections', methods=['GET'])
# The frontend now manages recent detections in local storage.

# Update the describe_detection endpoint
@dashboard_bp.route('/detection/<int:detection_id>/describe', methods=['POST'])
@token_required
def describe_detection(current_user, detection_id):
    """Generate LLaMA description for a specific detection"""
    # We no longer rely on RECENT_DETECTIONS_STORE here
    
    try:
        current_app.logger.info(f"Request to generate description for detection ID: {detection_id}")
        
        # Find the image path based on the ID
        image_path = find_image_path_by_id(detection_id)
        
        if not image_path or not os.path.exists(image_path):
             current_app.logger.error(f"Image not found for description generation: ID {detection_id}, Path {image_path}")
             return jsonify({"success": False, "message": "Detection image not found."}), 404

        # We need weapon info to pass to get_llama_description
        # This is a limitation since backend doesn't store detection details anymore.
        # A simple way is to require the frontend to send weapon info with the request.
        # Or, we can try to infer it from the filename or a simple lookup file.
        # Let's modify the frontend to send weapon info with the request.
        
        data = request.get_json()
        weapons = data.get('weapons')
        timestamp = data.get('timestamp')

        if not weapons or not timestamp:
             current_app.logger.error(f"Weapon info or timestamp missing for description generation: ID {detection_id}")
             return jsonify({"success": False, "message": "Weapon details missing for description generation."}), 400

        current_app.logger.info(f"Generating description for detection {detection_id} using image: {image_path}")

        # Get description with caching and rate limiting
        description = get_cached_or_generate_description(
            detection_id,
            image_path,
            weapons, # Pass weapons from frontend
            timestamp # Pass timestamp from frontend
        )
        
        current_app.logger.info(f"Generated description for {detection_id}: {description[:50]}...") # Log start of description
        
        return jsonify({
            "success": True,
            "description": description,
            "detection_id": detection_id # Return ID for frontend to match
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
    # This endpoint needs detection details. Frontend should send them.
    data = request.get_json()
    detection = data.get('detection') # Frontend sends the detection object

    if not detection:
         return jsonify({"success": False, "message": "Detection data missing for report."}), 400

    try:
        # Find the image path based on the ID
        image_path = find_image_path_by_id(detection_id)
        # Note: image_path might be None if the image was cleaned up

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
            'location': 'Security Camera - Main Area', # Placeholder
            'reported_by': current_user.username,
            'report_generated_at': datetime.now().isoformat(),
            'image_url': detection.get('image_url') # Include image URL from frontend
        }
        
        # Store report in database (you can expand this)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Ensure your database table 'security_reports' exists and matches these columns
            # Example schema:
            # CREATE TABLE security_reports (
            #     report_id TEXT PRIMARY KEY,
            #     detection_id INTEGER,
            #     weapons TEXT,
            #     confidence REAL,
            #     description TEXT,
            #     status TEXT,
            #     severity TEXT,
            #     created_by INTEGER,
            #     created_at TEXT,
            #     image_url TEXT
            # );
            cursor.execute('''
                INSERT INTO security_reports 
                (report_id, detection_id, weapons, confidence, description, status, severity, created_by, created_at, image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                report['id'],
                detection_id,
                weapon_list,
                detection['confidence'],
                report['description'],
                report['status'],
                report['severity'],
                current_user.id, # Assuming current_user.id is available and is an integer
                datetime.now().isoformat(),
                report['image_url']
            ))
            conn.commit()
            current_app.logger.info(f"Created security report {report['id']} for detection {detection_id}")
        except Exception as db_error:
            current_app.logger.warning(f"Could not save report to database: {db_error}")
            # Continue anyway, return the report object
            if conn:
                 conn.rollback()
        finally:
            if conn:
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
    # This endpoint needs detection details. Frontend should send them.
    data = request.get_json()
    detection = data.get('detection') # Frontend sends the detection object

    if not detection:
         return jsonify({"success": False, "message": "Detection data missing for alert."}), 400

    try:
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
            'alert_sent_at': datetime.now().isoformat(),
            'image_url': detection.get('image_url') # Include image URL from frontend
        }
        
        current_app.logger.info(f"Security alert sent for detection {detection_id}: {weapon_list}")
        
        # Example: Send alert data to a logging service or external API
        # requests.post('YOUR_ALERT_SERVICE_URL', json=alert_data)

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