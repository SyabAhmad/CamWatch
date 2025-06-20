import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiService from '../services/apiService';
import { showToast, camwatchToast } from '../utils/toast';
import RecentDetectionsRow from './RecentDetectionsRow';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState(null);
  
  // Local detection storage (in-memory only)
  const [localDetections, setLocalDetections] = useState([]);
  
  // Webcam state
  const [webcamStream, setWebcamStream] = useState(null);
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const webcamVideoRef = useRef(null);
  const WEBCAM_PLACEHOLDER_ID = 'local-webcam-placeholder';

  // Detection state
  const [detectionStatus, setDetectionStatus] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);
  const detectionIntervalRef = useRef(null);
  const webcamStateRef = useRef(false);

  // Selected description state for modal
  const [selectedDescription, setSelectedDescription] = useState(null);

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

  // Parse camera ID from URL if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cameraId = params.get('camera');
    if (cameraId && cameras.length > 0) {
      const cam = cameras.find(c => c.id === cameraId);
      if (cam) {
        setSelectedCamera(cam);
      }
    }
  }, [location.search, cameras]);

  // Update the fetchDashboardData function
  const fetchDashboardData = async () => {
    setLoading(true);
    let fetchedCamerasData = [];

    try {
      console.log('Fetching dashboard data...');
      
      // Directly try to fetch cameras instead of health check first
      const camerasRes = await apiService.getDashboardCameras();
      console.log('Camera response:', camerasRes);

      // Process cameras data
      if (camerasRes.success && Array.isArray(camerasRes.data)) {
        fetchedCamerasData = camerasRes.data;
      } else {
        console.warn('No cameras from backend, using webcam fallback');
        // Don't show error toast here, just use fallback
      }

      if (fetchedCamerasData.length === 0) {
        const webcamPlaceholder = {
          id: WEBCAM_PLACEHOLDER_ID,
          name: 'Local Webcam',
          location: 'Your Computer',
          is_active: false,
        };
        setCameras([webcamPlaceholder]);
        setSelectedCamera(webcamPlaceholder);
        setIsWebcamOn(webcamPlaceholder.is_active);
      } else {
        setCameras(fetchedCamerasData);
        const params = new URLSearchParams(location.search);
        const cameraId = params.get('camera');
        
        if (cameraId) {
          const cam = fetchedCamerasData.find(c => c.id === cameraId);
          if (cam) {
            setSelectedCamera(cam);
            setIsWebcamOn(cam.is_active);
          } else {
            setSelectedCamera(fetchedCamerasData[0]);
            setIsAnalyzing(false); // FIX: This was "setIs" which caused the error
          }
        } else {
          setSelectedCamera(fetchedCamerasData[0]);
          setIsAnalyzing(false); // FIX: This was "setIs" which caused the error
        }
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Only show error if it's a real connectivity issue
      if (error.message.includes('fetch')) {
        camwatchToast.error('Backend server not available. Please check if the server is running.');
      }
      
      // Always provide webcam fallback
      const webcamPlaceholderOnError = {
        id: WEBCAM_PLACEHOLDER_ID,
        name: 'Local Webcam',
        location: 'Your Computer',
        is_active: false,
      };
      setCameras([webcamPlaceholderOnError]);
      setSelectedCamera(webcamPlaceholderOnError);
      setIsWebcamOn(webcamPlaceholderOnError.is_active);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCameraChange = (e) => {
    const cameraId = e.target.value;
    const camera = cameras.find(cam => cam.id === cameraId);
    if (camera) {
      setSelectedCamera(camera);
      navigate(`/staff?camera=${cameraId}`, { replace: true });
      
      if (isWebcamOn) {
        stopWebcam(cameras.find(c => c.id === selectedCamera?.id));
      }
    }
  };

  const startWebcam = async (cameraToUpdate) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        setWebcamStream(stream);
        setIsWebcamOn(true);
        webcamStateRef.current = true;
        setDetectionStatus('✅ Monitoring for weapons...');
        
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          console.log('📹 Stream attached to video element');
          
          webcamVideoRef.current.onloadedmetadata = () => {
            console.log('🎬 Video metadata loaded');
            webcamVideoRef.current.play().catch(err => {
              console.error('❌ Error playing video:', err);
            });
          };
          
          if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
          }
          
          console.log('🔍 Starting weapon detection immediately from webcam start');
          startWeaponDetection();
          
          setTimeout(() => {
            if (webcamStateRef.current && !isAnalyzing) {
              console.log('⏱️ Safety check: Ensuring detection is running');
              startWeaponDetection();
            }
          }, 1500);
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
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
    }
    
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
      webcamVideoRef.current.onloadedmetadata = null;
      webcamVideoRef.current.oncanplay = null;
    }
    
    setWebcamStream(null);
    setIsWebcamOn(false);
    webcamStateRef.current = false;
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
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    console.log('🔍 Starting weapon detection with 3-second intervals');
    
    // Initial analysis
    if (webcamVideoRef.current && webcamVideoRef.current.srcObject && !isAnalyzing) {
      console.log('📸 Performing initial frame analysis');
      analyzeFrame();
    }

    // Simple 3-second interval - NO MORE COMPLEX TIMING
    detectionIntervalRef.current = setInterval(() => {
      if (webcamStateRef.current && webcamVideoRef.current && !isAnalyzing) {
        console.log('🔄 3-second interval - analyzing frame');
        analyzeFrame();
      } else {
        console.log('⚠️ Skipping analysis - webcam off or already analyzing');
      }
    }, 1500); // EXACTLY 1.5 seconds

    console.log('✅ Detection interval set to 1.5 seconds');
  };

  // Simplify the analyzeFrame function:
  const analyzeFrame = async () => {
    if (!webcamVideoRef.current || !webcamVideoRef.current.srcObject || isAnalyzing) {
      console.log('⚠️ Skipping frame - no video or already analyzing');
      return;
    }

    setIsAnalyzing(true);
    console.log('📸 Analyzing frame...');

    try {
      const canvas = document.createElement('canvas');
      const video = webcamVideoRef.current;
      
      // Use 640x640 for better detection
      canvas.width = 640;
      canvas.height = 640;
      
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // High quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const base64Image = dataUrl.split(',')[1];
      
      // Skip tiny frames
      if (base64Image.length < 15000) {
        console.log('⚠️ Frame too small, skipping');
        setIsAnalyzing(false);
        return;
      }
      
      console.log('📤 Sending frame for analysis');
      
      const res = await apiService.analyzeFrame(base64Image);
      console.log('📥 Analysis result:', res);

      if (res?.success) {
        if (res.weapon_detected) {
          const weaponList = res.weapons.map(w => w.weapon).join(', ');
          setDetectionStatus(`🚨 WEAPON DETECTED: ${weaponList}`);
          
          const newDetection = {
            id: Date.now(),
            weapons: res.weapons,
            confidence: res.confidence,
            timestamp: new Date().toLocaleTimeString(),
            image: dataUrl
          };
          
          setLastDetection(newDetection);
          camwatchToast.error(`🚨 WEAPON: ${weaponList}`);
          
        } else {
          setDetectionStatus('✅ No weapons detected');
        }
      } else {
        setDetectionStatus('⚠️ Analysis failed');
      }
      
    } catch (err) {
      console.error('Analysis error:', err);
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
        setIsWebcamOn(!isActive);
        setCameras(prevCameras => 
          prevCameras.map(cam => 
            cam.id === cameraId ? { ...cam, is_active: !isActive } : cam
          )
        );
      }
    } catch (error) {
      console.error("Error updating camera status:", error);
      camwatchToast.error('Network error updating camera status.');
      setIsWebcamOn(!isActive);
      setCameras(prevCameras => 
        prevCameras.map(cam => 
          cam.id === cameraId ? { ...cam, is_active: !isActive } : cam
        )
      );
    }
  };

  const handleLogout = () => {
    if (isWebcamOn && selectedCamera) {
      stopWebcam(selectedCamera);
    }
    logout();
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
            <Link 
              to="/cameras"
              className="bg-gradient-to-r from-brand-blue-start to-brand-cyan-start text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105 shadow-lg"
            >
              View All Cameras
            </Link>
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
        
        {/* Camera Selector */}
        <div className="mb-6">
          <label htmlFor="camera-select" className="block text-sm font-medium text-gray-300 mb-2">
            Select Camera
          </label>
          <div className="relative">
            <select
              id="camera-select"
              value={selectedCamera?.id || ''}
              onChange={handleCameraChange}
              className="block w-full bg-white/10 border border-white/20 rounded-xl py-2 pl-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-brand-blue-start appearance-none"
            >
              {cameras.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.name} - {camera.location}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Main Content Row - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column - Weapon Detection */}
          <div className="space-y-6">
            {/* Detection Status */}
            <div
  className={`rounded-3xl p-8 shadow-2xl border-2 transition-all duration-500
    ${
      detectionStatus?.includes('WEAPON DETECTED')
        ? 'bg-gradient-to-br from-red-700 via-red-800 to-pink-900 border-red-400 animate-pulse'
        : 'bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 border-blue-500'
    }
  `}
>
  <div className="flex items-start space-x-6">
    <div className={`text-5xl drop-shadow-lg ${
      detectionStatus?.includes('WEAPON DETECTED') ? 'text-red-200' : 'text-blue-200'
    }`}>
      {detectionStatus?.includes('WEAPON DETECTED') ? '🚨' : '🔍'}
    </div>
    <div className="flex-1">
      <div className="flex items-center space-x-3 mb-3">
        <h2 className={`text-2xl font-extrabold tracking-wide ${
          detectionStatus?.includes('WEAPON DETECTED') ? 'text-red-200' : 'text-cyan-300'
        }`}>
          Weapon Detection
        </h2>
        {isAnalyzing && (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-300"></div>
        )}
      </div>
      <div className={`rounded-xl p-5 min-h-[80px] border-2 shadow-inner transition-all duration-500
        ${
          detectionStatus?.includes('WEAPON DETECTED')
            ? 'bg-gradient-to-r from-red-800 via-red-900 to-pink-900 border-red-500'
            : 'bg-gradient-to-r from-blue-950 via-indigo-950 to-purple-950 border-blue-800'
        }
      `}>
        {isWebcamOn ? (
          detectionStatus || (
            <span className="text-gray-400 italic">
              {isAnalyzing ? (
                <span>
                  <span className="inline-block w-4 h-4 mr-2 align-middle animate-spin border-b-2 border-cyan-300 rounded-full"></span>
                  Scanning...
                </span>
              ) : (
                "✅ Ready for detection"
              )}
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
  <div className={`mt-6 rounded-3xl p-8 border-2 shadow-2xl transition-all duration-500
    ${
      detectionStatus?.includes('WEAPON DETECTED')
        ? 'bg-gradient-to-br from-red-800 via-red-900 to-pink-900 border-red-400'
        : 'bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950 border-blue-800'
    }
  `}>
    <h3 className={`text-xl font-bold mb-5 flex items-center gap-2 ${
      detectionStatus?.includes('WEAPON DETECTED') ? 'text-red-200' : 'text-cyan-200'
    }`}>
      {detectionStatus?.includes('WEAPON DETECTED') ? '🚨' : '🕒'} Latest Weapon Detection
    </h3>
    <div className="space-y-5">
      {detectionStatus?.includes('WEAPON DETECTED') ? (
        <div className="bg-gradient-to-r from-red-700 via-red-800 to-pink-900 rounded-xl p-5 text-center border border-red-400 shadow-lg">
          <div className="text-5xl mb-2 text-red-100">🚨</div>
          <div className="text-white font-bold text-lg tracking-wide">Threat Detected!</div>
          <div className="text-base text-red-200 mt-2 font-semibold">
            Detected Weapons: {lastDetection.weapons.map(w => w.weapon).join(', ')}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400 italic">
          No weapons detected in the last scan.
        </div>
      )}

      <div className={`rounded-xl p-4 ${
        detectionStatus?.includes('WEAPON DETECTED')
          ? 'bg-red-900/80 border border-red-500'
          : 'bg-blue-950/80 border border-blue-800'
      }`}>
        <div className={`text-base mb-2 ${
          detectionStatus?.includes('WEAPON DETECTED') ? 'text-red-200' : 'text-cyan-200'
        }`}>Detected Weapons:</div>
        <div className="flex flex-wrap gap-3">
          {lastDetection.weapons.map((weapon, idx) => (
            <span
              key={idx}
              className={`px-4 py-1 rounded-full font-bold shadow-md text-white text-base ${
                detectionStatus?.includes('WEAPON DETECTED')
                  ? 'bg-gradient-to-r from-red-600 to-pink-600'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600'
              }`}
            >
              {weapon.weapon} ({(weapon.confidence * 100).toFixed(1)}%)
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className={`rounded-xl p-4 text-center ${
          detectionStatus?.includes('WEAPON DETECTED')
            ? 'bg-red-900/80 border border-red-500'
            : 'bg-blue-950/80 border border-blue-800'
        }`}>
          <div className="text-base text-gray-300">Detection Time:</div>
          <div className="text-white font-semibold text-lg">{lastDetection.timestamp}</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${
          detectionStatus?.includes('WEAPON DETECTED')
            ? 'bg-red-900/80 border border-red-500'
            : 'bg-blue-950/80 border border-blue-800'
        }`}>
          <div className="text-base text-gray-300">Highest Confidence:</div>
          <div className="text-white font-extrabold text-2xl">
            {(lastDetection.confidence * 100).toFixed(1)}%
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
                <h3 className="text-xl font-semibold text-white">{selectedCamera?.name || 'Camera'}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`w-4 h-4 rounded-full ${
                    isWebcamOn ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  <span className="text-sm text-gray-300">
                    {isWebcamOn ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">{selectedCamera?.location || 'Location'}</p>
              
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
              <div className="mt-4">
                <button
                  onClick={() => toggleWebcam(selectedCamera)}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 text-lg
                    ${isWebcamOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white shadow-md`}
                  title={isWebcamOn ? "Turn off webcam and stop detection" : "Turn on webcam and start detection"}
                >
                  {isWebcamOn ? '📴 Turn Off Camera & Detection' : '📲 Turn On Camera & Detection'}
                </button>
                
                {isWebcamOn && !detectionIntervalRef.current && (
                  <div className="mt-2 text-center">
                    <button
                      onClick={() => {
                        console.log('🔄 Manually restarting detection');
                        startWeaponDetection();
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Detection not working? Click here to restart
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Local Detections Row (In-Memory Only) */}
        <div>
          <RecentDetectionsRow/>
        </div>
      </div>

      {/* Description Modal - Expanded View */}
      {selectedDescription && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
    <div className="bg-gradient-to-br from-red-900 to-black rounded-2xl max-w-xl w-full max-h-[80vh] overflow-hidden border border-red-500">
      <div className="p-5 border-b border-red-800 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">
          {selectedDescription.weapon} Detection #{selectedDescription.id}
        </h3>
        <button 
          onClick={() => setSelectedDescription(null)}
          className="text-red-300 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        <div className="bg-red-900/40 rounded-lg p-4 border border-red-700">
          <h4 className="text-lg font-semibold text-red-200 mb-3">AI Security Analysis</h4>
          <p className="text-white/90 leading-relaxed whitespace-pre-line">
            {selectedDescription.text}
          </p>
        </div>
      </div>
      <div className="p-4 border-t border-red-800 flex justify-end">
        <button 
          onClick={() => setSelectedDescription(null)}
          className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default StaffDashboard;
