import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import apiService from '../services/apiService'; // Ensure this path is correct
import { showToast, camwatchToast } from '../utils/toast'; // Ensure this path is correct

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Webcam specific state
  const [webcamStream, setWebcamStream] = useState(null);
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const webcamVideoRef = useRef(null);
  const WEBCAM_CAMERA_INDEX = 0; // Designate the first camera for webcam
  const WEBCAM_PLACEHOLDER_ID = 'local-webcam-placeholder'; // Unique ID for placeholder

  useEffect(() => {
    fetchDashboardData();
    return () => {
      // Cleanup webcam stream if component unmounts
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboardData = async () => {
    setLoading(true);
    let fetchedCamerasData = []; // To store cameras from API

    try {
      const [camerasRes, detectionsRes] = await Promise.all([
        apiService.getDashboardCameras(),
        apiService.getDashboardRecentDetections()
      ]);

      if (camerasRes.success && Array.isArray(camerasRes.data)) {
        fetchedCamerasData = camerasRes.data;
      } else {
        camwatchToast.error(camerasRes.message || 'Failed to load cameras.');
        // fetchedCamerasData remains empty
      }

      if (fetchedCamerasData.length === 0) {
        // If no cameras from DB, or if DB fetch failed for cameras, create a placeholder
        const webcamPlaceholder = {
          id: WEBCAM_PLACEHOLDER_ID,
          name: 'Local Webcam',
          location: 'Your Computer',
          is_active: false, // Default to off for placeholder
          // ip_address, rtsp_url can be null or undefined for placeholder
        };
        setCameras([webcamPlaceholder]);
        setIsWebcamOn(webcamPlaceholder.is_active); // Initialize webcam state from placeholder
      } else {
        setCameras(fetchedCamerasData);
        // Initialize webcam state based on the designated DB camera's status
        if (fetchedCamerasData.length > WEBCAM_CAMERA_INDEX) {
          const webcamCam = fetchedCamerasData[WEBCAM_CAMERA_INDEX];
          setIsWebcamOn(webcamCam.is_active);
        }
      }

      if (detectionsRes.success && Array.isArray(detectionsRes.data)) {
        setRecentDetections(detectionsRes.data);
      } else {
        camwatchToast.error(detectionsRes.message || 'Failed to load recent detections.');
        setRecentDetections([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      camwatchToast.error('Could not fetch dashboard data. Network error or server issue.');
      // Ensure placeholder if all else fails and cameras array is still empty
      if (cameras.length === 0 && fetchedCamerasData.length === 0) { 
         const webcamPlaceholderOnError = {
          id: WEBCAM_PLACEHOLDER_ID,
          name: 'Local Webcam',
          location: 'Your Computer',
          is_active: false,
        };
        setCameras([webcamPlaceholderOnError]);
        setIsWebcamOn(webcamPlaceholderOnError.is_active);
      }
      setRecentDetections([]);
    } finally {
      setLoading(false);
    }
  };

  const startWebcam = async (cameraToUpdate) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setWebcamStream(stream);
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
        }
        setIsWebcamOn(true);
        // Only update backend if it's not the placeholder
        if (cameraToUpdate && cameraToUpdate.id !== WEBCAM_PLACEHOLDER_ID) {
          updateCameraStatusInDB(cameraToUpdate.id, true);
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        camwatchToast.error("Could not access webcam. Please check permissions.");
        setIsWebcamOn(false); // Ensure it's off if failed
      }
    } else {
      camwatchToast.error("Webcam not supported by this browser.");
    }
  };

  const stopWebcam = (cameraToUpdate) => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
    }
    setWebcamStream(null);
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setIsWebcamOn(false);
    // Only update backend if it's not the placeholder
    if (cameraToUpdate && cameraToUpdate.id !== WEBCAM_PLACEHOLDER_ID) {
      updateCameraStatusInDB(cameraToUpdate.id, false);
    }
  };

  const toggleWebcam = (camera) => {
    if (!camera) return; // Should not happen if cameras array always has at least one
    if (isWebcamOn) {
      stopWebcam(camera);
    } else {
      startWebcam(camera);
    }
  };
  
  const updateCameraStatusInDB = async (cameraId, isActive) => {
    // This function is now only called for actual DB cameras
    try {
      const res = await apiService.updateDashboardCameraStatus(cameraId, isActive);
      if (res.success) {
        setCameras(prevCameras => 
          prevCameras.map(cam => 
            cam.id === cameraId ? { ...cam, is_active: isActive } : cam
          )
        );
        showToast.success(`Camera ${isActive ? 'activated' : 'deactivated'}.`);
      } else {
        camwatchToast.error(res.message || 'Failed to update camera status.');
        // Revert UI state for the specific camera if backend update failed
        // This is tricky if it's the webcam, as isWebcamOn is separate.
        // For simplicity, we'll rely on the next fetch or user action to correct.
        // Or, more robustly:
        if (cameras.length > WEBCAM_CAMERA_INDEX && cameras[WEBCAM_CAMERA_INDEX].id === cameraId) {
            setIsWebcamOn(!isActive); // Revert webcam's specific on/off state
        }
        setCameras(prevCameras => 
          prevCameras.map(cam => 
            cam.id === cameraId ? { ...cam, is_active: !isActive } : cam
          )
        );
      }
    } catch (error) {
      console.error("Error updating camera status:", error);
      camwatchToast.error('Network error updating camera status.');
      if (cameras.length > WEBCAM_CAMERA_INDEX && cameras[WEBCAM_CAMERA_INDEX].id === cameraId) {
        setIsWebcamOn(!isActive);
      }
       setCameras(prevCameras => 
          prevCameras.map(cam => 
            cam.id === cameraId ? { ...cam, is_active: !isActive } : cam
          )
        );
    }
  };

  const handleLogout = () => {
    // Ensure cameras[WEBCAM_CAMERA_INDEX] exists before trying to stop webcam
    if (isWebcamOn && cameras.length > WEBCAM_CAMERA_INDEX && cameras[WEBCAM_CAMERA_INDEX]) {
        stopWebcam(cameras[WEBCAM_CAMERA_INDEX]); // Pass the camera object
    }
    logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan-start mx-auto mb-4"></div>
          Loading dashboard data...
        </div>
      </div>
    );
  }
  
  // Display up to 4 cameras. If placeholder is used, it will be the first.
  // If DB cameras are fetched, they will be used.
  const displayCameras = cameras.slice(0, 4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary">Staff Dashboard</h1>
            <p className="text-gray-300 mt-2">Welcome back, {user?.name || 'Staff'}</p>
          </div>
          <div className="flex space-x-4">
            {user?.role === 'admin' && (
              <Link 
                to="/admin"
                className="bg-gradient-to-r from-brand-purple-start to-brand-pink-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Admin Panel
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-brand-red-start to-brand-orange-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105 shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Camera Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {displayCameras.map((camera, index) => (
            <div key={camera.id} className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">{camera.name}</h3>
                  <span className={`w-3 h-3 rounded-full ${
                    // For webcam slot (index 0), status dot reflects local isWebcamOn state.
                    // For other DB cameras, it reflects camera.is_active from DB.
                    index === WEBCAM_CAMERA_INDEX ? (isWebcamOn ? 'bg-green-500 animate-pulse' : 'bg-red-500') : (camera.is_active ? 'bg-green-500' : 'bg-red-500')
                  }`}></span>
                </div>
                <p className="text-gray-300 text-sm mb-4">{camera.location}</p>
                <div className={`bg-gray-800 rounded-2xl h-40 flex items-center justify-center overflow-hidden ${index === WEBCAM_CAMERA_INDEX && isWebcamOn ? 'border-2 border-green-500' : ''}`}>
                  {index === WEBCAM_CAMERA_INDEX ? (
                    <video ref={webcamVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isWebcamOn ? 'hidden' : ''}`}></video>
                  ) : null}
                  {index === WEBCAM_CAMERA_INDEX && !isWebcamOn && (
                     <span className="text-5xl opacity-50">📹</span>
                  )}
                  {index !== WEBCAM_CAMERA_INDEX && ( // Placeholder for other cameras
                     <span className="text-5xl opacity-50">📷</span>
                  )}
                </div>
              </div>
              {/* Show toggle button only for the first camera slot (webcam) */}
              {index === WEBCAM_CAMERA_INDEX && (
                <button
                  onClick={() => toggleWebcam(camera)} // camera here will be the placeholder if no DB cameras
                  className={`mt-4 w-full py-2 px-4 rounded-xl font-semibold transition-all duration-300 text-sm
                    ${isWebcamOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white shadow-md`}
                >
                  {isWebcamOn ? 'Turn Off Webcam' : 'Turn On Webcam'}
                </button>
              )}
            </div>
          ))}
          {/* This condition should now only be true if loading is false AND displayCameras is still empty, 
              which is less likely with the placeholder logic unless an error occurs before placeholder setup.
              The placeholder logic aims to always have at least one camera for the webcam.
          */}
          {displayCameras.length === 0 && !loading && (
            <p className="col-span-full text-center text-gray-400 py-10">Error displaying cameras.</p>
          )}
        </div>

        {/* Recent Detections */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-bold text-white">Recent Threat Detections</h2>
          </div>
          <div className="overflow-x-auto">
            {recentDetections.length > 0 ? (
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
                    <tr key={detection.id} className="hover:bg-white/5 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          detection.detection_type === 'weapon' ? 'bg-red-500/30 text-red-200 border border-red-500/50' :
                          detection.detection_type === 'violence' ? 'bg-orange-500/30 text-orange-200 border border-orange-500/50' :
                          'bg-yellow-500/30 text-yellow-200 border border-yellow-500/50' // Default for intrusion or other
                        }`}>
                          {detection.detection_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.confidence ? (detection.confidence * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.camera_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.detected_at ? new Date(detection.detected_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-gray-400 py-10">No recent detections.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;