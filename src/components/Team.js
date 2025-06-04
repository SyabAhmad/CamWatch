import React from 'react';

const Team = () => {
  const teamMembers = [
    {
      name: 'Mike Johnson',
      role: 'Backend Developer',
      bio: 'Focus on security systems and database management with cloud expertise',
      email: 'mike@camwatch.com',
      gradientClass: 'from-brand-emerald-start to-brand-emerald-end',
      bgGradientClass: 'from-emerald-50 to-teal-50'
    },
    {
      name: 'Sarah Wilson',
      role: 'UI/UX Designer',
      bio: 'Creating intuitive and accessible user experiences for security systems',
      email: 'sarah@camwatch.com',
      gradientClass: 'from-brand-orange-start to-brand-red-start',
      bgGradientClass: 'from-orange-50 to-red-50'
    }
  ];

  return (
    <section id="team" className="py-20 bg-gradient-team">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gradient-primary mb-6">
            Meet Our Team
          </h2>
          <div className="max-w-4xl mx-auto bg-white/60 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-xl">
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              We built CamWatch to make schools safer through innovative AI technology. 
              Our mission is to provide reliable, privacy-focused security solutions for educational institutions.
            </p>
            <p className="text-gray-600">
              <strong>Why CamWatch?</strong> After researching school security challenges, we realized the need for 
              an intelligent, privacy-first solution that doesn't compromise on effectiveness.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {teamMembers.map((member, index) => (
            <div key={index} className={`bg-gradient-to-br ${member.bgGradientClass} rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-white/50`}>
              <div className="text-center">
                <div className={`w-24 h-24 bg-gradient-to-r ${member.gradientClass} rounded-full flex items-center justify-center text-4xl text-white mb-6 mx-auto shadow-2xl`}>
                  👤
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {member.name}
                </h3>
                <h4 className={`text-sm font-semibold bg-gradient-to-r ${member.gradientClass} bg-clip-text text-transparent mb-4`}>
                  {member.role}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  {member.bio}
                </p>
                <a 
                  href={`mailto:${member.email}`} 
                  className={`inline-block bg-gradient-to-r ${member.gradientClass} hover:shadow-lg text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105`}
                >
                  Contact
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Team Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-gradient-primary">15+</div>
            <div className="text-gray-600">Years Combined Experience</div>
          </div>
          <div className="text-center bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold bg-gradient-to-r from-brand-emerald-start to-brand-emerald-end bg-clip-text text-transparent">50+</div>
            <div className="text-gray-600">Projects Completed</div>
          </div>
          <div className="text-center bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-gradient-secondary">24/7</div>
            <div className="text-gray-600">Support Available</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Team;