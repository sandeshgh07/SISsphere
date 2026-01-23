import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
      const res = await api.post('/chat/public', { message: userMsg });
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
            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${m.role === 'user'
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
  const navigate = useNavigate();

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    school_name: '',
    message: ''
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  // Handle contact form submission
  const handleContactSubmit = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
      return;
    }
    setContactSubmitting(true);
    try {
      await api.post('/public/contact', contactForm);
      setContactSuccess(true);
      setContactForm({ name: '', email: '', subject: '', school_name: '', message: '' });
      setTimeout(() => setContactSuccess(false), 5000);
    } catch (err) {
      console.error('Contact form error:', err);
    } finally {
      setContactSubmitting(false);
    }
  };

  // School search state
  const [schools, setSchools] = useState([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  // Load schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      setSchoolsLoading(true);
      try {
        const res = await api.get('/public/schools');
        setSchools(res.data || []);
      } catch (err) {
        console.error('Failed to load schools:', err);
      } finally {
        setSchoolsLoading(false);
      }
    };
    loadSchools();
  }, []);

  // Filter schools based on search
  const filteredSchools = schools.filter(school =>
    school.name?.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    school.slug?.toLowerCase().includes(schoolSearch.toLowerCase())
  );

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

    const sections = ['home', 'features', 'pricing', 'services', 'schools', 'contact'];
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
    navigate(`/contact?source=${source}`);
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
          {['Home', 'Features', 'Pricing', 'Services', 'Schools', 'Contact'].map((item) => (
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
              <button onClick={() => scrollTo('contact')} className="px-8 py-4 bg-nepsis-primary text-white rounded-full font-bold hover:shadow-lg hover:scale-105 transition-all">
                Get Started
              </button>
              <button onClick={() => navigate('/login')} className="px-8 py-4 bg-white text-nepsis-primary border-2 border-nepsis-primary rounded-full font-bold hover:bg-gray-50 transition-all">
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
              features={["Core SIS", "Parent Dashboard", "Smart Admissions", "Board 'God View'"]}
            />
            <PricingCard
              title="PLUS"
              features={["Everything in BASIC", "AI Assistant", "Teacher's Hub", "Multilingual Support"]}
              recommended
            />
            <PricingCard
              title="PRO"
              features={["Everything in PLUS", "Risk Early Warning", "QR Safety Gate", "Audit Justification", "Advanced Analytics"]}
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

      {/* Find Your School Section */}
      <Section id="schools" className="bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-nepsis-primary mb-4">Find Your School</h2>
            <p className="text-xl text-gray-600">Already a member? Search for your school to access your portal.</p>
          </motion.div>

          {/* Search Input */}
          <div className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Search by school name..."
                className="w-full px-6 py-4 pr-12 rounded-full border-2 border-gray-200 focus:border-nepsis-primary focus:outline-none text-lg shadow-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <School className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Schools Grid */}
          {schoolsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-nepsis-primary border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-gray-500">Loading schools...</p>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <School className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {schools.length === 0 ? 'No Schools Registered Yet' : 'No Schools Found'}
              </h3>
              <p className="text-gray-500 mb-4">
                {schools.length === 0
                  ? 'Be the first to register your school with Classa Enterprise.'
                  : 'Try a different search term or check the spelling.'}
              </p>
              {schools.length === 0 && (
                <button
                  onClick={() => scrollTo('contact')}
                  className="px-6 py-3 bg-nepsis-alert text-white rounded-full font-bold hover:opacity-90 transition-all"
                >
                  Register Your School
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchools.map((school) => (
                <motion.div
                  key={school.id}
                  whileHover={{ y: -5, scale: 1.02 }}
                  onClick={() => navigate(`/school/${school.slug}/login`)}
                  className="cursor-pointer bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-nepsis-primary/10 flex items-center justify-center flex-shrink-0">
                      <School className="w-6 h-6 text-nepsis-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{school.name}</h3>
                      <p className="text-sm text-gray-500">Code: {school.slug}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Click to login</span>
                    <span className="text-nepsis-primary font-medium text-sm">→</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Alternative: Direct Link */}
          <div className="text-center mt-8">
            <p className="text-gray-500">
              Or go directly to{' '}
              <button onClick={() => navigate('/find-school')} className="text-nepsis-primary font-semibold hover:underline">
                School Discovery Page
              </button>
            </p>
          </div>
        </div>
      </Section>

      {/* Contact Section - Embedded Form */}
      <Section id="contact" className="bg-gradient-to-br from-nepsis-primary to-[#001a1a]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left: Contact Info */}
            <div className="text-white space-y-8">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h2>
                <p className="text-xl text-gray-300">Ready to transform your school? We'd love to hear from you.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-nepsis-alert flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email Us</p>
                    <a href="mailto:sandeshgh07@gmail.com" className="text-lg font-semibold hover:underline">sandeshgh07@gmail.com</a>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-nepsis-alert flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Call Us</p>
                    <a href="tel:+16477452035" className="text-lg font-semibold hover:underline">+1 (647) 745-2035</a>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-semibold mb-3">Why Choose Classa?</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> End-to-end school management</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> AI-powered insights</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> 24/7 priority support</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Custom training included</li>
                </ul>
              </div>
            </div>

            {/* Right: Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-2 text-nepsis-primary">Send Us a Message</h3>
              <p className="text-gray-500 mb-6">Fill out the form below and we'll get back to you shortly.</p>

              <form onSubmit={(e) => { e.preventDefault(); handleContactSubmit(); }} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Your full name"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nepsis-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nepsis-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    placeholder="How can we help?"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nepsis-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name (Optional)</label>
                  <input
                    type="text"
                    value={contactForm.school_name}
                    onChange={(e) => setContactForm({ ...contactForm, school_name: e.target.value })}
                    placeholder="Your institution's name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nepsis-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Tell us about your needs..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nepsis-primary focus:border-transparent resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={contactSubmitting}
                  className="w-full py-4 bg-nepsis-alert text-white rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {contactSubmitting ? 'Sending...' : 'Send Message'}
                </button>
                {contactSuccess && (
                  <p className="text-green-600 text-center font-medium">Thank you! We'll be in touch soon.</p>
                )}
              </form>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* CTA Badge */}
      <motion.div
        className="fixed bottom-28 right-6 z-40 cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => scrollTo('contact')}
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
