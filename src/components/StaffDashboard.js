import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import apiService from '../services/apiService';
import { showToast, camwatchToast } from '../utils/toast';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [riskyDetections, setRiskyDetections] = useState([]); // New state for risky detections
  const [loading, setLoading] = useState(true);

  // Webcam state
  const [webcamStream, setWebcamStream] = useState(null);
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const webcamVideoRef = useRef(null);
  const WEBCAM_CAMERA_INDEX = 0;
  const WEBCAM_PLACEHOLDER_ID = 'local-webcam-placeholder';

  // Detection state
  const [detectionStatus, setDetectionStatus] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);
  const detectionIntervalRef = useRef(null);

  // Add a ref to track webcam state immediately
  const webcamStateRef = useRef(false);

  useEffect(() => {
    webcamStateRef.current = isWebcamOn;
  }, [isWebcamOn]);

  useEffect(() => {
    fetchDashboardData();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    let fetchedCamerasData = [];

    try {
      const [camerasRes, detectionsRes] = await Promise.all([
        apiService.getDashboardCameras(),
        apiService.getDashboardRecentDetections()
      ]);

      // Process cameras data
      if (camerasRes.success && Array.isArray(camerasRes.data)) {
        fetchedCamerasData = camerasRes.data;
      } else {
        camwatchToast.error(camerasRes.message || 'Failed to load cameras.');
      }

      if (fetchedCamerasData.length === 0) {
        const webcamPlaceholder = {
          id: WEBCAM_PLACEHOLDER_ID,
          name: 'Local Webcam',
          location: 'Your Computer',
          is_active: false,
        };
        setCameras([webcamPlaceholder]);
        setIsWebcamOn(webcamPlaceholder.is_active);
      } else {
        setCameras(fetchedCamerasData);
        if (fetchedCamerasData.length > WEBCAM_CAMERA_INDEX) {
          const webcamCam = fetchedCamerasData[WEBCAM_CAMERA_INDEX];
          setIsWebcamOn(webcamCam.is_active);
        }
      }

      // Process detections data
      if (detectionsRes.success && Array.isArray(detectionsRes.data)) {
        setRecentDetections(detectionsRes.data);
        
        // Also set risky detections (detections with high confidence)
        const risky = detectionsRes.data
          .filter(d => d.confidence > 0.7) // Only get high confidence detections
          .slice(0, 7); // Get maximum 7
        setRiskyDetections(risky);
      } else {
        camwatchToast.error(detectionsRes.message || 'Failed to load recent detections.');
        setRecentDetections([]);
        setRiskyDetections([]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      camwatchToast.error('Could not fetch dashboard data.');
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
      setRiskyDetections([]);
    } finally {
      setLoading(false);
    }
  };

  const startWebcam = async (cameraToUpdate) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Set webcam stream and state IMMEDIATELY
        setWebcamStream(stream);
        setIsWebcamOn(true);
        webcamStateRef.current = true; // Set ref immediately
        setDetectionStatus('✅ Monitoring for weapons...');
        
        // Set up video element
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          
          // Wait for video to actually load and start playing
          webcamVideoRef.current.onloadedmetadata = () => {
            webcamVideoRef.current.play().catch(err => {
              console.error('❌ Error playing video:', err);
            });
          };
          
          webcamVideoRef.current.oncanplay = () => {
            // Start weapon detection after video is ready to play
            setTimeout(() => {
              startWeaponDetection();
            }, 500);
          };
          
          webcamVideoRef.current.load();
        }
        
        if (cameraToUpdate && cameraToUpdate.id !== WEBCAM_PLACEHOLDER_ID) {
          updateCameraStatusInDB(cameraToUpdate.id, true);
        }
        
      } catch (err) {
        console.error("Error accessing webcam:", err);
        camwatchToast.error("Could not access webcam. Please check permissions.");
        setIsWebcamOn(false);
        webcamStateRef.current = false;
        setWebcamStream(null);
        setDetectionStatus('');
      }
    } else {
      camwatchToast.error("Webcam not supported by this browser.");
    }
  };

  const stopWebcam = (cameraToUpdate) => {
    // Stop detection first
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Stop webcam stream
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear video element
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
      webcamVideoRef.current.onloadedmetadata = null;
      webcamVideoRef.current.oncanplay = null;
    }
    
    // Update state
    setWebcamStream(null);
    setIsWebcamOn(false);
    webcamStateRef.current = false; // Set ref immediately
    setDetectionStatus('');
    setLastDetection(null);
    setIsAnalyzing(false);
    
    if (cameraToUpdate && cameraToUpdate.id !== WEBCAM_PLACEHOLDER_ID) {
      updateCameraStatusInDB(cameraToUpdate.id, false);
    }
  };

  const toggleWebcam = (camera) => {
    if (!camera) return;
    
    if (isWebcamOn) {
      stopWebcam(camera);
    } else {
      startWebcam(camera);
    }
  };

  const startWeaponDetection = () => {
    // Clear any existing interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    // Call once immediately
    setTimeout(() => {
      analyzeFrame();
      
      // Then set up regular interval
      detectionIntervalRef.current = setInterval(analyzeFrame, 3000); // Every 3 seconds
      
    }, 1000); // Wait 1 second before first call
  };

  const analyzeFrame = async () => {
    // Skip if not ready or already analyzing
    if (!webcamVideoRef.current || !webcamVideoRef.current.srcObject || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);

    try {
      // Capture frame
      const canvas = document.createElement('canvas');
      const video = webcamVideoRef.current;
      
      canvas.width = 320;
      canvas.height = 320;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64Image = dataUrl.split(',')[1];
      
      // Send to backend for analysis
      const res = await apiService.analyzeFrame(base64Image);

      if (res?.success) {
        if (res.weapon_detected) {
          const weaponList = res.weapons.map(w => w.weapon).join(', ');
          setDetectionStatus(`🚨 WEAPON DETECTED: ${weaponList}`);
          
          // Update lastDetection state
          const newDetection = {
            weapons: res.weapons,
            confidence: res.confidence,
            timestamp: new Date().toLocaleTimeString(),
            image: dataUrl,
            image_url: dataUrl // Add image_url to make it compatible with risky detections
          };
          setLastDetection(newDetection);
          
          // Show toast notification
          camwatchToast.error(`🚨 WEAPON DETECTED: ${weaponList}`);
          
          // Update risky detections immediately
          if (res.confidence > 0.7) {
            const localRiskyDetection = {
              id: Date.now(), // Temporary local ID
              detection_type: 'weapon',
              confidence: res.confidence,
              details: `Detected: ${weaponList}`,
              image_url: dataUrl,
              camera_name: 'Local Webcam',
              detected_at: new Date().toISOString()
            };
            
            setRiskyDetections(prev => {
              const newDetections = [localRiskyDetection, ...prev].slice(0, 7);
              return newDetections;
            });
          }
          
          // Refresh backend data after a delay
          setTimeout(() => fetchRecentDetections(), 1000);
        } else {
          setDetectionStatus('✅ No weapons detected');
        }
      } else {
        setDetectionStatus('⚠️ Analysis failed');
      }
    } catch (err) {
      setDetectionStatus('⚠️ Detection error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateCameraStatusInDB = async (cameraId, isActive) => {
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
        if (cameras.length > WEBCAM_CAMERA_INDEX && cameras[WEBCAM_CAMERA_INDEX].id === cameraId) {
          setIsWebcamOn(!isActive);
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
    if (isWebcamOn && cameras.length > WEBCAM_CAMERA_INDEX && cameras[WEBCAM_CAMERA_INDEX]) {
      stopWebcam(cameras[WEBCAM_CAMERA_INDEX]);
    }
    logout();
  };

  const fetchRecentDetections = async () => {
    try {
      const detectionsRes = await apiService.getDashboardRecentDetections();
      if (detectionsRes.success && Array.isArray(detectionsRes.data)) {
        setRecentDetections(detectionsRes.data);
        
        // Update risky detections as well
        const risky = detectionsRes.data
          .filter(d => d.confidence > 0.7) 
          .slice(0, 7);
        setRiskyDetections(risky);
      }
    } catch (error) {
      console.error('Error fetching recent detections:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan-start mx-auto mb-2"></div>
          <p className="text-sm">Loading...</p>
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

        {/* Main Content Row - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column - Weapon Detection */}
          <div className="space-y-6">
            {/* Detection Status */}
            <div className={`rounded-xl p-6 shadow-lg border ${
              detectionStatus?.includes('WEAPON DETECTED') 
                ? 'bg-red-900/80 border-red-500 animate-pulse' 
                : 'bg-black/60 border-sky-700/30'
            }`}>
              <div className="flex items-start space-x-4">
                <div className="text-3xl">
                  {detectionStatus?.includes('WEAPON DETECTED') ? '🚨' : '🔍'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h2 className={`text-lg font-semibold ${
                      detectionStatus?.includes('WEAPON DETECTED') ? 'text-red-300' : 'text-sky-300'
                    }`}>
                      Weapon Detection
                    </h2>
                    {isAnalyzing && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-400"></div>
                    )}
                  </div>
                  <div className={`text-white rounded-lg p-4 min-h-[80px] border ${
                    detectionStatus?.includes('WEAPON DETECTED') 
                      ? 'bg-red-800/50 border-red-600' 
                      : 'bg-gray-800/50 border-gray-600'
                  }`}>
                    {isWebcamOn ? (
                      detectionStatus || (
                        <span className="text-gray-400 italic">
                          {isAnalyzing ? "🔍 Scanning..." : "✅ Ready for detection"}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 italic">📹 Turn on webcam to start detection</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Last Detection Preview */}
            {lastDetection && (
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-red-300 mb-4">🚨 Latest Weapon Detection</h3>
                <div className="space-y-4">
                  <div>
                    <img 
                      src={lastDetection.image} 
                      alt="Detected weapon" 
                      className="w-full h-48 object-cover rounded-lg border border-red-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="bg-red-800/50 rounded-lg p-3">
                      <div className="text-sm text-red-200">Detected Weapons:</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {lastDetection.weapons.map((weapon, idx) => (
                          <span 
                            key={idx}
                            className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-medium"
                          >
                            {weapon.weapon} ({(weapon.confidence * 100).toFixed(1)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-800/50 rounded-lg p-3">
                        <div className="text-sm text-red-200">Detection Time:</div>
                        <div className="text-white font-medium">{lastDetection.timestamp}</div>
                      </div>
                      <div className="bg-red-800/50 rounded-lg p-3">
                        <div className="text-sm text-red-200">Highest Confidence:</div>
                        <div className="text-white font-bold text-lg">
                          {(lastDetection.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Camera */}
          <div className="space-y-6">
            {/* Camera Card */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">{cameras[0].name}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`w-4 h-4 rounded-full ${
                    isWebcamOn ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  <span className="text-sm text-gray-300">
                    {isWebcamOn ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">{cameras[0].location}</p>
              
              {/* Debug info */}
              <div className="text-xs text-gray-400 mb-2">
                Debug: webcam={isWebcamOn ? 'ON' : 'OFF'}, stream={webcamStream ? 'active' : 'none'}
              </div>
              
              {/* Camera View */}
              <div className={`bg-gray-800 rounded-2xl h-64 lg:h-80 flex items-center justify-center overflow-hidden ${
                isWebcamOn ? 'border-2 border-green-500' : ''
              }`}>
                <video 
                  ref={webcamVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover ${!isWebcamOn ? 'hidden' : ''}`}
                />
                {!isWebcamOn && (
                  <span className="text-6xl opacity-50">📹</span>
                )}
              </div>
              
              {/* Camera Control */}
              <button
                onClick={() => toggleWebcam(cameras[0])}
                className={`mt-4 w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 text-lg
                  ${isWebcamOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white shadow-md`}
              >
                {isWebcamOn ? 'Turn Off Webcam' : 'Turn On Webcam'}
              </button>
            </div>
          </div>
        </div>

        {/* High Risk Detections Row */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">🔥 High Risk Detections</h2>
          <div className="overflow-x-auto">
            <div className="flex space-x-4 pb-2">
              {riskyDetections.length > 0 ? (
                riskyDetections.map((detection) => (
                  <div key={detection.id} className="flex-shrink-0 w-48 bg-red-900/40 border border-red-500/50 rounded-lg overflow-hidden shadow-lg">
                    {detection.image_url && (
                      <div className="h-32 overflow-hidden">
                        <img 
                          src={detection.image_url} 
                          alt="Detection" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-3 space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/30 text-red-200 border border-red-500/50">
                          {detection.detection_type || 'weapon'}
                        </span>
                        <span className="text-sm font-bold text-red-300">
                          {detection.confidence ? (detection.confidence * 100).toFixed(0) + '%' : 'N/A'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 truncate">
                        {new Date(detection.detected_at).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {detection.camera_name || 'Local Webcam'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full text-center py-8 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-sm">No high risk detections yet</p>
                </div>
              )}
              
              {/* Placeholder cards if we have less than 7 */}
              {riskyDetections.length > 0 && riskyDetections.length < 7 && 
                Array(7 - riskyDetections.length).fill(0).map((_, idx) => (
                  <div key={`placeholder-${idx}`} className="flex-shrink-0 w-48 bg-white/5 border border-white/10 rounded-lg h-32 flex items-center justify-center">
                    <span className="text-gray-500 text-3xl opacity-20">🔍</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Recent Detections */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/20 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Recent Weapon Detections</h2>
            <button 
              onClick={fetchRecentDetections}
              className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            {recentDetections.length > 0 ? (
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Confidence</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Camera</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {recentDetections.map((detection) => (
                    <tr key={detection.id} className="hover:bg-white/5 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-500/30 text-red-200 border border-red-500/50">
                          {detection.detection_type || 'weapon'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.confidence ? (detection.confidence * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 max-w-xs">
                        <div className="truncate" title={detection.details}>
                          {detection.details?.substring(0, 50) || 'Weapon detected'}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.camera_name || 'Local Webcam'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.detected_at ? new Date(detection.detected_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-gray-400 py-10">No weapon detections yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;