from flask import Flask, jsonify
from flask_cors import CORS
import os
import logging
from dotenv import load_dotenv

load_dotenv()

from routes.auth import auth_bp
from routes.admin_routes import admin_bp
from routes.dashboard_routes import dashboard_bp, get_yolo_model

app = Flask(__name__)
CORS(app) 

# Enable logging
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'camwatch-secret-key-fallback')

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

@app.route('/')
def home():
    return "CamWatch Backend is running! Now with DB authentication under /api/auth/."

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy", "message": "CamWatch Backend is running!"})

@app.route('/api/load-model')
def load_model_route():
    # Load model on first request
    get_yolo_model()
    return jsonify({"status": "success", "message": "YOLO model loaded successfully"})

# Or, simply preload the model on app startup (no decorator needed)
with app.app_context():
    try:
        app.logger.info("🔄 Pre-loading YOLO model during app startup...")
        get_yolo_model()
        app.logger.info("✅ YOLO model loaded successfully!")
    except Exception as e:
        app.logger.error(f"❌ Error loading model: {e}")

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'  # Default to True for debugging
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '127.0.0.1')
    
    app.logger.info(f"🚀 Starting Flask app on {host}:{port} (debug={debug_mode})")
    app.run(debug=debug_mode, host=host, port=port)