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
}

const apiService = new ApiService();
export default apiService;