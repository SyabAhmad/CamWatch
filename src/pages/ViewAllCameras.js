import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { camwatchToast } from '../utils/toast';

const ViewAllCameras = () => {
  const { user } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const WEBCAM_PLACEHOLDER_ID = 'local-webcam-placeholder';

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    setLoading(true);
    try {
      const res = await apiService.getDashboardCameras();
      
      if (res.success && Array.isArray(res.data)) {
        // Make sure webcam is first
        const webcamIndex = res.data.findIndex(cam => cam.id === WEBCAM_PLACEHOLDER_ID);
        let orderedCameras = [...res.data];
        
        // If no webcam in the list, add it
        if (webcamIndex === -1) {
          const webcam = {
            id: WEBCAM_PLACEHOLDER_ID,
            name: 'Local Webcam',
            location: 'Your Computer',
            is_active: false,
            status: 'available'
          };
          orderedCameras = [webcam, ...orderedCameras];
        } 
        // If webcam exists but not first, move it to first position
        else if (webcamIndex > 0) {
          const webcam = orderedCameras.splice(webcamIndex, 1)[0];
          orderedCameras = [webcam, ...orderedCameras];
        }
        
        // Add 6 "coming soon" cameras
        const totalCameras = orderedCameras.length;
        if (totalCameras < 12) {
          for (let i = 0; i < (12 - totalCameras); i++) {
            orderedCameras.push({
              id: `coming-soon-${i}`,
              name: 'Coming Soon',
              location: 'Future Location',
              is_active: false,
              status: 'coming-soon'
            });
          }
        }
        
        setCameras(orderedCameras);
      } else {
        camwatchToast.error(res.message || 'Failed to load cameras');
        
        // Create webcam as fallback
        const webcam = {
          id: WEBCAM_PLACEHOLDER_ID,
          name: 'Local Webcam',
          location: 'Your Computer',
          is_active: false,
          status: 'available'
        };
        
        // Add 6 "coming soon" cameras
        const comingSoonCameras = Array(11).fill(0).map((_, i) => ({
          id: `coming-soon-${i}`,
          name: 'Coming Soon',
          location: 'Future Location',
          is_active: false,
          status: 'coming-soon'
        }));
        
        setCameras([webcam, ...comingSoonCameras]);
      }
    } catch (error) {
      console.error('Error fetching cameras:', error);
      camwatchToast.error('Could not fetch cameras');
      
      // Create fallback data
      const webcam = {
        id: WEBCAM_PLACEHOLDER_ID,
        name: 'Local Webcam',
        location: 'Your Computer',
        is_active: false,
        status: 'available'
      };
      
      const comingSoonCameras = Array(6).fill(0).map((_, i) => ({
        id: `coming-soon-${i}`,
        name: 'Coming Soon',
        location: 'Future Location',
        is_active: false,
        status: 'coming-soon'
      }));
      
      setCameras([webcam, ...comingSoonCameras]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan-start mx-auto mb-2"></div>
          <p className="text-sm">Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary">All Cameras</h1>
            <p className="text-gray-300 mt-2">Monitoring system overview</p>
          </div>
          <div className="flex space-x-4">
            <Link 
              to="/dashboard"
              className="bg-gradient-to-r from-brand-blue-start to-brand-cyan-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105 shadow-lg"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Camera Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {cameras.map((camera) => (
            <div 
              key={camera.id} 
              className={`bg-white/10 backdrop-blur-lg rounded-2xl border overflow-hidden shadow-lg
                ${camera.status === 'coming-soon' 
                  ? 'border-gray-500/30 opacity-60' 
                  : camera.is_active 
                    ? 'border-green-500/50' 
                    : 'border-white/20'
                }
              `}
            >
              <div className="h-40 bg-gray-800 relative">
                {camera.status === 'coming-soon' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl opacity-30">🎥</span>
                    <div className="absolute top-0 right-0 left-0 bg-gray-800/80 text-center py-2">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-6xl opacity-30">🎥</span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        camera.is_active 
                          ? 'bg-green-700/70 text-green-200' 
                          : 'bg-gray-700/70 text-gray-300'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${
                          camera.is_active ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                        }`}></span>
                        {camera.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{camera.name}</h3>
                    <p className="text-sm text-gray-300">{camera.location}</p>
                  </div>
                </div>

                {camera.status !== 'coming-soon' && (
                  <div className="mt-4 flex">
                    <Link 
                    //   to={`/dashboard?camera=${camera.id}`}
                      to={`/dashboard`}
                      className="bg-gradient-to-r from-brand-purple-start to-brand-pink-start text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 shadow-md flex-1 text-center"
                    >
                      Go to Camera
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ViewAllCameras;