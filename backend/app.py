from flask import Flask, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()

from routes.auth import auth_bp
from routes.admin_routes import admin_bp
from routes.dashboard_routes import dashboard_bp # Import the new dashboard blueprint

app = Flask(__name__)
CORS(app) 

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'camwatch-secret-key-fallback')

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard') # Add URL prefix

@app.route('/')
def home():
    return "CamWatch Backend is running! Auth: /api/auth/, Admin: /api/admin/, Dashboard: /api/dashboard/."

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '127.0.0.1')
    app.run(debug=debug_mode, host=host, port=port)