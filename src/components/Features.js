import React from 'react';

const Features = () => {
  const features = [
    {
      icon: '🔍',
      title: 'Real-time Threat Detection',
      description: 'Advanced AI algorithms detect potential threats instantly with 99.9% accuracy',
      color: 'from-cyan-500 to-blue-600',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30'
    },
    {
      icon: '👥',
      title: 'Secure User Management',
      description: 'Robust authentication and user role management system with encryption',
      color: 'from-purple-500 to-indigo-600',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30'
    },
    {
      icon: '🔐',
      title: 'Admin-Controlled Access',
      description: 'Complete administrative control over user permissions and system access',
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30'
    },
    {
      icon: '🚨',
      title: 'Alerts & Notifications',
      description: 'Instant alerts to admin and emergency services with customizable triggers',
      color: 'from-red-500 to-pink-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30'
    },
    {
      icon: '🛡️',
      title: 'Privacy-Focused',
      description: 'Local AI model ensures data privacy and security without cloud dependency',
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30'
    },
    {
      icon: '⚡',
      title: 'Fast Response',
      description: 'Lightning-fast threat assessment and immediate action protocols',
      color: 'from-yellow-500 to-orange-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30'
    }
  ];

  return (
    <section id="features" className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 mb-4">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover the cutting-edge capabilities that make CamWatch the ultimate school security solution
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`${feature.bgColor} ${feature.borderColor} border backdrop-blur-lg rounded-2xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group`}
            >
              <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-gray-700 transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-xl">
            Explore All Features
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;