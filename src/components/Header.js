import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 shadow-2xl sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-brand-cyan-start to-brand-blue-end rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-xl">🎥</span>
              </div>
              <h2 className="text-2xl font-bold text-gradient-primary">
                CamWatch
              </h2>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="#home" className="text-gray-300 hover:text-brand-cyan-start px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300">
                Home
              </a>
              <a href="#features" className="text-gray-300 hover:text-brand-cyan-start px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300">
                Features
              </a>
              <a href="#how-it-works" className="text-gray-300 hover:text-brand-cyan-start px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300">
                How It Works
              </a>
              <a href="#team" className="text-gray-300 hover:text-brand-cyan-start px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300">
                Team
              </a>
              <a href="#contact" className="text-gray-300 hover:text-brand-cyan-start px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300">
                Contact
              </a>
              <Link to="/login" className="bg-gradient-to-r from-brand-cyan-start to-brand-blue-end hover:from-brand-cyan-end hover:to-brand-blue-start text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg">
                Login
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-white p-2"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-black bg-opacity-50 rounded-lg mt-2">
              <a href="#home" className="text-gray-300 hover:text-brand-cyan-start block px-3 py-2 rounded-md text-base font-medium">Home</a>
              <a href="#features" className="text-gray-300 hover:text-brand-cyan-start block px-3 py-2 rounded-md text-base font-medium">Features</a>
              <a href="#how-it-works" className="text-gray-300 hover:text-brand-cyan-start block px-3 py-2 rounded-md text-base font-medium">How It Works</a>
              <a href="#team" className="text-gray-300 hover:text-brand-cyan-start block px-3 py-2 rounded-md text-base font-medium">Team</a>
              <a href="#contact" className="text-gray-300 hover:text-brand-cyan-start block px-3 py-2 rounded-md text-base font-medium">Contact</a>
              <Link to="/login" className="bg-gradient-to-r from-brand-cyan-start to-brand-blue-end text-white block px-3 py-2 rounded-md text-base font-medium">Login</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;