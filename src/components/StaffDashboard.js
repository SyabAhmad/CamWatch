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

  // AI Analysis state
  const [aiDescription, setAiDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const aiIntervalRef = useRef(null);
  const aiCanvasRef = useRef(null);

  // Add new state for live preview
  const [livePreview, setLivePreview] = useState(null);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Add this useEffect to track state changes
  useEffect(() => {
    console.log("isWebcamOn changed to:", isWebcamOn);
  }, [isWebcamOn]);

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
        console.log("Webcam turned on");
        // Only update backend if it's not the placeholder
        if (cameraToUpdate && cameraToUpdate.id !== WEBCAM_PLACEHOLDER_ID) {
          updateCameraStatusInDB(cameraToUpdate.id, true);
        }
        // Start AI analysis interval
        if (!aiIntervalRef.current) {
          aiIntervalRef.current = setInterval(analyzeWebcamFrame, 5000); // every 5 seconds
          console.log("AI interval started");
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
    // Stop AI analysis interval
    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current);
      aiIntervalRef.current = null;
    }
    setAiDescription('');
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

  // Add function to fetch recent detections separately
  const fetchRecentDetections = async () => {
    try {
      const detectionsRes = await apiService.getDashboardRecentDetections();
      if (detectionsRes.success && Array.isArray(detectionsRes.data)) {
        setRecentDetections(detectionsRes.data);
      }
    } catch (error) {
      console.error('Error fetching recent detections:', error);
    }
  };

  // Enhanced analyzeWebcamFrame function with smart detection info
  const analyzeWebcamFrame = async () => {
    console.log("🎯 Smart analysis started");
    
    if (!webcamVideoRef.current || isAnalyzing) {
      console.log("⏹️ Early return");
      return;
    }
    
    setIsAnalyzing(true);
    const startTime = Date.now();

    try {
      // Capture frame
      if (!aiCanvasRef.current) {
        aiCanvasRef.current = document.createElement('canvas');
      }
      const canvas = aiCanvasRef.current;
      const video = webcamVideoRef.current;
      
      const maxWidth = 640;
      const maxHeight = 480;
      const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight, 1);
      
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64Image = dataUrl.split(',')[1];
      
      console.log("📡 Sending to smart analysis endpoint...");

      const res = await apiService.request('/dashboard/analyze-frame-smart', {
        method: 'POST',
        body: JSON.stringify({ image_b64: base64Image }),
      });
      
      const processingTime = Date.now() - startTime;
      console.log("📥 Smart analysis response:", res);
      
      if (res.success) {
        setAiDescription(res.description);
        
        // Update live preview with enhanced info
        setLivePreview({
          image: dataUrl,
          description: res.ai_description || res.description,
          detectedObjects: res.detected_objects || [],
          weaponDetected: res.weapon_detected,
          suspiciousDetected: res.suspicious_detected,
          weaponTypes: res.weapon_types || [],
          suspiciousTypes: res.suspicious_types || [],
          confidence: res.confidence || 0,
          timestamp: new Date().toLocaleTimeString(),
          processingTime: `${processingTime}ms`,
          smolUsed: res.smol_used || false  // Show if SmolVLM was actually used
        });
        
        // Show different toasts based on detection
        if (res.weapon_detected) {
          setLastDetectionTime(new Date());
          camwatchToast.error("🚨 WEAPON DETECTED! AI analysis completed & saved to database!");
          
          // Refresh detections to show the new one
          setTimeout(() => {
            fetchRecentDetections();
          }, 1000);
        } else if (res.suspicious_detected) {
          console.log(`⚠️ Suspicious: ${res.suspicious_types?.join(', ') || 'Unknown'}`);
          camwatchToast.warning("⚠️ Suspicious objects detected - monitoring...");
        } else {
          console.log(`✅ Safe: ${res.detected_objects?.map(obj => obj.object).join(', ') || 'No objects'}`);
        }
      }
    } catch (err) {
      console.error("💥 Smart analysis error:", err);
      setAiDescription('Analysis error. Check connection.');
    } finally {
      setIsAnalyzing(false);
      console.log(`🏁 Analysis completed in ${Date.now() - startTime}ms`);
    }
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

        {/* AI Real-Time Description Section - ADD THIS */}
        <div className="mb-6">
          <div className={`rounded-xl p-6 flex items-start space-x-4 shadow-lg border ${
            aiDescription?.includes('WEAPON ALERT') 
              ? 'bg-red-900/80 border-red-500 animate-pulse' 
              : 'bg-black/60 border-sky-700/30'
          }`}>
            <div className="text-3xl">
              {aiDescription?.includes('WEAPON ALERT') ? '🚨' : '🤖'}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h2 className={`text-lg font-semibold ${
                  aiDescription?.includes('WEAPON ALERT') ? 'text-red-300' : 'text-sky-300'
                }`}>
                  {aiDescription?.includes('WEAPON ALERT') ? '🚨 SECURITY ALERT' : 'AI Live Detection'}
                </h2>
                {isAnalyzing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-400"></div>
                )}
              </div>
              <div className={`text-white rounded-lg p-4 min-h-[80px] border ${
                aiDescription?.includes('WEAPON ALERT') 
                  ? 'bg-red-800/50 border-red-600' 
                  : 'bg-gray-800/50 border-gray-600'
              }`}>
                {isWebcamOn ? (
                  aiDescription || (
                    <span className="text-gray-400 italic">
                      {isAnalyzing ? "🔍 Scanning for threats..." : "✅ Monitoring for security threats..."}
                    </span>
                  )
                ) : (
                  <span className="text-gray-400 italic">📹 Turn on webcam for threat detection</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Fast YOLO detection + Smart AI analysis • Real-time threat monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced AI Live Detection with Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Live Analysis Section */}
          <div className={`rounded-xl p-6 shadow-lg border ${
            aiDescription?.includes('WEAPON ALERT') 
              ? 'bg-red-900/80 border-red-500 animate-pulse' 
              : 'bg-black/60 border-sky-700/30'
          }`}>
            <div className="flex items-center space-x-2 mb-4">
              <div className="text-2xl">
                {aiDescription?.includes('WEAPON ALERT') ? '🚨' : '🤖'}
              </div>
              <h2 className={`text-lg font-semibold ${
                aiDescription?.includes('WEAPON ALERT') ? 'text-red-300' : 'text-sky-300'
              }`}>
                {aiDescription?.includes('WEAPON ALERT') ? '🚨 SECURITY ALERT' : 'AI Live Detection'}
              </h2>
              {isAnalyzing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-400"></div>
              )}
            </div>
            
            <div className={`text-white rounded-lg p-4 min-h-[100px] border ${
              aiDescription?.includes('WEAPON ALERT') 
                ? 'bg-red-800/50 border-red-600' 
                : 'bg-gray-800/50 border-gray-600'
            }`}>
              {isWebcamOn ? (
                aiDescription || (
                  <span className="text-gray-400 italic">
                    {isAnalyzing ? "🔍 Scanning for threats..." : "✅ Monitoring for security threats..."}
                  </span>
                )
              ) : (
                <span className="text-gray-400 italic">📹 Turn on webcam for threat detection</span>
              )}
            </div>
            
            <div className="text-xs text-gray-400 mt-2 flex justify-between">
              <span>YOLO + SmolVLM • Real-time monitoring</span>
              {lastDetectionTime && (
                <span className="text-red-400">Last alert: {lastDetectionTime.toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {/* Live Preview Section */}
          <div className="bg-black/60 rounded-xl p-6 shadow-lg border border-sky-700/30">
            <h3 className="text-lg font-semibold text-sky-300 mb-4 flex items-center">
              📸 Live Preview & Smart Analysis
            </h3>
            
            {livePreview ? (
              <div className="space-y-4">
                {/* Enhanced Preview Image */}
                <div className="relative group">
                  <div className={`relative overflow-hidden rounded-xl border-3 transition-all duration-300 ${
                    livePreview.weaponDetected ? 'border-red-500 shadow-red-500/30 shadow-lg' : 
                    livePreview.suspiciousDetected ? 'border-yellow-500 shadow-yellow-500/30 shadow-lg' : 
                    'border-gray-600 hover:border-gray-500'
                  }`}>
                    <img 
                      src={livePreview.image} 
                      alt="Live analysis frame" 
                      className="w-full h-48 md:h-56 object-cover"
                    />
                    
                    {/* Status Overlays */}
                    {livePreview.weaponDetected && (
                      <div className="absolute top-3 right-3 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center animate-pulse">
                        <span className="mr-2">🚨</span>
                        WEAPON DETECTED
                      </div>
                    )}
                    
                    {livePreview.suspiciousDetected && !livePreview.weaponDetected && (
                      <div className="absolute top-3 right-3 bg-yellow-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center">
                        <span className="mr-2">⚠️</span>
                        SUSPICIOUS ACTIVITY
                      </div>
                    )}
                    
                    {livePreview.smolUsed && (
                      <div className="absolute bottom-3 left-3 bg-purple-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center">
                        <span className="mr-2">🧠</span>
                        AI ANALYZED
                      </div>
                    )}
                    
                    {/* Timestamp Overlay */}
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
                      {livePreview.timestamp}
                    </div>
                    
                    {/* Gradient Overlay for better text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20 pointer-events-none"></div>
                  </div>
                </div>
                
                {/* Enhanced Analysis Details Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Processing Time</div>
                    <div className="text-sm font-bold text-white">{livePreview.processingTime}</div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Analysis Mode</div>
                    <div className={`text-sm font-bold ${livePreview.smolUsed ? 'text-purple-400' : 'text-blue-400'}`}>
                      {livePreview.smolUsed ? 'Deep AI' : 'Fast YOLO'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Threat Level</div>
                    <div className={`text-sm font-bold ${
                      livePreview.weaponDetected ? 'text-red-400' : 
                      livePreview.suspiciousDetected ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {livePreview.weaponDetected ? '🚨 HIGH' : 
                       livePreview.suspiciousDetected ? '⚠️ MEDIUM' : '✅ LOW'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Objects Found</div>
                    <div className="text-sm font-bold text-white">{livePreview.detectedObjects.length}</div>
                  </div>
                </div>
                
                {/* Enhanced Detected Objects Section */}
                {livePreview.detectedObjects.length > 0 && (
                  <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-300">Detected Objects</span>
                      <span className="text-xs text-gray-500">
                        Confidence scores shown
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {livePreview.detectedObjects.map((obj, idx) => (
                        <div 
                          key={idx}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            livePreview.weaponTypes.includes(obj.object) ? 
                              'bg-red-600/80 text-white border border-red-500/50 shadow-red-500/20 shadow-lg' :
                            livePreview.suspiciousTypes?.includes(obj.object) ? 
                              'bg-yellow-600/80 text-white border border-yellow-500/50 shadow-yellow-500/20 shadow-lg' :
                              'bg-blue-600/80 text-white border border-blue-500/50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="capitalize">{obj.object}</span>
                            <span className="text-xs opacity-80">
                              {(obj.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* AI Description Section (when weapon detected) */}
                {livePreview.smolUsed && livePreview.description && (
                  <div className="bg-purple-900/30 rounded-xl p-4 border border-purple-500/30">
                    <div className="flex items-center mb-2">
                      <span className="text-purple-400 mr-2">🧠</span>
                      <span className="text-sm font-medium text-purple-300">AI Analysis</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {livePreview.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Enhanced Waiting State */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  isWebcamOn ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  <span className="text-2xl">
                    {isWebcamOn ? '🔍' : '📹'}
                  </span>
                </div>
                
                <h4 className={`text-lg font-semibold mb-2 ${
                  isWebcamOn ? 'text-blue-300' : 'text-gray-400'
                }`}>
                  {isWebcamOn ? 'Initializing Analysis...' : 'Camera Offline'}
                </h4>
                
                <p className="text-gray-500 text-sm max-w-md">
                  {isWebcamOn 
                    ? "Please wait while we start the intelligent threat detection system. First analysis will appear shortly."
                    : "Turn on your webcam to begin real-time threat detection and analysis."
                  }
                </p>
                
                {isWebcamOn && (
                  <div className="mt-4 flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                )}
              </div>
            )}
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

        {/* Enhanced Recent Detections */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/20 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Stored Threat Detections</h2>
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
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          detection.detection_type === 'weapon' ? 'bg-red-500/30 text-red-200 border border-red-500/50' :
                          detection.detection_type === 'violence' ? 'bg-orange-500/30 text-orange-200 border border-orange-500/50' :
                          'bg-yellow-500/30 text-yellow-200 border border-yellow-500/50'
                        }`}>
                          {detection.detection_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {detection.confidence ? (detection.confidence * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 max-w-xs">
                        <div className="truncate" title={detection.details}>
                          {detection.details?.substring(0, 50) || 'No details'}...
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
              <p className="text-center text-gray-400 py-10">No stored detections yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;