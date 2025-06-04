import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LottieLoader from './common/LottieLoader';

// General Protected Route (requires login)
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center">
          <LottieLoader 
            type="security" 
            size={120} 
            message="Loading authentication..." 
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Admin Only Route
export const AdminRoute = ({ children }) => {
  const { isAdmin, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center">
          <LottieLoader 
            type="security" 
            size={120} 
            message="Verifying admin permissions..." 
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-gradient-to-r from-brand-red-start to-brand-orange-start rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-400 mb-6">Administrator access required.</p>
          <button 
            onClick={() => window.history.back()}
            className="bg-gradient-to-r from-brand-cyan-start to-brand-blue-end text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// Staff Route (Staff + Admin)
export const StaffRoute = ({ children }) => {
  const { isStaff, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center">
          <LottieLoader 
            type="camera" 
            size={120} 
            message="Checking access permissions..." 
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isStaff()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-gradient-to-r from-brand-red-start to-brand-orange-start rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-400 mb-6">Staff access required.</p>
          <button 
            onClick={() => window.history.back()}
            className="bg-gradient-to-r from-brand-cyan-start to-brand-blue-end text-white px-6 py-2 rounded-2xl font-medium transition-all duration-300 hover:scale-105"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// Public Route (logged in users get redirected)
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated()) {
    if (user?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};