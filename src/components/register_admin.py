import psycopg2
import psycopg2.extras # For DictCursor
import hashlib
import getpass
import os

# Default admin details
ADMIN_EMAIL_DEFAULT = 'admin@example.com'
ADMIN_NAME_DEFAULT = 'Administrator'

def get_db_connection_details():
    """Gets PostgreSQL connection details from environment variables or user input."""
    details = {
        'host': os.environ.get('PGHOST', 'localhost'),
        'port': os.environ.get('PGPORT', '5432'),
        'dbname': os.environ.get('PGDATABASE', 'camwatch_db'),
        'user': os.environ.get('PGUSER', 'postgres'),
        'password': os.environ.get('PGPASSWORD', '')
    }

    print("--- Database Connection Details ---")
    print(f"Current settings (values in () are defaults or from ENV):")
    details['host'] = input(f"Enter PostgreSQL host ({details['host']}): ") or details['host']
    details['port'] = input(f"Enter PostgreSQL port ({details['port']}): ") or details['port']
    details['dbname'] = input(f"Enter PostgreSQL database name ({details['dbname']}): ") or details['dbname']
    details['user'] = input(f"Enter PostgreSQL user ({details['user']}): ") or details['user']
    
    # Prompt for password if not set via environment variable
    if not details['password']:
        details['password'] = getpass.getpass(f"Enter PostgreSQL password for user '{details['user']}': ")
    else:
        print(f"Using password from PGPASSWORD environment variable.")
        
    return details

def get_db_connection(conn_details):
    """Establishes a connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(**conn_details)
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to PostgreSQL: {e}")
        print("Please ensure PostgreSQL is running and connection details are correct.")
        raise

def init_db(conn):
    """Initializes the database and creates the users table if it doesn't exist,
       based on the provided schema.
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    role VARCHAR(20) CHECK (role IN ('admin', 'staff')) NOT NULL DEFAULT 'staff',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Optionally, create indexes if they might not exist
            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")
            conn.commit()
        print(f"Database initialized and 'users' table ensured in '{conn.get_dsn_parameters()['dbname']}'.")
    except psycopg2.Error as e:
        print(f"Database error during initialization: {e}")
        conn.rollback() # Rollback changes if an error occurs
        raise

def hash_password(password):
    """Hashes a password using SHA256 with a salt.
    The salt is prepended to the hash, separated by a colon.
    """
    salt = os.urandom(16) # Generate a random salt
    salted_password = salt + password.encode('utf-8')
    hashed_password = hashlib.sha256(salted_password).hexdigest()
    return salt.hex() + ':' + hashed_password # Store salt with hash

def admin_exists(conn):
    """Checks if an admin user already exists in the database."""
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")
            admin = cur.fetchone()
            return admin is not None
    except psycopg2.Error as e:
        print(f"Database error while checking for admin: {e}")
        return True # Assume admin exists or error prevents checking, to be safe
    
def email_exists(conn, email):
    """Checks if a specific email already exists in the database."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE email = %s LIMIT 1", (email,))
            return cur.fetchone() is not None
    except psycopg2.Error as e:
        print(f"Database error checking email '{email}': {e}")
        return True # Assume exists to prevent issues

def create_admin_user(conn, email, password, name):
    """Creates an admin user in the database."""
    if not email or not password or not name:
        print("Email, password, and name cannot be empty.")
        return False

    hashed_password_with_salt = hash_password(password)
    
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, password_hash, name, role) 
                VALUES (%s, %s, %s, 'admin')
                RETURNING id;
                """,
                (email, hashed_password_with_salt, name)
            )
            admin_id = cur.fetchone()[0]
            conn.commit()
            print(f"Admin user '{name}' with email '{email}' (ID: {admin_id}) created successfully.")
            return True
    except psycopg2.IntegrityError:
        print(f"Error: Email '{email}' already exists or another integrity constraint failed.")
        conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f"Database error during admin creation: {e}")
        conn.rollback()
        return False

def main():
    """Main function to run the admin registration script."""
    print("--- PostgreSQL Admin Registration Script ---")
    
    conn = None
    try:
        conn_details = get_db_connection_details()
        conn = get_db_connection(conn_details)
        
        init_db(conn) # Ensure users table exists

        if admin_exists(conn):
            print("An admin user (role='admin') already exists in the database. No action taken.")
        else:
            print("\nNo admin user found. Proceeding with admin creation.")
            
            admin_email = ""
            while not admin_email:
                admin_email_input = input(f"Enter email for the admin (default: {ADMIN_EMAIL_DEFAULT}): ").strip()
                admin_email = admin_email_input if admin_email_input else ADMIN_EMAIL_DEFAULT
                
                if not admin_email: # Should not happen with default, but good check
                    print("Email cannot be empty.")
                    continue

                if email_exists(conn, admin_email):
                    print(f"Email '{admin_email}' already exists. Please choose a different email.")
                    admin_email = "" # Reset to loop again
            
            admin_name = ""
            while not admin_name:
                admin_name_input = input(f"Enter name for the admin '{admin_email}' (default: {ADMIN_NAME_DEFAULT}): ").strip()
                admin_name = admin_name_input if admin_name_input else ADMIN_NAME_DEFAULT
                if not admin_name:
                    print("Name cannot be empty.")

            admin_password = ""
            while True:
                admin_password = getpass.getpass(f"Enter password for admin '{admin_name}' ({admin_email}): ")
                if not admin_password:
                    print("Password cannot be empty. Please try again.")
                    continue
                admin_password_confirm = getpass.getpass("Confirm password: ")
                if admin_password == admin_password_confirm:
                    break
                else:
                    print("Passwords do not match. Please try again.")
            
            if create_admin_user(conn, admin_email, admin_password, admin_name):
                print("Admin setup complete.")
            else:
                print("Admin setup failed.")

    except (psycopg2.Error, KeyboardInterrupt) as e:
        if isinstance(e, KeyboardInterrupt):
            print("\nOperation cancelled by user.")
        else:
            # Error already printed by specific functions or get_db_connection
            print("An error occurred. Exiting.")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

    print("--- Admin Registration Script Finished ---")

if __name__ == '__main__':
    main()