import React from 'react';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import Team from './Team';
import Contactus from './Contactus';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <Hero />
      <Features />
      <HowItWorks />
      <Team />
      <Contactus />
    </div>
  );
};

export default LandingPage;