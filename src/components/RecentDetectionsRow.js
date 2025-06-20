import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const RecentDetectionsRow = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingDescription, setGeneratingDescription] = useState({});

  const fetchRecentDetections = async () => {
    try {
      setLoading(true);
      const detectionsRes = await apiService.getRecentDetections();
      
      if (detectionsRes.success && Array.isArray(detectionsRes.detections)) {
        setRecentDetections(detectionsRes.detections);
      } else {
        setRecentDetections([]);
      }
    } catch (error) {
      console.error('Error fetching recent detections:', error);
      setRecentDetections([]);
    } finally {
      setLoading(false);
    }
  };

  const generateDescription = async (detectionId) => {
    setGeneratingDescription(prev => ({ ...prev, [detectionId]: true }));
    
    try {
      // Use the existing method from apiService instead of the duplicate
      const response = await apiService.getDetectionDescription(detectionId);
      if (response.success) {
        setRecentDetections(prev => 
          prev.map(detection => 
            detection.id === detectionId 
              ? { ...detection, description: response.description }
              : detection
          )
        );
      }
    } catch (error) {
      console.error('Error generating description:', error);
    } finally {
      setGeneratingDescription(prev => ({ ...prev, [detectionId]: false }));
    }
  };

  useEffect(() => {
    fetchRecentDetections();
  }, []);

  const ExpandableDescription = ({ description }) => {
    const [expanded, setExpanded] = useState(false);
    const MAX_LENGTH = 120; // Characters to show before "Read more"
    
    if (!description) return (
      <div className="bg-red-900/30 rounded-lg p-3 border border-red-600">
        <p className="text-red-300 text-sm italic">No description generated yet</p>
      </div>
    );
    
    const isLongDescription = description.length > MAX_LENGTH;
    
    return (
      <div className="bg-red-900/50 rounded-lg p-3 border border-red-600">
        <p className="text-white text-sm leading-relaxed">
          {expanded || !isLongDescription ? description : `${description.substring(0, MAX_LENGTH).trim()}...`}
        </p>
        
        {isLongDescription && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-red-300 hover:text-white mt-2 underline transition-colors"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 via-gray-900 to-black rounded-3xl p-6 border-2 border-gray-600 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
          🔥 Recent Weapon Detections
          <span className="text-sm text-gray-400 font-normal">(Last 10 detections)</span>
        </h3>
        <button 
          onClick={fetchRecentDetections}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 text-sm font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {recentDetections.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-400 text-lg">No recent detections found</p>
          <p className="text-gray-500 text-sm mt-2">Detections will appear here when weapons are detected</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recentDetections.map((detection) => (
            <div key={detection.id} className="bg-gradient-to-br from-red-800 via-red-900 to-pink-900 border-2 border-red-500 rounded-2xl p-4 shadow-xl">
              {/* Detection Image - FIXED: Use image_url instead of image_path */}
              <div className="mb-4">
                <img
                  src={detection.image_url || `http://localhost:5000/static/recent_detections/placeholder.jpg`}
                  alt="Weapon Detection"
                  className="w-full h-40 object-cover rounded-lg border border-red-400"
                  onError={(e) => {
                    // Fallback to a simple placeholder
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                {/* Fallback placeholder div */}
                <div 
                  className="w-full h-40 bg-red-900/50 rounded-lg border border-red-400 items-center justify-center text-red-300 hidden"
                  style={{ display: 'none' }}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-sm">Image not available</div>
                  </div>
                </div>
              </div>

              {/* Detection Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-200">Detection ID: {detection.id}</span>
                  <span className="text-xs text-red-200">
                    {new Date(detection.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Weapons */}
                <div>
                  <div className="text-sm text-red-200 mb-2">Detected Weapons:</div>
                  <div className="flex flex-wrap gap-1">
                    {detection.weapons?.map((weapon, idx) => (
                      <span
                        key={idx}
                        className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium"
                      >
                        {weapon.weapon} ({Math.round(weapon.confidence * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Description */}
                <div>
                  <div className="text-sm text-red-200 mb-2">AI Description:</div>
                  {detection.description ? (
                    <div>
                      <ExpandableDescription description={detection.description} />
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-red-200 mb-2">AI Description:</div>
                      <div className="bg-red-900/30 rounded-lg p-3 border border-red-600">
                        <p className="text-red-300 text-sm italic">No description generated yet</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Description Button */}
                <button
                  onClick={() => generateDescription(detection.id)}
                  disabled={generatingDescription[detection.id]}
                  className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {generatingDescription[detection.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      🤖 Generate Description through AI
                    </>
                  )}
                </button>

                {/* Confidence */}
                <div className="flex justify-between items-center text-xs text-red-200">
                  <span>Highest Confidence:</span>
                  <span className="font-bold">{Math.round(detection.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentDetectionsRow;