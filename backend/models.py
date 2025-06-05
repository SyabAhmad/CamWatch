from datetime import datetime
# If you're using Flask-SQLAlchemy, you would typically import `db` from your app setup
# For example: from . import db # Assuming db = SQLAlchemy() is initialized in your app's __init__.py or app.py

class User:
    # In SQLAlchemy, this would be:
    # id = db.Column(db.Integer, primary_key=True)
    # email = db.Column(db.String(255), unique=True, nullable=False)
    # password_hash = db.Column(db.String(255), nullable=False)
    # name = db.Column(db.String(100), nullable=False)
    # role = db.Column(db.String(20), nullable=False, default='staff') # Add CHECK constraint in DB
    # is_active = db.Column(db.Boolean, default=True)
    # created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    # updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    # detection_logs = db.relationship('DetectionLog', backref='user', lazy=True) # If users are linked to logs

    def __init__(self, email, password_hash, name, role='staff', is_active=True, id=None, created_at=None, updated_at=None):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.name = name
        self.role = role
        self.is_active = is_active
        self.created_at = created_at if created_at else datetime.utcnow()
        self.updated_at = updated_at if updated_at else datetime.utcnow()

    def __repr__(self):
        return f"<User {self.id}: {self.email} ({self.role})>"

    # Example methods for CRUD (Create, Read, Update, Delete) operations
    # These would typically interact with a database session if using an ORM
    # def save_to_db(self):
    #     db.session.add(self)
    #     db.session.commit()
    #
    # def delete_from_db(self):
    #     db.session.delete(self)
    #     db.session.commit()
    #
    # @classmethod
    # def find_by_email(cls, email):
    #     return cls.query.filter_by(email=email).first()
    #
    # @classmethod
    # def find_by_id(cls, _id):
    #     return cls.query.filter_by(id=_id).first()

class Camera:
    # In SQLAlchemy:
    # id = db.Column(db.Integer, primary_key=True)
    # name = db.Column(db.String(100), nullable=False)
    # location = db.Column(db.String(255), nullable=False)
    # ip_address = db.Column(db.String(45)) # Using String for INET for broader compatibility, or specific type if available
    # rtsp_url = db.Column(db.String(500))
    # is_active = db.Column(db.Boolean, default=True)
    # created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    # updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    # detection_logs = db.relationship('DetectionLog', backref='camera', lazy=True, cascade="all, delete-orphan")

    def __init__(self, name, location, ip_address=None, rtsp_url=None, is_active=True, id=None, created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.location = location
        self.ip_address = ip_address
        self.rtsp_url = rtsp_url
        self.is_active = is_active
        self.created_at = created_at if created_at else datetime.utcnow()
        self.updated_at = updated_at if updated_at else datetime.utcnow()

    def __repr__(self):
        return f"<Camera {self.id}: {self.name} at {self.location}>"

class DetectionLog:
    # In SQLAlchemy:
    # id = db.Column(db.Integer, primary_key=True)
    # camera_id = db.Column(db.Integer, db.ForeignKey('cameras.id'), nullable=False)
    # detection_type = db.Column(db.String(50), nullable=False)
    # confidence = db.Column(db.Numeric(5, 4), nullable=False) # Add CHECK constraint in DB
    # image_path = db.Column(db.String(500))
    # video_path = db.Column(db.String(500))
    # detected_at = db.Column(db.DateTime(timezone=True), nullable=False)
    # created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    def __init__(self, camera_id, detection_type, confidence, detected_at, image_path=None, video_path=None, id=None, created_at=None):
        self.id = id
        self.camera_id = camera_id
        self.detection_type = detection_type
        self.confidence = confidence
        self.image_path = image_path
        self.video_path = video_path
        self.detected_at = detected_at
        self.created_at = created_at if created_at else datetime.utcnow()

    def __repr__(self):
        return f"<DetectionLog {self.id}: {self.detection_type} on Camera {self.camera_id} at {self.detected_at}>"

# To use these models with Flask-SQLAlchemy, you would:
# 1. Initialize SQLAlchemy in your main app file (e.g., app.py or backend/__init__.py):
#    from flask_sqlalchemy import SQLAlchemy
#    db = SQLAlchemy()
#    def create_app():
#        app = Flask(__name__)
#        app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:password@host:port/database' # Your DB connection string
#        db.init_app(app)
#        return app
#
# 2. Define your models inheriting from db.Model:
#    class User(db.Model):
#        __tablename__ = 'users' # Explicitly set table name
#        id = db.Column(db.Integer, primary_key=True)
#        # ... other columns
#
# 3. Create the tables in the database:
#    In a Flask shell (flask shell):
#    >>> from your_app import db, create_app
#    >>> app = create_app()
#    >>> with app.app_context():
#    ...     db.create_all()
#
# 4. Then you can use db.session to add, query, update, delete records.
#    Example:
#    new_user = User(email='test@example.com', password_hash='hashed_password', name='Test User')
#    db.session.add(new_user)
#    db.session.commit()
#    users = User.query.all()
