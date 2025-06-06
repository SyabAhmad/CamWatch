from flask import Blueprint, jsonify, request, current_app
from db_utils import get_db_connection
from auth_utils import token_required # Assuming staff also need to be authenticated
import psycopg2
import psycopg2.extras
import requests
import os
from dotenv import load_dotenv
load_dotenv() 

dashboard_bp = Blueprint('dashboard_bp', __name__)

LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080/v1/chat/completions")

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
            # Fetch recent detections, e.g., last 10, ordered by time
            # Joining with cameras table to get camera name
            # Note: Your schema for detection_logs is missing camera_id, detection_type, detected_at, confidence
            # I will assume they exist for this query. Please update your schema.sql if needed.
            # For now, I'll use placeholder names if those columns are not in the provided schema.
            # Assuming schema.sql is updated to include: camera_id INT, detection_type VARCHAR, confidence REAL, detected_at TIMESTAMP
            cur.execute("""
                SELECT dl.id, dl.detection_type, dl.confidence, dl.detected_at, c.name as camera_name
                FROM detection_logs dl
                JOIN cameras c ON dl.camera_id = c.id
                ORDER BY dl.detected_at DESC
                LIMIT 10 
            """)
            # If schema is not updated, this query will fail.
            # Fallback if columns are missing (will return empty or error):
            # cur.execute("SELECT id, created_at as detected_at FROM detection_logs ORDER BY created_at DESC LIMIT 10")

            detections = cur.fetchall()
            
            detections_list = []
            for det_record in detections:
                det_dict = dict(det_record)
                if 'detected_at' in det_dict and hasattr(det_dict['detected_at'], 'isoformat'):
                    det_dict['detected_at'] = det_dict['detected_at'].isoformat()
                # Add placeholders if columns are missing from schema
                if 'detection_type' not in det_dict: det_dict['detection_type'] = 'unknown'
                if 'confidence' not in det_dict: det_dict['confidence'] = 0.0
                if 'camera_name' not in det_dict: det_dict['camera_name'] = 'N/A'
                detections_list.append(det_dict)

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