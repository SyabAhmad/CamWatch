import jwt
import os
from functools import wraps
from flask import request, jsonify, current_app, g

def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({'success': False, 'message': 'Token is missing!'}), 401

        try:
            jwt_secret = os.getenv('JWT_SECRET')
            if not jwt_secret:
                current_app.logger.error("JWT_SECRET environment variable is not set.")
                return jsonify({'success': False, 'message': 'Server configuration error: JWT secret not found.'}), 500
            
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
            
            # Store essential user info from token in Flask's g object
            g.current_user_from_token = {
                'id': payload.get('user_id'), 
                'role': payload.get('role'), 
                'email': payload.get('email'),
                'name': payload.get('name') 
            }
            # For enhanced security, you might re-fetch user from DB here to check active status
            # e.g., user_db_record = get_user_by_id(g.current_user_from_token['id'])
            # if not user_db_record or not user_db_record['is_active']:
            #     return jsonify({'success': False, 'message': 'User not found or inactive.'}), 401
            # g.current_user = user_db_record # If fetched

        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Token is invalid!'}), 401
        except Exception as e:
            current_app.logger.error(f"Token validation error: {e}")
            return jsonify({'success': False, 'message': 'Error processing token.'}), 500
        
        # Pass the user data from token to the wrapped route function
        return f(g.current_user_from_token, *args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    @token_required # Ensures token_required runs first
    def decorated_function(current_user_from_token, *args, **kwargs):
        # current_user_from_token is passed by the token_required decorator
        if not current_user_from_token or current_user_from_token.get('role') != 'admin':
            return jsonify({'success': False, 'message': 'Admin access required!'}), 403
        return f(current_user_from_token, *args, **kwargs)
    return decorated_function