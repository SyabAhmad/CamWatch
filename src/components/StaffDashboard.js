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
            setIsWebcamOn(fetchedCamerasData[0].is_active);
          }
        } else {
          setSelectedCamera(fetchedCamerasData[0]);
          setIsWebcamOn(fetchedCamerasData[0].is_active);
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

    console.log('🔍 Weapon detection started');
    
    if (webcamVideoRef.current && webcamVideoRef.current.srcObject && !isAnalyzing) {
      console.log('📸 Performing initial frame analysis');
      analyzeFrame();
    }

    let lastCaptureTime = 0;
    const CAPTURE_INTERVAL = 2500;
    
    const captureLoop = (timestamp) => {
      if (!webcamStateRef.current || !webcamVideoRef.current) {
        console.log('⛔ Capture loop exited - webcam state is off or ref missing');
        return;
      }
      
      if (timestamp - lastCaptureTime >= CAPTURE_INTERVAL && !isAnalyzing) {
        console.log(`🔄 Time for new capture: ${timestamp - lastCaptureTime}ms elapsed`);
        lastCaptureTime = timestamp;
        analyzeFrame();
      }
      
      if (webcamStateRef.current) {
        requestAnimationFrame(captureLoop);
      }
    };
    
    requestAnimationFrame(captureLoop);
    console.log('🔄 RequestAnimationFrame loop started');
    
    detectionIntervalRef.current = true;
  };

  const hasGoodFrameQuality = (imageData) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50);
        
        let brightness = 0;
        let pixels = 0;
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += (0.299 * r + 0.587 * g + 0.114 * b);
          pixels++;
        }
        
        const avgBrightness = brightness / pixels;
        const isGoodQuality = avgBrightness > 40 && avgBrightness < 220;
        
        resolve(isGoodQuality);
      };
      img.src = imageData;
    });
  };

  // Update the analyzeFrame function to show save status
  const analyzeFrame = async () => {
    if (!webcamVideoRef.current) {
      console.log('⚠️ analyzeFrame: video ref is null');
      return;
    }
    
    if (!webcamVideoRef.current.srcObject) {
      console.log('⚠️ analyzeFrame: video srcObject is null');
      return;
    }
    
    if (isAnalyzing) {
      console.log('⚠️ analyzeFrame: already analyzing');
      return;
    }

    setIsAnalyzing(true);
    console.log('📸 Starting frame analysis...');

    try {
      const canvas = document.createElement('canvas');
      const video = webcamVideoRef.current;
      
      canvas.width = 416;
      canvas.height = 416;
      
      const ctx = canvas.getContext('2d');
      ctx.filter = 'contrast(1.2)';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const isGoodQuality = await hasGoodFrameQuality(dataUrl);
      
      if (!isGoodQuality) {
        console.log('⚠️ Skipping low quality frame');
        setIsAnalyzing(false);
        return;
      }
      
      const base64Image = dataUrl.split(',')[1];
      
      console.log('📤 Sending frame for analysis, size:', base64Image.length);
      
      const res = await apiService.analyzeFrame(base64Image);
      console.log('📥 Analysis response:', res);

      if (res?.success) {
        if (res.weapon_detected) {
          const weaponList = res.weapons.map(w => w.weapon).join(', ');
          
          // Update status with save information
          let statusMessage = `🚨 WEAPON DETECTED: ${weaponList}`;
          if (res.saved_to_recent) {
            statusMessage += ' ✅ Saved to recent';
          } else if (res.time_until_next_save !== undefined) {
            statusMessage += ` ⏳ Next save in ${Math.ceil(res.time_until_next_save)}s`;
          }
          
          setDetectionStatus(statusMessage);
          
          const newDetection = {
            id: Date.now(),
            weapons: res.weapons,
            confidence: res.confidence,
            timestamp: new Date().toLocaleTimeString(),
            image: dataUrl,
            image_url: dataUrl,
            camera_name: 'Local Webcam',
            detected_at: new Date().toISOString(),
            saved_to_recent: res.saved_to_recent
          };
          
          setLastDetection(newDetection);
          
          // Only add to local detections if it was saved to recent (to match the backend behavior)
          if (res.saved_to_recent) {
            setLocalDetections(prev => {
              const newDetections = [newDetection, ...prev].slice(0, 7);
              return newDetections;
            });
            
            camwatchToast.error(`🚨 WEAPON DETECTED & SAVED: ${weaponList}`);
          } else {
            camwatchToast.warning(`🚨 WEAPON DETECTED: ${weaponList} (not saved - cooldown)`);
          }
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
    </div>
  );
};

export default StaffDashboard;