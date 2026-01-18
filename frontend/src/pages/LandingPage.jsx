import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Zap, Users, BarChart3, MessageSquare, X,
  Check, Smartphone, Globe, Lock, School
} from 'lucide-react';
import api from '../lib/api';

const COLORS = {
  primary: '#003333',
  accent: '#5C2438',
  white: '#ffffff',
  lightGray: '#f8fafc',
};

const Section = ({ id, className, children }) => (
  <section id={id} className={`min-h-screen py-20 px-6 md:px-12 flex flex-col justify-center ${className}`}>
    {children}
  </section>
);

const NavButton = ({ id, label, active, onClick }) => (
  <motion.button
    whileHover={{ x: 5, scale: 1.05 }}
    onClick={() => onClick(id)}
    className={`mb-4 w-full text-left px-4 py-2 rounded-lg transition-colors relative
      ${active ? 'text-white' : 'text-gray-600 hover:text-nepsis-primary'}`}
    style={{ backgroundColor: active ? COLORS.primary : 'transparent' }}
  >
    {active && (
      <motion.div
        layoutId="activeGlow"
        className="absolute inset-0 rounded-lg shadow-[0_0_15px_rgba(0,51,51,0.5)]"
        style={{ zIndex: -1 }}
      />
    )}
    <span className="font-medium">{label}</span>
  </motion.button>
);

const PricingCard = ({ title, features, recommended }) => (
  <motion.div
    whileHover={{ y: -10 }}
    className={`relative p-8 rounded-2xl border ${recommended ? 'border-nepsis-alert shadow-xl' : 'border-gray-200'}`}
    style={{ backgroundColor: COLORS.white }}
  >
    {recommended && (
      <div className="absolute top-0 right-0 bg-nepsis-alert text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
        POPULAR
      </div>
    )}
    <h3 className="text-2xl font-bold mb-4" style={{ color: COLORS.primary }}>{title}</h3>
    <ul className="space-y-3 mb-8">
      {features.map((feat, i) => (
        <li key={i} className="flex items-start">
          <Check className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
          <span className="text-gray-600 text-sm">{feat}</span>
        </li>
      ))}
    </ul>
    <button className={`w-full py-3 rounded-lg font-bold transition-all
      ${recommended ? 'bg-nepsis-alert text-white hover:opacity-90' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
      Choose {title}
    </button>
  </motion.div>
);

const ChatWindow = ({ onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your Classa Concierge. How can I help you transform your school today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/api/chat/public', { message: userMsg });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I am having trouble connecting right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-100"
    >
      <div className="p-4 bg-nepsis-primary text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h3 className="font-bold">Classa Concierge</h3>
        </div>
        <button onClick={onClose}><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
              m.role === 'user'
                ? 'bg-nepsis-primary text-white rounded-tr-none'
                : 'bg-white text-gray-800 shadow-sm border border-gray-200 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-400 text-xs ml-2">Typing...</div>}
      </div>
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nepsis-primary/20"
            placeholder="Ask about features..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} className="bg-nepsis-primary text-white p-2 rounded-lg hover:bg-opacity-90">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const LandingPage = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [chatOpen, setChatOpen] = useState(false);

  // Intersection Observer to detect active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 } // Trigger when 50% of the section is visible
    );

    const sections = ['home', 'features', 'pricing', 'services', 'contact'];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRequestDemo = (source = 'generic') => {
    window.location.href = `/public/admissions/123e4567-e89b-12d3-a456-426614174000?source=${source}`;
  };

  return (
    <div className="bg-white min-h-screen font-sans text-gray-900 selection:bg-nepsis-primary selection:text-white">

      {/* Floating Nav */}
      <motion.nav
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden lg:block"
      >
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-gray-100 flex flex-col w-40">
          {['Home', 'Features', 'Pricing', 'Services', 'Contact'].map((item) => (
            <NavButton
              key={item}
              id={item.toLowerCase()}
              label={item}
              active={activeSection === item.toLowerCase()}
              onClick={scrollTo}
            />
          ))}
        </div>
      </motion.nav>

      {/* Hero Section */}
      <Section id="home" className="bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-nepsis-primary">
                    Classa Enterprise
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
                    The Intelligent School Management System powered by Nepsis AI.
                </p>
                <div className="flex gap-4 justify-center">
                    <button onClick={() => handleRequestDemo('hero')} className="px-8 py-4 bg-nepsis-primary text-white rounded-full font-bold hover:shadow-lg hover:scale-105 transition-all">
                        Get Started
                    </button>
                    <button onClick={() => window.location.href='/login'} className="px-8 py-4 bg-white text-nepsis-primary border-2 border-nepsis-primary rounded-full font-bold hover:bg-gray-50 transition-all">
                        Login
                    </button>
                </div>
            </motion.div>
        </div>
      </Section>

      {/* Features Section */}
      <Section id="features">
        <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-16 text-nepsis-primary">Why Classa Leads</h2>
            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { icon: Shield, title: "Ironclad Security", desc: "Bank-grade encryption and secure access controls." },
                    { icon: Zap, title: "Lightning Fast", desc: "Optimized for speed even on slow connections." },
                    { icon: Users, title: "Parent Engagement", desc: "Real-time updates to keep parents in the loop." },
                    { icon: BarChart3, title: "Data Driven", desc: "Actionable insights for school boards." },
                    { icon: Smartphone, title: "Mobile First", desc: "Works perfectly on any device, anywhere." },
                    { icon: Globe, title: "Global Ready", desc: "Multi-language and multi-currency support." }
                ].map((feature, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -5 }}
                        className="p-6 bg-gray-50 rounded-xl hover:shadow-md transition-all"
                    >
                        <feature.icon className="w-10 h-10 text-nepsis-primary mb-4" />
                        <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                        <p className="text-gray-600">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
      </Section>

      {/* Pricing Section */}
      <Section id="pricing" className="bg-gray-50">
        <div className="max-w-6xl mx-auto w-full">
            <h2 className="text-4xl font-bold text-center mb-16 text-nepsis-primary">Transparent Pricing</h2>
            <div className="grid md:grid-cols-3 gap-8">
                <PricingCard
                    title="BASIC"
                    features={["Core SIS", "Parent Dashboard", "Smart Admissions"]}
                />
                <PricingCard
                    title="PLUS"
                    features={["Everything in BASIC", "AI Assistant", "Teacher's Hub", "Multilingual Support"]}
                    recommended
                />
                <PricingCard
                    title="PRO"
                    features={["Everything in PLUS", "Board 'God View'", "Risk Early Warning", "QR Safety Gate", "Audit Justification"]}
                />
            </div>
        </div>
      </Section>

      {/* Services Section */}
      <Section id="services">
        <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
                <h2 className="text-4xl font-bold mb-6 text-nepsis-primary">More Than Software</h2>
                <p className="text-lg text-gray-600 mb-6">
                    We provide end-to-end services to ensure your school succeeds. From data migration to staff training, we are with you every step of the way.
                </p>
                <ul className="space-y-4">
                    {['On-site Training', '24/7 Priority Support', 'Custom Report Generation', 'Hardware Integration'].map((s, i) => (
                        <li key={i} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-nepsis-alert" />
                            <span>{s}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="flex-1 h-80 bg-gray-200 rounded-2xl flex items-center justify-center">
                 <School className="w-32 h-32 text-gray-400" />
            </div>
        </div>
      </Section>

      {/* Contact Section */}
      <Section id="contact" className="bg-nepsis-primary text-white">
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-8">Ready to Transform Your School?</h2>
            <p className="text-xl mb-12 opacity-90">
                Join hundreds of forward-thinking schools using Classa Enterprise.
            </p>
            <div className="flex flex-col md:flex-row gap-6 justify-center">
                <input type="email" placeholder="Enter your work email" className="px-6 py-4 rounded-full text-gray-900 w-full md:w-96 focus:outline-none" />
                <button onClick={() => handleRequestDemo('footer')} className="px-8 py-4 bg-nepsis-alert text-white rounded-full font-bold hover:bg-opacity-90 transition-all">
                    Request Demo
                </button>
            </div>
        </div>
      </Section>

      {/* CTA Badge */}
      <motion.div
        className="fixed bottom-28 right-6 z-40 cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => handleRequestDemo('badge')}
      >
         <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 flex items-center gap-2">
            <span className="text-nepsis-primary font-bold text-sm">Request a FREE trial</span>
            <span className="w-2 h-2 rounded-full bg-nepsis-alert animate-pulse" />
         </div>
      </motion.div>

      {/* Chat Bubble */}
      {!chatOpen && (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-nepsis-primary text-white rounded-full shadow-2xl flex items-center justify-center z-50 hover:bg-opacity-90 transition-all"
        >
            <MessageSquare className="w-8 h-8" />
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {chatOpen && <ChatWindow onClose={() => setChatOpen(false)} />}
      </AnimatePresence>

    </div>
  );
};

export default LandingPage;
