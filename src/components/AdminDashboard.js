import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast, camwatchToast } from '../utils/toast';
import LottieLoader from './common/LottieLoader';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaff: 0,
    totalCameras: 0,
    activeCameras: 0,
    recentDetections: 0,
    totalDetections: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Use direct methods instead of admin.getUsers()
      const [usersResponse, statsResponse] = await Promise.all([
        apiService.getUsers(),        // Instead of apiService.admin.getUsers()
        apiService.getAdminStats()    // Instead of apiService.admin.getStats()
      ]);

      if (usersResponse.success) {
        setUsers(usersResponse.data);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      camwatchToast.networkError();
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = async (userId, currentStatus) => {
    try {
      // Use direct method instead of admin.toggleUserStatus()
      const response = await apiService.updateUser(userId, { is_active: !currentStatus });
      
      if (response.success) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, is_active: !currentStatus } : user
        ));
        
        const statsResponse = await apiService.getAdminStats();
        if (statsResponse.success) {
          setStats(statsResponse.data);
        }
        
        showToast.success(
          `User ${!currentStatus ? 'activated' : 'deactivated'} successfully!`
        );
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      camwatchToast.loginError(error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        // Use direct method instead of admin.deleteUser()
        const response = await apiService.deleteUser(userId);
        
        if (response.success) {
          setUsers(users.filter(user => user.id !== userId));
          
          const statsResponse = await apiService.getAdminStats();
          if (statsResponse.success) {
            setStats(statsResponse.data);
          }
          
          showToast.success('User deleted successfully!');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        camwatchToast.loginError(error.message);
      }
    }
  };

  const handleLogout = () => {
    logout();
    camwatchToast.info('You have been logged out.');
    navigate('/login'); // Redirect to login page after logout
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
          <LottieLoader type="spinner" size={60} showMessage={true} message="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gradient-primary">Admin Dashboard</h1>
              <p className="text-gray-300 mt-2">Manage CamWatch users and system settings</p>
            </div>
            <div className="flex items-center space-x-3">
              <Link 
                to="/dashboard"
                className="bg-gradient-to-r from-brand-purple-start to-brand-pink-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105"
              >
                Main Dashboard
              </Link>
              <button
                onClick={() => setShowAddUser(true)}
                className="bg-gradient-to-r from-brand-cyan-start to-brand-blue-end text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105"
              >
                Add New Staff
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-brand-blue-start to-brand-cyan-start rounded-2xl flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-300 text-sm">Total Staff</p>
                <p className="text-2xl font-bold text-white">{stats.totalStaff}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-brand-emerald-start to-brand-emerald-end rounded-2xl flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-300 text-sm">Active Staff</p>
                <p className="text-2xl font-bold text-white">{stats.activeStaff}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-brand-purple-start to-brand-pink-start rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📹</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-300 text-sm">Active Cameras</p>
                <p className="text-2xl font-bold text-white">{stats.activeCameras}/{stats.totalCameras}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-brand-orange-start to-brand-red-start rounded-2xl flex items-center justify-center">
                <span className="text-2xl">🚨</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-300 text-sm">Recent Detections</p>
                <p className="text-2xl font-bold text-white">{stats.recentDetections}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-bold text-white">Staff Management</h2>
            <p className="text-gray-300 text-sm mt-1">Manage user accounts and permissions</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-brand-cyan-start to-brand-blue-end rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">{user.name}</div>
                          <div className="text-sm text-gray-300">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-brand-purple-start/20 text-purple-300' 
                          : 'bg-brand-cyan-start/20 text-cyan-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        user.is_active 
                          ? 'bg-brand-emerald-start/20 text-emerald-300' 
                          : 'bg-brand-red-start/20 text-red-300'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUserToggle(user.id, user.is_active)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                            user.is_active
                              ? 'bg-brand-orange-start/20 text-orange-300 hover:bg-brand-orange-start/30'
                              : 'bg-brand-emerald-start/20 text-emerald-300 hover:bg-brand-emerald-start/30'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1 bg-brand-red-start/20 text-red-300 rounded-full text-xs font-medium hover:bg-brand-red-start/30 transition-all duration-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <AddUserModal 
          onClose={() => setShowAddUser(false)} 
          onUserAdded={(newUser) => {
            setUsers([...users, newUser]);
            fetchDashboardData(); // Refresh stats
            setShowAddUser(false);
          }} 
        />
      )}
    </div>
  );
};

// Add User Modal Component with real API integration
const AddUserModal = ({ onClose, onUserAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Use direct method instead of admin.createUser()
      const response = await apiService.createUser(formData);
      
      if (response.success) {
        onUserAdded(response.data);
        showToast.success('User added successfully!');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Add New Staff Member</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors duration-300"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

          {errors.general && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm mb-6">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  errors.name ? 'border-red-500/50' : 'border-white/20'
                } rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan-start focus:border-transparent transition-all duration-300`}
                placeholder="John Doe"
              />
              {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  errors.email ? 'border-red-500/50' : 'border-white/20'
                } rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan-start focus:border-transparent transition-all duration-300`}
                placeholder="john@school.edu"
              />
              {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  errors.password ? 'border-red-500/50' : 'border-white/20'
                } rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan-start focus:border-transparent transition-all duration-300`}
                placeholder="Enter password"
              />
              {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan-start focus:border-transparent transition-all duration-300"
              >
                <option value="staff" className="bg-slate-800">Staff Member</option>
                <option value="admin" className="bg-slate-800">Administrator</option>
              </select>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/10 border border-white/20 text-white py-3 rounded-2xl font-medium hover:bg-white/20 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-brand-cyan-start to-brand-blue-end text-white py-3 rounded-2xl font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LottieLoader type="spinner" size={16} showMessage={false} />
                    <span>Adding...</span>
                  </div>
                ) : (
                  'Add User'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;