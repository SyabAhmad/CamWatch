from flask import Blueprint, request, jsonify, current_app
from db_utils import get_db_connection, hash_password
from auth_utils import admin_required
import psycopg2
import psycopg2.extras # For DictCursor
import re # For email validation

admin_bp = Blueprint('admin_bp', __name__)

# --- User Management ---
@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users_route(current_admin_user):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Fetch all users, excluding the password_hash for security
            # Order by created_at or name for consistent listing
            cur.execute("""
                SELECT id, name, email, role, is_active, created_at, updated_at 
                FROM users 
                ORDER BY created_at DESC
            """)
            users = cur.fetchall()
            
            # Convert datetime objects to ISO format strings for JSON compatibility
            users_list = []
            for user_record in users:
                user_dict = dict(user_record)
                for key, value in user_dict.items():
                    if hasattr(value, 'isoformat'):
                        user_dict[key] = value.isoformat()
                users_list.append(user_dict)

            return jsonify({"success": True, "data": users_list}), 200
            
    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error fetching users: {db_error}")
        return jsonify({"success": False, "message": "A database error occurred while fetching users."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error fetching users: {e}")
        return jsonify({"success": False, "message": "An unexpected error occurred."}), 500
    finally:
        if conn:
            conn.close()

@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user_route(current_admin_user):
    data = request.get_json()
    name = data.get('name')
    email = data.get('email', '').lower().strip()
    password = data.get('password')
    role = data.get('role', 'staff').lower()

    # --- Input Validation ---
    if not all([name, email, password]):
        return jsonify({"success": False, "message": "Name, email, and password are required."}), 400
    
    if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400
        
    if len(password) < 6: # Consider making password policy more robust
        return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400

    if role not in ['admin', 'staff']:
        return jsonify({"success": False, "message": "Invalid role. Must be 'admin' or 'staff'."}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Check if email already exists
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return jsonify({"success": False, "message": "Email address already in use."}), 409 # 409 Conflict

            hashed_user_password = hash_password(password)

            # Insert new user into the database
            cur.execute(
                """
                INSERT INTO users (name, email, password_hash, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, email, role, is_active, created_at, updated_at;
                """,
                (name, email, hashed_user_password, role)
            )
            new_user_record = cur.fetchone()
            conn.commit()

            if new_user_record:
                # Prepare user data for the response (excluding password_hash)
                user_data_for_response = dict(new_user_record)
                # Convert datetime objects to ISO format strings for JSON compatibility
                for key, value in user_data_for_response.items():
                    if hasattr(value, 'isoformat'): # Checks if it's a datetime object
                        user_data_for_response[key] = value.isoformat()
                
                return jsonify({
                    "success": True, 
                    "message": f"User '{name}' created successfully as {role}.", 
                    "data": user_data_for_response
                }), 201 # 201 Created
            else:
                # This should ideally not happen if RETURNING is used and insert was successful
                current_app.logger.error("User creation failed after insert attempt without specific DB error.")
                return jsonify({"success": False, "message": "Failed to create user. Please try again."}), 500

    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error during user creation: {db_error}")
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": "A database error occurred while creating the user."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error during user creation: {e}")
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": "An unexpected error occurred. Please try again."}), 500
    finally:
        if conn:
            conn.close()

@admin_bp.route('/users/<int:user_id_to_delete>', methods=['DELETE'])
@admin_required
def delete_user_route(current_admin_user, user_id_to_delete):
    # Prevent admin from deleting themselves
    if current_admin_user.get('id') == user_id_to_delete:
        return jsonify({"success": False, "message": "Administrators cannot delete their own account."}), 403 # Forbidden

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if the user to delete exists and is not the current admin (double check, though covered above)
            # This also helps confirm the user_id_to_delete is valid before attempting delete.
            cur.execute("SELECT id, role FROM users WHERE id = %s", (user_id_to_delete,))
            user_to_delete_record = cur.fetchone()

            if not user_to_delete_record:
                return jsonify({"success": False, "message": "User not found."}), 404

            # Optional: Add logic here if you want to prevent deletion of the *last* admin account
            # For example, count admin users, if this is the last one, prevent deletion.
            # cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            # admin_count = cur.fetchone()[0]
            # if user_to_delete_record[1] == 'admin' and admin_count <= 1:
            #     return jsonify({"success": False, "message": "Cannot delete the last administrator account."}), 403

            cur.execute("DELETE FROM users WHERE id = %s", (user_id_to_delete,))
            
            if cur.rowcount == 0:
                # This case should ideally be caught by the "User not found" check above
                # but serves as a fallback.
                conn.rollback() # Rollback if no rows were affected unexpectedly
                return jsonify({"success": False, "message": "User not found or already deleted."}), 404
            
            conn.commit()
            return jsonify({"success": True, "message": "User deleted successfully."}), 200

    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error during user deletion: {db_error}")
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": "A database error occurred while deleting the user."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error during user deletion: {e}")
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": "An unexpected error occurred. Please try again."}), 500
    finally:
        if conn:
            conn.close()

# --- Admin Statistics ---
@admin_bp.route('/stats', methods=['GET'])
@admin_required
def get_admin_stats_route(current_admin_user):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Total staff (users with role 'staff')
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'staff'")
            total_staff = cur.fetchone()['count']

            # Active staff
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'staff' AND is_active = TRUE")
            active_staff = cur.fetchone()['count']
            
            # Total users (admins + staff)
            cur.execute("SELECT COUNT(*) FROM users")
            total_users = cur.fetchone()['count']

            # Total cameras
            cur.execute("SELECT COUNT(*) FROM cameras")
            total_cameras = cur.fetchone()['count']
            
            # Active cameras
            cur.execute("SELECT COUNT(*) FROM cameras WHERE is_active = TRUE")
            active_cameras = cur.fetchone()['count']

            # Recent detections (e.g., in the last 24 hours, or total)
            # For simplicity, let's do total detections for now.
            # You might want to make this time-bound (e.g., last 24 hours, last 7 days)
            cur.execute("SELECT COUNT(*) FROM detection_logs")
            total_detections = cur.fetchone()['count']
            
            # Example: Detections in the last 24 hours
            cur.execute("SELECT COUNT(*) FROM detection_logs WHERE detected_at >= NOW() - INTERVAL '24 hours'")
            recent_detections_24h = cur.fetchone()['count']

            stats_data = {
                "totalUsers": total_users,
                "totalStaff": total_staff,
                "activeStaff": active_staff,
                "totalAdmins": total_users - total_staff, # Calculated
                "totalCameras": total_cameras,
                "activeCameras": active_cameras,
                "totalDetections": total_detections,
                "recentDetections24h": recent_detections_24h
                # Add more stats as needed
            }
            return jsonify({"success": True, "data": stats_data}), 200

    except psycopg2.Error as db_error:
        current_app.logger.error(f"Database error fetching admin stats: {db_error}")
        return jsonify({"success": False, "message": "A database error occurred while fetching admin statistics."}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error fetching admin stats: {e}")
        return jsonify({"success": False, "message": "An unexpected error occurred."}), 500
    finally:
        if conn:
            conn.close()