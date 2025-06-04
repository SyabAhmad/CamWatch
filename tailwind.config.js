/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CamWatch Brand Colors
        camwatch: {
          primary: '#06b6d4', // cyan-500
          secondary: '#8b5cf6', // violet-500
          accent: '#ec4899', // pink-500
        },
        // Gradient Color Stops
        brand: {
          blue: {
            start: '#0ea5e9', // sky-500
            end: '#3b82f6', // blue-500
          },
          purple: {
            start: '#8b5cf6', // violet-500
            end: '#a855f7', // purple-500
          },
          cyan: {
            start: '#06b6d4', // cyan-500
            end: '#0891b2', // cyan-600
          },
          emerald: {
            start: '#10b981', // emerald-500
            end: '#059669', // emerald-600
          },
          pink: {
            start: '#ec4899', // pink-500
            end: '#db2777', // pink-600
          },
          orange: {
            start: '#f97316', // orange-500
            end: '#ea580c', // orange-600
          },
          red: {
            start: '#ef4444', // red-500
            end: '#dc2626', // red-600
          },
          yellow: {
            start: '#eab308', // yellow-500
            end: '#ca8a04', // yellow-600
          },
        },
        // Background Colors
        bg: {
          primary: '#0f172a', // slate-900
          secondary: '#1e293b', // slate-800
          light: '#f8fafc', // slate-50
          glass: 'rgba(255, 255, 255, 0.1)',
        }
      },
      backgroundImage: {
        // Custom Gradients
        'gradient-primary': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
        'gradient-secondary': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
        'gradient-hero': 'linear-gradient(135deg, #0f172a, #581c87, #0f172a)',
        'gradient-feature': 'linear-gradient(135deg, #f8fafc, #dbeafe)',
        'gradient-team': 'linear-gradient(135deg, #f9fafb, #dbeafe)',
        'gradient-contact': 'linear-gradient(135deg, #0f172a, #581c87, #0f172a)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}

