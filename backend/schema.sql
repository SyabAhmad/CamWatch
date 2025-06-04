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

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- =================================
-- Cameras Table
-- =================================
CREATE TABLE IF NOT EXISTS cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    ip_address INET,
    rtsp_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for cameras table
CREATE INDEX IF NOT EXISTS idx_cameras_active ON cameras(is_active);
CREATE INDEX IF NOT EXISTS idx_cameras_location ON cameras(location);

-- =================================
-- Detection Logs (After AI Detection)
-- =================================
CREATE TABLE IF NOT EXISTS detection_logs (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    detection_type VARCHAR(50) NOT NULL, -- 'weapon', 'violence', 'intrusion', etc.
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    image_path VARCHAR(500),
    video_path VARCHAR(500),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for detection_logs table
CREATE INDEX IF NOT EXISTS idx_detection_logs_camera_id ON detection_logs(camera_id);
CREATE INDEX IF NOT EXISTS idx_detection_logs_type ON detection_logs(detection_type);
CREATE INDEX IF NOT EXISTS idx_detection_logs_detected_at ON detection_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_detection_logs_confidence ON detection_logs(confidence);
