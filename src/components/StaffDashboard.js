import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Mock data - replace with actual API calls
      const mockCameras = [
        { id: 1, name: 'Camera 1', location: 'Main Entrance', status: 'online' },
        { id: 2, name: 'Camera 2', location: 'Cafeteria', status: 'online' },
        { id: 3, name: 'Camera 3', location: 'Hallway A', status: 'offline' },
        { id: 4, name: 'Camera 4', location: 'Playground', status: 'online' }
      ];

      const mockDetections = [
        { id: 1, type: 'weapon', confidence: 0.85, camera: 'Camera 1', time: '2 hours ago' },
        { id: 2, type: 'violence', confidence: 0.78, camera: 'Camera 2', time: '4 hours ago' },
        { id: 3, type: 'intrusion', confidence: 0.92, camera: 'Camera 4', time: '6 hours ago' }
      ];

      setCameras(mockCameras);
      setRecentDetections(mockDetections);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan-start mx-auto"></div>
          <p className="text-white mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary">Staff Dashboard</h1>
            <p className="text-gray-300 mt-2">Welcome back, {user?.name}</p>
          </div>
          <div className="flex space-x-4">
            {user?.role === 'admin' && (
              <Link 
                to="/admin"
                className="bg-gradient-to-r from-brand-purple-start to-brand-pink-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105"
              >
                Admin Panel
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-brand-red-start to-brand-orange-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Camera Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {cameras.map((camera) => (
            <div key={camera.id} className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{camera.name}</h3>
                <span className={`w-3 h-3 rounded-full ${
                  camera.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
              </div>
              <p className="text-gray-300 text-sm mb-4">{camera.location}</p>
              <div className="bg-gray-800 rounded-2xl h-32 flex items-center justify-center">
                <span className="text-4xl">📹</span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Detections */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-bold text-white">Recent Threat Detections</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Camera</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {recentDetections.map((detection) => (
                  <tr key={detection.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        detection.type === 'weapon' ? 'bg-red-500/20 text-red-300' :
                        detection.type === 'violence' ? 'bg-orange-500/20 text-orange-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {detection.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {(detection.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {detection.camera}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {detection.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;