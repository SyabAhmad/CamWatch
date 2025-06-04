import React from 'react';

const HowItWorks = () => {
  const steps = [
    {
      step: '1',
      title: 'Capture Camera Feed',
      description: 'System continuously monitors live camera feeds from school premises with high-resolution clarity',
      icon: '📹',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      step: '2',
      title: 'Detect Threats Using AI',
      description: 'Advanced AI algorithms analyze footage for potential security threats in real-time',
      icon: '🤖',
      color: 'from-purple-500 to-pink-500'
    },
    {
      step: '3',
      title: 'Alert Admin & Authorities',
      description: 'Immediate notifications sent to administrators and emergency services with detailed reports',
      icon: '🚨',
      color: 'from-red-500 to-orange-500'
    },
    {
      step: '4',
      title: 'Keep Everyone Safe',
      description: 'Quick response ensures safety of students, staff, and visitors through coordinated action',
      icon: '🛡️',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Simple, efficient, and powerful - see how CamWatch protects your school in four easy steps
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div className="hidden xl:block absolute top-1/2 right-0 w-8 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transform translate-x-4 -translate-y-1/2 z-10"></div>
              )}
              
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:border-white/40 transition-all duration-300 transform hover:-translate-y-2 h-full">
                <div className={`w-20 h-20 bg-gradient-to-r ${step.color} rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto shadow-2xl`}>
                  {step.icon}
                </div>
                <div className={`w-12 h-12 bg-gradient-to-r ${step.color} rounded-full flex items-center justify-center text-white font-bold text-xl mb-6 mx-auto`}>
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  {step.title}
                </h3>
                <p className="text-gray-300 leading-relaxed text-center">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline for Mobile */}
        <div className="xl:hidden mt-12">
          <div className="flex justify-center">
            <div className="flex items-center space-x-2">
              {steps.map((_, index) => (
                <React.Fragment key={index}>
                  <div className="w-4 h-4 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full"></div>
                  {index < steps.length - 1 && <div className="w-8 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400"></div>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;