import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LottieLoader from './common/LottieLoader';
<<<<<<< HEAD
import { showToast, camwatchToast } from '../utils/toast'; 
import apiService from '../services/apiService'; 
=======
import { showToast, camwatchToast, toast } from '../utils/toast';
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
<<<<<<< HEAD
  const { user, login, logout } = useAuth(); // Destructure user and logout
=======
  const { login } = useAuth();
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
<<<<<<< HEAD
    rememberMe: false // Keep for staff if desired
=======
    rememberMe: false
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
<<<<<<< HEAD
  const [loginMode, setLoginMode] = useState('staff'); 

  const handleLogout = () => {
    logout(); // AuthContext's logout should handle clearing state and localStorage
    camwatchToast.info('You have been logged out successfully.');
    // Optional: navigate('/login'); // Ensure user stays or is redirected to login
                                  // AuthProvider might handle redirection based on auth state change.
  };

=======
  const [currentTimePassword, setCurrentTimePassword] = useState('');
  const [loginMode, setLoginMode] = useState('staff'); // 'admin' or 'staff'

  // Get the page user was trying to access
  const from = location.state?.from?.pathname || '/dashboard';

  // Generate time-based password (HHMM format)
  const generateTimePassword = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}${minutes}`;
  };

  // Update time-based password every minute
  useEffect(() => {
    const updatePassword = () => {
      setCurrentTimePassword(generateTimePassword());
    };

    // Set initial password
    updatePassword();

    // Update every minute
    const interval = setInterval(updatePassword, 60000);

    return () => clearInterval(interval);
  }, []);

>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
<<<<<<< HEAD
=======
    // Clear error when user starts typing
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
<<<<<<< HEAD
    if (!formData.email) {
      newErrors.email = loginMode === 'admin' ? 'Admin Email/Username is required' : 'Email is required';
    } else if (loginMode === 'staff' && !/\S+@\S+\.\S+/.test(formData.email)) {
      // Keep email format validation for staff, admin might use username
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (loginMode === 'staff' && formData.password.length < 6) {
      // Keep password length for staff if desired
      newErrors.password = 'Password must be at least 6 characters';
    }
    // Removed complex admin password validation (e.g., time-based, superadmin specific)
    
=======
    if (loginMode === 'admin') {
      // Admin validation - check for admin email or "admin" username
      if (!formData.email) {
        newErrors.email = 'Admin email or username is required';
      } else if (formData.email !== 'admin' && formData.email !== 'admin@camwatch.local') {
        newErrors.email = 'Use "admin" or "admin@camwatch.local"';
      }
      
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password !== currentTimePassword) {
        newErrors.password = `Password must be current time: ${currentTimePassword}`;
      }
    } else {
      // Staff validation
      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }
    
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      camwatchToast.validationError('Please fix the form errors');
      return;
    }
    
    setIsLoading(true);
    setErrors({});
    
    const loadingToastId = showToast.loading(
      loginMode === 'admin' ? 'Admin Authentication...' : 'Staff Authentication...', 
      {
<<<<<<< HEAD
        description: 'Verifying credentials with server...'
=======
        description: loginMode === 'admin' ? 'Verifying time-based credentials' : 'Verifying staff credentials'
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
      }
    );
    
    try {
<<<<<<< HEAD
=======
      // Use real API call for both admin and staff
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
      const response = await apiService.login(formData.email, formData.password);
      
      showToast.dismiss(loadingToastId);
      
      if (response.success) {
<<<<<<< HEAD
        console.log('Login response:', response);
        console.log('Token received:', response.token);
        
=======
        console.log('Login response:', response); // Debug log
        console.log('Token received:', response.token); // Debug log
        
        // Validate token format before storing
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
        if (!response.token || typeof response.token !== 'string') {
          throw new Error('Invalid token received from server');
        }
        
<<<<<<< HEAD
=======
        // Check if token has proper JWT format (3 segments separated by dots)
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
        const tokenParts = response.token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Malformed JWT token received');
        }
        
<<<<<<< HEAD
        // localStorage items are typically set by the AuthContext's login method
        // localStorage.setItem('authToken', response.token);
        // localStorage.setItem('user', JSON.stringify(response.user));
        
        const authContextLoginSuccess = login(response.user, response.token); 
        
        if (authContextLoginSuccess) {
          camwatchToast.loginSuccess(response.user.name);
          
          setTimeout(() => {
            const redirectTo = location.state?.from?.pathname || (response.user.role === 'admin' ? '/admin' : '/dashboard');
            navigate(redirectTo);
          }, 1000);
        } else {
            throw new Error('Failed to update authentication context.');
=======
        // Store token and user data consistently
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        const success = login(response.user, response.token);
        
        if (success) {
          camwatchToast.loginSuccess(response.user.name);
          
          setTimeout(() => {
            if (response.user.role === 'admin') {
              navigate('/admin');
            } else {
              navigate('/dashboard');
            }
          }, 1000);
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast.dismiss(loadingToastId);
      
<<<<<<< HEAD
      let errorMessage = 'Login failed. Please check your credentials.';
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && error.message.includes('Network Error')) {
        camwatchToast.networkError(); // This will show its own message
        errorMessage = ''; // Avoid double messaging
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (errorMessage) { // Only show general error if not handled by specific toast
        camwatchToast.loginError(errorMessage);
      }
      
      setErrors({ general: errorMessage });
=======
      if (error.message && error.message.includes('Network Error')) {
        camwatchToast.networkError();
      } else {
        camwatchToast.loginError(error.message || 'Login failed. Please try again.');
      }
      
      setErrors({ general: error.message || 'Login failed. Please try again.' });
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
    } finally {
      setIsLoading(false);
    }
  };

  // SSO Login Handler
  const handleSSOLogin = async () => {
    const loadingToastId = showToast.loading('SSO Authentication...', {
      description: 'Connecting to Single Sign-On service'
    });
    
    setIsLoading(true);
    
    try {
      // Simulate SSO authentication process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const adminData = {
        id: 1,
        email: 'admin@sso.school.edu',
        role: 'admin',
        name: 'SSO Administrator'
      };
      const token = `sso-admin-token-${Date.now()}`;
      
      showToast.dismiss(loadingToastId);
      
      const success = login(adminData, token);
      
      if (success) {
        showToast.success('SSO Login Successful! 🔐', {
          description: 'Welcome, SSO Administrator!',
          icon: '✅'
        });
        
        setTimeout(() => {
          navigate('/admin');
        }, 1000);
      }
    } catch (error) {
      showToast.dismiss(loadingToastId);
      camwatchToast.loginError('SSO authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

<<<<<<< HEAD
  // Quick admin login - this will now just fill a predefined admin email
  // and the user has to type the actual DB password.
  const handleQuickAdminLogin = () => {
    setLoginMode('admin');
    setFormData(prev => ({
      ...prev,
      email: 'admin@example.com', // Or your default admin email registered in DB
      password: '', // User needs to enter the actual password
    }));
    // camwatchToast.info("Admin email filled. Please enter password.", { description: "Password is now checked against the database."});
  };
  
  // School Directory Login Handler - This needs significant rework
  // as it relied on client-side time-based password.
  // It could be repurposed or removed.
  const handleSchoolDirectoryLogin = async () => {
    showToast.info('School Directory Login', {
      description: `This feature is being updated. Please use the main login form.`,
      duration: 5000
    });
    // Or, if you have a specific user for this in DB:
    // setLoginMode('admin');
    // setFormData({
    //   email: 'school_directory_admin@example.com', // A user you'd register in DB
    //   password: '', // User would type password
    //   rememberMe: false
    // });
=======
  // School Directory Login Handler
  const handleSchoolDirectoryLogin = async () => {
    // Show current time password in alert
    const timePassword = generateTimePassword();
    
    showToast.info('School Directory Login', {
      description: `Username: admin | Password: ${timePassword} (time-based)`,
      duration: 5000
    });
    
    // Auto-fill admin credentials
    setLoginMode('admin');
    setFormData({
      email: 'admin@camwatch.local',
      password: timePassword,
      rememberMe: false
    });
    
    const loadingToastId = showToast.loading('School Directory Authentication...', {
      description: 'Verifying time-based credentials'
    });
    
    setIsLoading(true);
    
    try {
      // Simulate school directory authentication
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const adminData = {
        id: 1,
        email: 'admin@school.directory',
        role: 'admin',
        name: 'School Directory Admin'
      };
      const token = `school-dir-admin-token-${Date.now()}`;
      
      showToast.dismiss(loadingToastId);
      
      const success = login(adminData, token);
      
      if (success) {
        showToast.success('School Directory Login Successful! 🏫', {
          description: 'Time-based authentication verified!',
          icon: '✅'
        });
        
        setTimeout(() => {
          navigate('/admin');
        }, 1000);
      }
    } catch (error) {
      showToast.dismiss(loadingToastId);
      camwatchToast.loginError('School directory authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick admin login
  const handleQuickAdminLogin = () => {
    setLoginMode('admin');
    setFormData({
      email: 'admin@camwatch.local',
      password: currentTimePassword,
      rememberMe: false
    });
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
  };

  // Demo login function (unchanged but improved)
  const handleDemoLogin = async (email, password, role) => {
    setFormData({ email, password, rememberMe: false });
    
    const loadingToastId = showToast.loading(`Logging in as ${role}...`, {
      description: 'Demo authentication in progress'
    });
    
    setIsLoading(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const userData = {
        id: role === 'admin' ? 1 : 2,
        email,
        role,
        name: role === 'admin' ? 'Admin User' : 'Staff User'
      };
      const token = `demo-${role}-token-${Date.now()}`;
      
      showToast.dismiss(loadingToastId);
      
      const success = login(userData, token);
      
      if (success) {
        camwatchToast.loginSuccess(userData.name);
        
        setTimeout(() => {
          navigate(role === 'admin' ? '/admin' : '/dashboard');
        }, 1000);
      }
    } catch (error) {
      showToast.dismiss(loadingToastId);
      camwatchToast.loginError('Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-cyan-start rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-purple-start rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-brand-pink-start rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-2000"></div>
      </div>

      <div className="relative w-full max-w-md px-6">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-brand-cyan-start to-brand-blue-end rounded-2xl flex items-center justify-center mr-4 shadow-2xl">
              <span className="text-white font-bold text-2xl">🎥</span>
            </div>
            <h1 className="text-3xl font-bold text-gradient-primary">
              CamWatch
            </h1>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-300">Sign in to access your security dashboard</p>
        </div>

<<<<<<< HEAD
        {/* Conditional Logout Section */}
        {user && (
          <div className="my-6 p-4 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 text-center shadow-lg">
            <p className="text-gray-200 text-sm mb-3">
              Currently logged in as <strong className="text-white">{user.name}</strong> ({user.email}).
            </p>
            <button
              onClick={handleLogout}
              disabled={isLoading} // Disable if a login attempt is in progress
              className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-medium py-2 px-6 rounded-xl transition-all duration-300 text-sm shadow-md hover:shadow-lg disabled:opacity-50"
            >
              Logout
            </button>
          </div>
        )}

=======
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
        {/* Login Mode Toggle */}
        <div className="mb-6 bg-white/10 backdrop-blur-lg rounded-2xl p-1 border border-white/20">
          <div className="flex">
            <button
              onClick={() => setLoginMode('staff')}
              disabled={isLoading}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                loginMode === 'staff' 
                  ? 'bg-brand-cyan-start text-white shadow-lg' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              👨‍🏫 Staff Login
            </button>
            <button
              onClick={() => setLoginMode('admin')}
              disabled={isLoading}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                loginMode === 'admin' 
                  ? 'bg-brand-purple-start text-white shadow-lg' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              👨‍💼 Admin Login
            </button>
          </div>
        </div>

<<<<<<< HEAD
=======
        {/* Admin Time-based Password Display */}
        {loginMode === 'admin' && (
          <div className="mb-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-4 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-purple-300">Admin Access</h4>
                <p className="text-xs text-gray-400">Email: admin@camwatch.local | Time-based password</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-bold text-white bg-purple-500/30 px-3 py-1 rounded-lg">
                  {currentTimePassword}
                </div>
                <p className="text-xs text-gray-400 mt-1">Current Password</p>
              </div>
            </div>
          </div>
        )}

>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">
                {errors.general}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                {loginMode === 'admin' ? 'Admin Email/Username' : 'Email Address'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400">
                    {loginMode === 'admin' ? '👨‍💼' : '📧'}
                  </span>
                </div>
                <input
                  type={loginMode === 'admin' ? 'text' : 'email'}
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={`w-full pl-12 pr-4 py-3 bg-white/10 border ${
                    errors.email ? 'border-red-500/50' : 'border-white/20'
                  } rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan-start focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                  placeholder={
                    loginMode === 'admin' 
<<<<<<< HEAD
                      ? 'admin.user@example.com' // Updated placeholder
=======
                      ? 'admin or admin@camwatch.local' 
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
                      : 'staff@school.edu'
                  }
                  autoComplete={loginMode === 'admin' ? 'username' : 'email'}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
<<<<<<< HEAD
                {/* REMOVE: Admin time password hint */}
                {/* {loginMode === 'admin' && (
                  <span className="text-purple-300 text-xs ml-2">
                    (Current time: {currentTimePassword})
                  </span>
                )} */}
=======
                {loginMode === 'admin' && (
                  <span className="text-purple-300 text-xs ml-2">
                    (Current time: {currentTimePassword})
                  </span>
                )}
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔒</span>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={`w-full pl-12 pr-12 py-3 bg-white/10 border ${
                    errors.password ? 'border-red-500/50' : 'border-white/20'
                  } rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan-start focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
<<<<<<< HEAD
                  placeholder={loginMode === 'admin' ? 'Enter admin password' : 'Enter your password'} // Updated placeholder
=======
                  placeholder={loginMode === 'admin' ? currentTimePassword : 'Enter your password'}
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors duration-300 disabled:opacity-50"
                >
                  <span>{showPassword ? '🙈' : '👁️'}</span>
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-sm">{errors.password}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password (only for staff) */}
            {loginMode === 'staff' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="w-4 h-4 text-brand-cyan-start bg-white/10 border-white/20 rounded focus:ring-brand-cyan-start focus:ring-2 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-300">Remember me</span>
                </label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-brand-cyan-start hover:text-brand-cyan-end transition-colors duration-300"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${
                loginMode === 'admin'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  : 'bg-gradient-to-r from-brand-cyan-start to-brand-blue-end hover:from-brand-cyan-end hover:to-brand-blue-start'
              } text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl ${
                isLoading ? 'opacity-50 cursor-not-allowed scale-100' : 'hover:shadow-lg'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-3">
                  <LottieLoader 
                    type="spinner" 
                    size={20} 
                    showMessage={false}
                    className="text-white"
                  />
                  <span>
                    {loginMode === 'admin' ? 'Admin Authentication...' : 'Staff Authentication...'}
                  </span>
                </div>
              ) : (
                `Sign In as ${loginMode === 'admin' ? 'Admin' : 'Staff'}`
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center">
            <div className="flex-1 border-t border-white/20"></div>
            <span className="px-4 text-sm text-gray-400">or</span>
            <div className="flex-1 border-t border-white/20"></div>
          </div>

          {/* SSO and School Directory Buttons */}
          <div className="space-y-3">
            <button 
              onClick={handleSSOLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/30 text-white font-medium py-3 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <span>🔐</span>
              <span>Single Sign-On (Admin Access)</span>
            </button>
            
            <button 
              onClick={handleSchoolDirectoryLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 text-white font-medium py-3 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <span>🏫</span>
              <span>School Directory (Time-based Auth)</span>
            </button>
          </div>

          {/* Quick Access for Admin */}
          {loginMode === 'admin' && (
            <div className="mt-6">
              <button 
                onClick={handleQuickAdminLogin}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-white font-medium py-2 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <span>⚡</span>
                <span>Quick Fill Admin Credentials</span>
              </button>
            </div>
          )}

          {/* Registration Info */}
          <div className="mt-8 text-center">
            <p className="text-gray-300 text-sm">
              {loginMode === 'staff' ? (
                <>
                  Don't have an account?{' '}
                  <span className="text-brand-cyan-start font-medium">
                    Contact your administrator to register
                  </span>
                </>
              ) : (
                <span className="text-purple-300">
                  Admin access with time-based authentication
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 text-center">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <span>🛡️</span>
              <span>
                {loginMode === 'admin' 
                  ? 'Admin access with time-based authentication' 
                  : 'Staff access requires admin registration'
                }
              </span>
            </div>
          </div>
        </div>

<<<<<<< HEAD
        {/* Demo Credentials - Update this section or remove time-based info */}
        <div className="mt-6 bg-blue-500/10 backdrop-blur-lg rounded-2xl p-4 border border-blue-500/20">
          <h4 className="text-sm font-semibold text-blue-300 mb-3">Demo Credentials (DB backed):</h4>
          <div className="space-y-2">
            <p className="text-xs text-gray-300">
              Use an admin or staff account registered in the database.
            </p>
            <p className="text-xs text-gray-300">
              Example Admin (if registered via script): admin@example.com / (your chosen password)
            </p>
            {/* Remove or update the time-based password hint */}
            {/* <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 mt-2">
              <p className="text-xs text-green-300">
                <strong>Admin Time-based:</strong> admin@camwatch.local / {currentTimePassword} (updates every minute)
              </p>
            </div> */}
=======
        {/* Demo Credentials */}
        <div className="mt-6 bg-blue-500/10 backdrop-blur-lg rounded-2xl p-4 border border-blue-500/20">
          <h4 className="text-sm font-semibold text-blue-300 mb-3">Demo Credentials:</h4>
          <div className="space-y-2">
            <button
              onClick={() => handleDemoLogin('admin@demo.com', 'admin123', 'admin')}
              disabled={isLoading}
              className="w-full text-left text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg p-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <strong>Demo Admin:</strong> admin@demo.com / admin123 → Admin Dashboard
            </button>
            <button
              onClick={() => handleDemoLogin('staff@demo.com', 'admin123', 'staff')}
              disabled={isLoading}
              className="w-full text-left text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg p-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <strong>Demo Staff:</strong> staff@demo.com / admin123 → Staff Dashboard
            </button>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 mt-2">
              <p className="text-xs text-green-300">
                <strong>Admin Time-based:</strong> admin@camwatch.local / {currentTimePassword} (updates every minute)
              </p>
            </div>
>>>>>>> 7194d6824a069d5a22181bb85a7e296d02818c52
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;