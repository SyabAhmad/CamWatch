import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-t border-purple-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-xl">🎥</span>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                CamWatch
              </h3>
            </div>
            <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
              AI-Powered School Security System protecting students, staff, and visitors through 
              intelligent monitoring and real-time threat detection.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white hover:scale-110 transition-transform duration-300">
                <span>🔗</span>
              </a>
              <a href="#" className="w-10 h-10 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-white hover:scale-110 transition-transform duration-300">
                <span>🐙</span>
              </a>
              <a href="#" className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg flex items-center justify-center text-white hover:scale-110 transition-transform duration-300">
                <span>🐦</span>
              </a>
              <a href="#" className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg flex items-center justify-center text-white hover:scale-110 transition-transform duration-300">
                <span>📧</span>
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-3">
              <li><a href="#home" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">🏠</span>Home</a></li>
              <li><a href="#features" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">⭐</span>Features</a></li>
              <li><a href="#how-it-works" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">⚙️</span>How It Works</a></li>
              <li><a href="#team" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">👥</span>Team</a></li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-3">
              <li><a href="#contact" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">📞</span>Contact</a></li>
              <li><a href="#login" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">🔐</span>Login</a></li>
              <li><a href="#privacy" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">🛡️</span>Privacy Policy</a></li>
              <li><a href="#terms" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center"><span className="mr-2">📄</span>Terms of Service</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-purple-500/30 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <p className="text-gray-300">
                &copy; 2025 CamWatch. All rights reserved.
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Built with ❤️ for safer schools
              </p>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                System Status: Online
              </span>
              <span>v2.1.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;