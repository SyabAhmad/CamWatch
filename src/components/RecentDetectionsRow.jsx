import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiService from '../services/apiService';

const RecentDetectionsRow = () => {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [description, setDescription] = useState('');
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [alertingSecurity, setAlertingSecurity] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());

  const fetchDetections = async () => {
    setLoading(true);
    try {
      const response = await apiService.getRecentDetections();
      if (response.success && response.detections) {
        const newDetections = response.detections.slice(0, 10);
        setDetections(newDetections);
        setLastFetchTime(Date.now());
        
        // Log if we got new detections
        if (newDetections.length > 0) {
          console.log(`📦 Fetched ${newDetections.length} recent detections`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch recent detections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetections();
    
    // Set up polling every 3 seconds (to match save cooldown)
    const intervalId = setInterval(fetchDetections, 3000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleCardClick = async (detection) => {
    setSelectedDetection(detection);
    setDescription(detection.description || '');
    setShowDetailModal(true);
    
    // If no description exists, get it from LLaMA
    if (!detection.description) {
      setLoadingDescription(true);
      try {
        const response = await apiService.getDetectionDescription(detection.id);
        if (response.success) {
          setDescription(response.description);
          // Update the detection in our local state
          setDetections(prev => 
            prev.map(d => 
              d.id === detection.id 
                ? { ...d, description: response.description }
                : d
            )
          );
        }
      } catch (error) {
        setDescription('Failed to generate description');
      } finally {
        setLoadingDescription(false);
      }
    }
  };

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const getTimeSinceLastFetch = () => {
    const secondsAgo = Math.floor((Date.now() - lastFetchTime) / 1000);
    return secondsAgo;
  };

  const handleCreateReport = async () => {
    if (!selectedDetection) return;
    
    setCreatingReport(true);
    try {
      const response = await apiService.createDetectionReport(selectedDetection.id);
      if (response.success) {
        setGeneratedReport(response.report);
        setShowReportModal(true);
        // Show success toast
        console.log('Report created:', response.report.id);
      } else {
        console.error('Failed to create report:', response.message);
      }
    } catch (error) {
      console.error('Error creating report:', error);
    } finally {
      setCreatingReport(false);
    }
  };

  const handleAlertSecurity = async () => {
    if (!selectedDetection) return;
    
    setAlertingSecurity(true);
    try {
      const response = await apiService.alertSecurity(selectedDetection.id);
      if (response.success) {
        // Show success notification
        console.log('Security alerted:', response.alert.alert_id);
      } else {
        console.error('Failed to alert security:', response.message);
      }
    } catch (error) {
      console.error('Error alerting security:', error);
    } finally {
      setAlertingSecurity(false);
    }
  };

  return (
    <div className="mb-8 p-6 bg-black/30 backdrop-blur-lg rounded-3xl border border-white/10">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🔥 Recent Weapon Detections
          </h3>
          <div className="text-sm text-gray-400">
            (3s save cooldown)
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium border border-blue-500/30">
            {detections.length}/10
          </span>
          <button 
            onClick={fetchDetections}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 border border-white/20"
          >
            {loading ? (
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
            ) : (
              '🔄 Refresh'
            )}
          </button>
        </div>
      </div>
      
      {/* Status Info */}
      <div className="mb-4 text-sm text-gray-400">
        Last updated: {getTimeSinceLastFetch()}s ago • Images saved every 3+ seconds
      </div>
      
      {/* Detection Cards */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-4 min-w-fit">
          {detections.length > 0 ? (
            detections.map((detection, index) => (
              <div 
                key={detection.id} 
                onClick={() => handleCardClick(detection)}
                className="flex-shrink-0 w-52 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-blue-500/50 backdrop-blur-lg"
              >
                {/* Image Container */}
                <div className="relative h-36 overflow-hidden">
                  {detection.image_url ? (
                    <img 
                      src={detection.image_url} 
                      alt="Weapon detection"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-4xl opacity-50">📷</span>
                    </div>
                  )}
                  
                  {/* Confidence Badge */}
                  <div className="absolute top-2 right-2 bg-red-500/90 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                    {Math.round(detection.confidence * 100)}%
                  </div>

                  {/* Sequence Number */}
                  <div className="absolute top-2 left-2 bg-blue-500/90 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                    #{index + 1}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Weapons */}
                  <div className="flex flex-wrap gap-1">
                    {detection.weapons.slice(0, 2).map((weapon, idx) => (
                      <span 
                        key={idx}
                        className="bg-red-500/80 text-white text-xs px-2 py-1 rounded-full font-medium"
                      >
                        {weapon.weapon}
                      </span>
                    ))}
                    {detection.weapons.length > 2 && (
                      <span className="bg-gray-500/80 text-white text-xs px-2 py-1 rounded-full">
                        +{detection.weapons.length - 2}
                      </span>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  <div className="text-gray-300 text-xs">
                    {formatTimestamp(detection.timestamp)}
                  </div>
                  
                  {/* Click hint */}
                  <div className="text-blue-400 text-xs italic text-center">
                    Click for AI description
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-6xl opacity-30 mb-4">🔍</div>
                <div className="text-gray-400">
                  {loading ? "Loading detections..." : "No weapon detections saved yet"}
                </div>
                <div className="text-gray-500 text-sm mt-2">
                  Detections are saved every 3+ seconds to avoid duplicates
                </div>
              </div>
            </div>
          )}
          
          {/* Placeholder cards */}
          {detections.length > 0 && detections.length < 10 && 
            Array(10 - detections.length).fill(0).map((_, idx) => (
              <div 
                key={`placeholder-${idx}`} 
                className="flex-shrink-0 w-52 h-72 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center bg-white/5"
              >
                <div className="text-center">
                  <div className="text-4xl opacity-20 mb-2">📷</div>
                  <div className="text-gray-500 text-sm">Waiting...</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedDetection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDetailModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-gray-900 border border-white/20 rounded-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">🚨 Weapon Detection Analysis</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Image & Details */}
                <div className="space-y-4">
                  {/* Image */}
                  {selectedDetection.image_url && (
                    <div className="relative">
                      <img 
                        src={selectedDetection.image_url} 
                        alt="Detection"
                        className="w-full max-h-80 object-contain rounded-xl border-2 border-red-500/30"
                      />
                    </div>
                  )}
                  
                  {/* Detection Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                      <div className="text-gray-300 text-sm mb-1">Detection Time</div>
                      <div className="text-white font-medium text-sm">
                        {formatTimestamp(selectedDetection.timestamp)}
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                      <div className="text-gray-300 text-sm mb-1">Confidence</div>
                      <div className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold inline-block">
                        {Math.round(selectedDetection.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Weapons List */}
                  <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <h3 className="text-white font-semibold mb-3">Detected Weapons:</h3>
                    <div className="space-y-2">
                      {selectedDetection.weapons.map((weapon, idx) => (
                        <div 
                          key={idx} 
                          className="flex justify-between items-center bg-red-500/20 border border-red-500/30 rounded-lg p-3"
                        >
                          <span className="text-white font-medium">{weapon.weapon}</span>
                          <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                            {Math.round(weapon.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Right Column - AI Description with Markdown */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold text-lg">🤖 AI Security Analysis:</h3>
                  <div className="bg-white/10 rounded-xl p-4 border border-white/20 min-h-[200px] flex flex-col">
                    {loadingDescription ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                          <div className="text-gray-300">Generating analysis...</div>
                          <div className="text-gray-400 text-xs mt-2">AI processing...</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        {/* Markdown Rendering */}
                        <div className="text-gray-200 leading-relaxed text-sm markdown-content">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                              h2: ({children}) => <h2 className="text-md font-semibold text-white mb-2">{children}</h2>,
                              h3: ({children}) => <h3 className="text-sm font-semibold text-gray-200 mb-1">{children}</h3>,
                              strong: ({children}) => <strong className="font-bold text-red-300">{children}</strong>,
                              em: ({children}) => <em className="italic text-blue-300">{children}</em>,
                              ul: ({children}) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside space-y-1 ml-2">{children}</ol>,
                              li: ({children}) => <li className="text-gray-200">{children}</li>,
                              p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                              code: ({children}) => <code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-300">{children}</code>
                            }}
                          >
                            {description || '**No analysis available**\n\n*Click to generate AI assessment*'}
                          </ReactMarkdown>
                        </div>
                        
                        {/* Generation info */}
                        <div className="mt-4 pt-3 border-t border-white/10">
                          <div className="text-xs text-gray-400">
                            Powered by LLaMA AI • Markdown formatted
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleAlertSecurity}
                      disabled={alertingSecurity}
                      className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {alertingSecurity ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full"></div>
                          Alerting...
                        </>
                      ) : (
                        <>🚨 Alert Security</>
                      )}
                    </button>
                    
                    <button 
                      onClick={handleCreateReport}
                      disabled={creatingReport}
                      className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {creatingReport ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full"></div>
                          Creating...
                        </>
                      ) : (
                        <>📋 Create Report</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-white/10">
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && generatedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowReportModal(false)}
          ></div>
          
          <div className="relative bg-gray-900 border border-white/20 rounded-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">📋 Security Report Generated</h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                <div className="text-green-300 font-semibold">✅ Report Created Successfully</div>
                <div className="text-green-200 text-sm mt-1">
                  Report ID: <code className="bg-gray-800 px-1 py-0.5 rounded">{generatedReport.id}</code>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Status</div>
                  <div className="text-white font-medium">{generatedReport.status}</div>
                </div>
                <div>
                  <div className="text-gray-400">Severity</div>
                  <div className={`font-medium ${generatedReport.severity === 'high' ? 'text-red-300' : 'text-yellow-300'}`}>
                    {generatedReport.severity.toUpperCase()}
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-gray-300 text-sm">Report submitted to security team for review.</div>
              </div>
            </div>
            
            <div className="flex justify-end p-6 border-t border-white/10">
              <button
                onClick={() => setShowReportModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-300"
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

export default RecentDetectionsRow;