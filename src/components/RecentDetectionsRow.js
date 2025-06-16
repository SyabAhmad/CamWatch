import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const RecentDetectionsRow = () => {
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentDetections = async () => {
    try {
      setLoading(true);
      // FIXED: Use the correct method name from apiService
      const detectionsRes = await apiService.getRecentDetections();
      
      // FIXED: Update the response data structure check
      if (detectionsRes.success && Array.isArray(detectionsRes.detections)) {
        setRecentDetections(detectionsRes.detections);
      } else {
        // Handle empty or invalid response
        setRecentDetections([]);
      }
    } catch (error) {
      // Reset to empty array on error
      setRecentDetections([]);
    } finally {
      setLoading(false);
    }
  };

  // ONLY fetch on initial mount - NO automatic refreshing
  useEffect(() => {
    fetchRecentDetections();
  }, []); // Empty dependency array - only run once

  return (
    <div className="bg-black/20 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-bold text-xl flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          Recent Detections
        </h3>
        <button 
          onClick={fetchRecentDetections}
          disabled={loading}
          className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
            loading 
              ? 'bg-gray-500/20 text-gray-400 border-gray-500/30 cursor-not-allowed'
              : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30 hover:border-blue-400/50'
          }`}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full"></div>
        </div>
      ) : recentDetections.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-sm">No recent detections</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recentDetections.slice(0, 8).map((detection) => (
            <div 
              key={detection.id} 
              className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-500/30 rounded-xl p-3"
            >
              {/* Image with error handling */}
              <div className="aspect-video bg-gray-800 rounded-lg mb-3 overflow-hidden">
                {detection.image_url ? (
                  <img 
                    src={detection.image_url} 
                    alt="Detection"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <span className="text-2xl">📹</span>
                  </div>
                )}
              </div>
              
              {/* Detection info */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {detection.weapons?.map((weapon, idx) => (
                    <span 
                      key={idx}
                      className="bg-red-500/80 text-white text-xs px-2 py-1 rounded-full font-medium"
                    >
                      {weapon.weapon}
                    </span>
                  ))}
                </div>
                
                <div className="text-xs text-gray-300">
                  <div>Confidence: {Math.round((detection.confidence || 0) * 100)}%</div>
                  <div>{new Date(detection.timestamp).toLocaleTimeString()}</div>
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