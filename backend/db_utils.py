import psycopg2
import psycopg2.extras
import os
import hashlib
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

def get_db_connection():
    """Establishes a connection to the PostgreSQL database using .env variables."""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            dbname=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432') # Default port if not specified
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to PostgreSQL: {e}")
        raise

def verify_password(stored_password_hash_with_salt, provided_password):
    """Verifies a provided password against a stored hash with salt."""
    if ':' not in stored_password_hash_with_salt:
        # Fallback for potentially unsalted passwords or different format (should not happen with register_admin.py)
        # This part might need adjustment if you have old password formats.
        # For now, assume direct comparison or a simple hash if no salt separator.
        # This is NOT secure for passwords hashed without salt.
        # If all passwords are created via register_admin.py, this branch is less likely.
        # For simplicity, let's assume the format from register_admin.py is always used.
        # If you expect other formats, this function needs to be more robust.
        print("Warning: Password hash format does not contain salt separator. Direct comparison or simple hashing might be insecure.")
        # Example: return hashlib.sha256(provided_password.encode('utf-8')).hexdigest() == stored_password_hash_with_salt
        return False # Or handle appropriately

    salt_hex, stored_hash = stored_password_hash_with_salt.split(':', 1)
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        print("Error: Invalid salt format.")
        return False
        
    hashed_provided_password = hashlib.sha256(salt + provided_password.encode('utf-8')).hexdigest()
    return hashed_provided_password == stored_hash

def get_user_by_email(email):
    """Fetches a user by email from the database."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = %s", (email,))
            user = cur.fetchone()
            return user # Returns a DictRow or None
    except psycopg2.Error as e:
        print(f"Database error fetching user by email '{email}': {e}")
        return None
    finally:
        if conn:
            conn.close()

# You can also move hash_password here if needed for other backend operations
def hash_password(password):
    """Hashes a password using SHA256 with a salt.
    The salt is prepended to the hash, separated by a colon.
    (Copied from register_admin.py for consistency if needed elsewhere in backend)
    """
    salt = os.urandom(16) # Generate a random salt
    salted_password = salt + password.encode('utf-8')
    hashed_password = hashlib.sha256(salted_password).hexdigest()
    return salt.hex() + ':' + hashed_password