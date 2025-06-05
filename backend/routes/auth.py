from flask import Blueprint, request, jsonify, current_app
from db_utils import get_user_by_email, verify_password # Corrected relative import
import jwt
import datetime
import os

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/login', methods=['POST']) # Changed from '/api/login' to '/login'
def login():
    data = request.get_json()
    email = data.get('email', '').lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    user_record = get_user_by_email(email)

    if not user_record:
        return jsonify({"success": False, "message": "User not found or invalid credentials"}), 401

    if not user_record['is_active']:
        return jsonify({"success": False, "message": "Account is inactive. Please contact administrator."}), 403

    if verify_password(user_record['password_hash'], password):
        token_payload = {
            'user_id': user_record['id'],
            'role': user_record['role'],
            'name': user_record['name'],
            'email': user_record['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }
        try:
            jwt_secret = os.getenv('JWT_SECRET', current_app.config.get('SECRET_KEY', 'default-secret-for-dev'))
            if jwt_secret in ['default-secret-for-dev', 'your-super-secret-jwt-key-change-this-in-production']:
                 current_app.logger.warning("Using default or placeholder JWT secret. Set a strong JWT_SECRET in .env for production.")

            token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
            
            return jsonify({
                "success": True,
                "message": "Login successful",
                "token": token,
                "user": {
                    "id": user_record['id'],
                    "name": user_record['name'],
                    "email": user_record['email'],
                    "role": user_record['role']
                }
            }), 200
        except Exception as e:
            current_app.logger.error(f"Error encoding JWT: {e}")
            return jsonify({"success": False, "message": "Could not generate token"}), 500
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401