import { toast } from 'sonner';

// Custom toast configurations with dismiss functionality
export const showToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      style: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
      },
      duration: 4000,
      ...options
    });
  },

  error: (message, options = {}) => {
    return toast.error(message, {
      style: {
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        color: 'white',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
      },
      duration: 5000,
      ...options
    });
  },

  warning: (message, options = {}) => {
    return toast.warning(message, {
      style: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: 'white',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
      },
      duration: 4000,
      ...options
    });
  },

  info: (message, options = {}) => {
    return toast.info(message, {
      style: {
        background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
        color: 'white',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
      },
      duration: 4000,
      ...options
    });
  },

  loading: (message, options = {}) => {
    return toast.loading(message, {
      style: {
        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        color: 'white',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
      },
      ...options
    });
  },

  promise: (promise, messages, options = {}) => {
    return toast.promise(promise, messages, {
      style: {
        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        color: 'white',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
      },
      ...options
    });
  },

  custom: (component, options = {}) => {
    return toast.custom(component, {
      style: {
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
      },
      ...options
    });
  },

  // Add dismiss functionality - this was missing!
  dismiss: (toastId) => {
    if (toastId) {
      return toast.dismiss(toastId);
    } else {
      return toast.dismiss(); // Dismiss all toasts
    }
  },

  // Add dismissAll functionality
  dismissAll: () => {
    return toast.dismiss();
  }
};

// Themed toasts for CamWatch
export const camwatchToast = {
  loginSuccess: (userName) => {
    return showToast.success(`Welcome back, ${userName}! 🎉`, {
      description: 'Login successful. Redirecting to dashboard...',
      icon: '🔐'
    });
  },

  loginError: (error) => {
    return showToast.error('Login Failed', {
      description: error || 'Please check your credentials and try again.',
      icon: '❌'
    });
  },

  threatDetected: (type, location) => {
    return showToast.warning(`⚠️ ${type} Detected`, {
      description: `Location: ${location}. Authorities have been notified.`,
      duration: 8000,
      style: {
        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        border: '1px solid rgba(220, 38, 38, 0.5)',
      }
    });
  },

  userAdded: (userName) => {
    return showToast.success(`User Added Successfully! 👤`, {
      description: `${userName} has been added to the system.`,
      icon: '✅'
    });
  },

  systemOnline: () => {
    return showToast.info('System Online 🟢', {
      description: 'All cameras are active and monitoring.',
      icon: '📹'
    });
  },

  connectionLost: () => {
    return showToast.error('Connection Lost 🔴', {
      description: 'Attempting to reconnect...',
      icon: '🌐'
    });
  },

  // Add more specific toast methods
  validationError: (message) => {
    return showToast.warning('Validation Error', {
      description: message || 'Please check your input and try again.',
      icon: '⚠️'
    });
  },

  networkError: () => {
    return showToast.error('Network Error', {
      description: 'Please check your connection and try again.',
      icon: '🌐',
      duration: 6000
    });
  },

  unauthorized: () => {
    return showToast.error('Access Denied', {
      description: 'Your session has expired. Please login again.',
      icon: '🔒',
      duration: 6000
    });
  }
};

// Export toast from sonner directly for advanced usage
export { toast };