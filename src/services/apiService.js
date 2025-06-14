class ApiService {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
  }

  // Get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    console.log("ApiService.request called:", { url, options });
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };

    // If using fetch, body must be a string for POST
    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    console.log("Fetch config:", { url, method: config.method, headers: config.headers });

    try {
      console.log("Making fetch request...");
      const response = await fetch(url, config);
      console.log("Fetch response received:", { status: response.status, ok: response.ok });
      
      const data = await response.json();
      console.log("Response data:", data);
      return data;
    } catch (error) {
      console.error("Fetch error:", error);
      return { success: false, message: 'Network error', error };
    }
  }

  // Auth methods
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async verifyToken() {
    return this.request('/auth/verify');
  }

  // Dashboard methods
  async getDashboardStats() { // This was for admin, maybe rename or make generic
    return this.request('/dashboard/stats'); // Assuming a general stats endpoint exists or will be made
  }

  async getDashboardCameras() {
    return this.request('/dashboard/cameras');
  }

  async updateDashboardCameraStatus(cameraId, isActive) {
    return this.request(`/dashboard/cameras/${cameraId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  async getDashboardRecentDetections() { // Renamed for clarity from getRecentDetections
    return this.request('/dashboard/recent-detections');
  }

  // Add this new method
  async analyzeFrame(imageBase64) {
    try {
      console.log(`Analyzing frame. Image data length: ${imageBase64.length}`);
      console.log(`Auth headers present: ${!!this.getAuthHeaders().Authorization}`);
      
      const response = await fetch(`${this.baseURL}/dashboard/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ image_b64: imageBase64 })
      });
      
      console.log('Frame analysis response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Analysis error (${response.status}):`, errorText);
        return { 
          success: false, 
          message: `Server error: ${response.status} ${response.statusText}`,
          details: errorText
        };
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing frame:', error);
      return { 
        success: false, 
        message: 'Network error analyzing frame', 
        error: error.toString() 
      };
    }
  }

  // Admin methods
  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getUsers() {
    return this.request('/admin/users');
  }

  async createUser(userData) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId, userData) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getCameras() {
    return this.request('/admin/cameras');
  }

  async createCamera(cameraData) {
    return this.request('/admin/cameras', {
      method: 'POST',
      body: JSON.stringify(cameraData),
    });
  }

  async updateCamera(cameraId, cameraData) {
    return this.request(`/admin/cameras/${cameraId}`, {
      method: 'PUT',
      body: JSON.stringify(cameraData),
    });
  }

  async deleteCamera(cameraId) {
    return this.request(`/admin/cameras/${cameraId}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  async getLatestDetection() {
    return this.request('/dashboard/latest-detection');
  }
}

const apiService = new ApiService();
export default apiService;