import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import api from '../lib/api';

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    school_name: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFindSchool = () => {
    if (searchQuery.trim()) {
      navigate(`/find-school?query=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/find-school');
    }
  };

  const handleContactChange = (e) => {
    setContactForm({ ...contactForm, [e.target.name]: e.target.value });
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message || !contactForm.subject) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      // Assuming api baseURL is set to backend
      // Router path is /public/contact inside communication router. 
      // Need to check how api routing is set up. Usually /communication/public/contact
      await api.post('/communication/public/contact', contactForm);
      toast.success("Message sent! We will get back to you shortly.");
      setContactForm({ name: '', email: '', subject: '', school_name: '', message: '' });
    } catch (error) {
      console.error("Contact form error:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const handleMouseMove = (e) => {
      if (window.innerWidth > 768) {
        const cards = document.querySelectorAll('.float-card');
        const x = (window.innerWidth - e.pageX) / 40;
        const y = (window.innerHeight - e.pageY) / 40;
        cards.forEach(card => { card.style.transform = `translateX(${x}px) translateY(${y}px)`; });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page-wrapper">
      <style>{`
                /* --- CORE VARIABLES --- */
                :root {
                    --lux: #123332;
                    --lux-dark: #0A1F1E;
                    --wine: #5C2438;
                    --wine-bright: #8A3E59;
                    --neon-teal: #00FFC2;
                    --neon-red: #FF2E63;
                    --white: #FFFFFF;
                    /* Using system font / Inter instead of Orbitron as requested */
                    --font-head: inherit; 
                    --font-body: inherit;
                }

                .landing-page-wrapper {
                     background-color: var(--lux);
                    color: var(--white);
                    font-family: var(--font-body);
                    overflow-x: hidden;
                    line-height: 1.6;
                    min-height: 100vh;
                }

                * { box-sizing: border-box; }
                
                /* --- BG FX --- */
                .bg-mesh {
                    position: fixed; width: 100vw; height: 100vh; z-index: 1; top: 0; left: 0; pointer-events: none;
                    background: radial-gradient(circle at 15% 50%, rgba(92, 36, 56, 0.4) 0%, transparent 25%),
                                radial-gradient(circle at 85% 30%, rgba(18, 51, 50, 0.8) 0%, transparent 50%);
                    animation: pulseBg 10s ease-in-out infinite alternate;
                }
                .grid-floor {
                    position: fixed; width: 200%; height: 100vh; bottom: -20%; left: -50%;
                    background-image: linear-gradient(rgba(0, 255, 194, 0.05) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(0, 255, 194, 0.05) 1px, transparent 1px);
                    background-size: 50px 50px;
                    transform: perspective(500px) rotateX(60deg);
                    animation: gridMove 20s linear infinite; z-index: 0; pointer-events: none;
                }
                @keyframes gridMove { 0% { transform: perspective(500px) rotateX(60deg) translateY(0); } 100% { transform: perspective(500px) rotateX(60deg) translateY(50px); } }

                /* --- NAV --- */
                .landing-nav {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 1rem 5%; position: fixed; top: 0; width: 100%; z-index: 1000;
                    backdrop-filter: blur(12px); background: rgba(18, 51, 50, 0.9);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .logo { font-size: 1.5rem; font-weight: 900; letter-spacing: 2px; }
                .logo span { color: var(--wine-bright); }
                .nav-links { display: flex; gap: 1.5rem; }
                .nav-links button { background: none; border: none; font-family: inherit; cursor: pointer; color: #ccc; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; }
                .nav-links button:hover { color: var(--neon-teal); }
                .btn-cta {
                    padding: 0.6rem 1.5rem; border-radius: 50px; background: var(--wine); color: white;
                    font-weight: bold; text-decoration: none; border: 1px solid rgba(255,255,255,0.2); transition: 0.3s; cursor: pointer;
                }
                .btn-cta:hover { background: var(--wine-bright); box-shadow: 0 0 15px var(--wine-bright); }

                /* --- MOBILE NAV --- */
                @media (max-width: 768px) {
                    .nav-links { display: none; }
                    .hero { flex-direction: column; padding-top: 120px; text-align: center; }
                    .hero-text { max-width: 100%; }
                    .hero-visuals { width: 100%; height: 300px; margin-top: 2rem; }
                    .contact-container { grid-template-columns: 1fr; padding: 2rem; }
                    .form-row { grid-template-columns: 1fr; }
                }

                /* --- HERO --- */
                .landing-section { padding: 5rem 5%; position: relative; z-index: 2; }
                .hero { min-height: 100vh; display: flex; align-items: center; justify-content: space-between; }
                .hero-text { max-width: 50%; z-index: 2; }
                
                .hero-text h1 {
                    font-size: 3.5rem; line-height: 1.1; margin-bottom: 1.5rem; font-weight: 800;
                    background: linear-gradient(to right, #fff, #a0a0a0); -webkit-background-clip: text; color: transparent;
                }
                .hero-visuals { width: 45%; height: 50vh; position: relative; perspective: 1000px; }
                .float-card {
                    position: absolute; background: rgba(10, 31, 30, 0.9); border: 1px solid var(--neon-teal);
                    border-radius: 12px; padding: 1rem; color: var(--neon-teal); font-family: monospace;
                    box-shadow: 0 0 20px rgba(0, 255, 194, 0.15); transition: transform 0.1s ease-out;
                }
                .c1 { top: 10%; right: 10%; width: 200px; z-index: 2; }
                .c2 { top: 40%; left: 0%; width: 240px; z-index: 3; border-color: var(--wine-bright); color: var(--wine-bright); }
                .c3 { bottom: 10%; right: 20%; width: 180px; z-index: 1; }
                .bar-chart { display: flex; align-items: flex-end; height: 40px; gap: 4px; margin-top: 10px; }
                .bar { background: currentColor; width: 100%; opacity: 0.6; animation: growBar 2s infinite alternate; }
                @keyframes growBar { 0% { height: 20%; } 100% { height: 100%; } }

                /* --- FEATURES GRID (ANIMATED) --- */
                .section-header { text-align: center; margin-bottom: 3rem; }
                .section-header h2 { font-size: 2.5rem; margin-bottom: 0.5rem; font-weight: 700; color: white; }
                .landing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }

                .landing-card {
                    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 15px; padding: 2rem; transition: 0.4s; position: relative; overflow: hidden;
                    display: flex; flex-direction: column; justify-content: flex-start;
                }
                .landing-card:hover { transform: translateY(-5px); border-color: var(--wine-bright); background: rgba(92, 36, 56, 0.15); }
                .landing-card h3 { margin: 1rem 0; font-size: 1.2rem; color: #fff; font-weight: 700; }
                .landing-card p { font-size: 0.9rem; color: #b0bec5; }
                .anim-box { height: 60px; width: 60px; position: relative; display: flex; align-items: center; justify-content: center; }

                /* ANIMATION CSS (Lock, QR, etc) */
                .lock-svg { width: 50px; height: 50px; stroke: var(--wine-bright); stroke-width: 4; fill: none; }
                .landing-card:hover .shackle { transform: translateY(8px); }
                .shackle { transition: transform 0.4s cubic-bezier(0.5, 0, 0.5, 1.5); }
                
                .qr-box { width: 50px; height: 50px; background: white; padding: 4px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; position: relative; overflow: hidden; border-radius: 4px; }
                .q-dot { background: black; width: 100%; height: 100%; }
                .scan-line { position: absolute; top:0; left:0; width:100%; height:2px; background:red; box-shadow: 0 0 10px red; opacity:0; }
                .landing-card:hover .scan-line { opacity:1; animation: scanDown 1.5s linear infinite; }
                @keyframes scanDown { 0% { top:0; } 50% { top:100%; } 100% { top:0; } }

                .robot-svg { width: 50px; height: 50px; fill: none; stroke: var(--neon-teal); stroke-width: 3; }
                .landing-card:hover .robot-eye { animation: blink 0.5s infinite alternate; fill: var(--neon-teal); }
                .landing-card:hover .robot-ant { animation: ping 1s infinite; }
                @keyframes blink { from { opacity: 0.2; } to { opacity: 1; } }
                @keyframes ping { 0% { stroke-width: 3; } 50% { stroke-width: 6; opacity: 0.5; } 100% { stroke-width: 3; } }

                .bolt-svg { width: 40px; height: 50px; fill: var(--white); filter: drop-shadow(0 0 5px yellow); opacity: 0.8; }
                .landing-card:hover .bolt-svg { animation: strike 0.8s infinite; }
                @keyframes strike { 0% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 15px yellow); } 100% { transform: scale(1); opacity: 0.8; } }

                .fin-svg { width: 60px; height: 40px; fill: none; stroke: #ffcc00; stroke-width: 3; overflow: visible; }
                .card-rect { fill: rgba(255, 204, 0, 0.1); }
                .landing-card:hover .fin-svg { animation: swipe 1.5s ease-in-out infinite; }
                @keyframes swipe { 0% { transform: translateX(0); } 50% { transform: translateX(10px) rotateY(15deg); } 100% { transform: translateX(0); } }

                .ppl-svg { width: 60px; height: 50px; fill: none; stroke: var(--neon-teal); stroke-width: 3; }
                .head { fill: var(--neon-teal); opacity: 0.5; }
                .landing-card:hover .p-left { animation: bob 1s infinite alternate; }
                .landing-card:hover .p-right { animation: bob 1s infinite alternate-reverse; }
                @keyframes bob { from { transform: translateY(0); } to { transform: translateY(-5px); } }

                .doc-svg { width: 45px; height: 55px; fill: none; stroke: white; stroke-width: 3; }
                .check-mark { stroke: var(--neon-teal); stroke-dasharray: 20; stroke-dashoffset: 20; opacity: 0; }
                .landing-card:hover .check-mark { animation: drawCheck 0.5s forwards; opacity: 1; }
                .landing-card:hover .check-2 { animation-delay: 0.2s; }
                .landing-card:hover .check-3 { animation-delay: 0.4s; }
                @keyframes drawCheck { to { stroke-dashoffset: 0; } }

                .chart-svg { width: 50px; height: 50px; display: flex; align-items: flex-end; gap: 5px; }
                .c-bar { width: 10px; background: var(--wine-bright); transition: height 0.3s; }
                .landing-card:hover .cb1 { animation: chartGrow 0.6s infinite alternate; }
                .landing-card:hover .cb2 { animation: chartGrow 0.8s infinite alternate-reverse; }
                .landing-card:hover .cb3 { animation: chartGrow 0.5s infinite alternate; }
                @keyframes chartGrow { from { height: 20%; } to { height: 90%; } }

                /* --- SCHOOLS PORTAL SECTION (RESTORED) --- */
                #schools {
                    background: linear-gradient(180deg, var(--lux) 0%, #050f0f 100%);
                    border-top: 1px solid var(--wine-bright);
                    border-bottom: 1px solid var(--wine-bright);
                    min-height: 60vh;
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    text-align: center;
                }
                .portal-box {
                    background: rgba(18, 51, 50, 0.8);
                    padding: 3rem; border-radius: 20px;
                    border: 1px solid var(--neon-teal);
                    box-shadow: 0 0 30px rgba(0, 255, 194, 0.1);
                    max-width: 600px; width: 100%;
                }
                .portal-input {
                    width: 100%; padding: 1rem; margin: 1.5rem 0;
                    background: rgba(0,0,0,0.5); border: 1px solid #555;
                    color: white; border-radius: 5px; font-family: inherit;
                }
                .portal-input:focus { border-color: var(--neon-teal); outline: none; }

                /* --- PRICING --- */
                .pricing-card {
                    background: rgba(18, 51, 50, 0.6); border: 1px solid rgba(255,255,255,0.1);
                    padding: 2rem; border-radius: 20px; text-align: center; position: relative;
                }
                .pricing-card.popular { border: 2px solid var(--wine-bright); box-shadow: 0 0 30px rgba(92, 36, 56, 0.3); transform: scale(1.05); z-index: 2; }
                .price-list { list-style: none; margin: 2rem 0; text-align: left; padding-left: 10px; }
                .price-list li { margin-bottom: 0.8rem; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px; }
                .btn-price { display: block; width: 100%; padding: 1rem; background: transparent; border: 1px solid white; color: white; margin-top: 1rem; cursor: pointer; transition: 0.3s; }
                .pricing-card.popular .btn-price { background: var(--wine); border: none; }
                .btn-price:hover { background: var(--white); color: var(--lux); }
                .price-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: white; }

                /* --- SERVICES (RESTORED POINTS) --- */
                .service-list {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;
                    margin-top: 2rem;
                }
                .service-point {
                    background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px;
                    display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.05);
                }
                .service-point span { color: var(--neon-teal); font-weight: bold; }

                /* --- CONTACT --- */
                .contact-container {
                    display: grid; grid-template-columns: 1fr 1.5fr; gap: 4rem;
                    background: #061615; padding: 4rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);
                }
                .contact-info-box { background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 10px; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; }
                .c-icon { width: 40px; height: 40px; background: var(--wine); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
                .why-list { margin-top: 2rem; background: rgba(18, 51, 50, 0.5); padding: 2rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
                .why-item { margin-bottom: 0.8rem; display: flex; gap: 10px; font-size: 0.9rem; }
                .why-item span { color: var(--neon-teal); }
                .contact-form { background: white; color: #123332; padding: 2.5rem; border-radius: 15px; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
                .landing-label { display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 5px; }
                .landing-input, .landing-textarea { width: 100%; padding: 0.8rem; border: 1px solid #ddd; border-radius: 5px; font-family: inherit; }
                .btn-submit { width: 100%; padding: 1rem; background: var(--wine); color: white; border: none; border-radius: 5px; font-weight: bold; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
                .btn-submit:hover { background: var(--wine-bright); }

                .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s ease; }
                .reveal.active { opacity: 1; transform: translateY(0); }
            `}</style>

      <div className="bg-mesh"></div>
      <div className="grid-floor"></div>

      <nav className="landing-nav">
        <div className="logo">SISSPHERE<span>.</span></div>
        <div className="nav-links">
          <button onClick={() => scrollTo('home')}>Home</button>
          <button onClick={() => scrollTo('features')}>Features</button>
          <button onClick={() => scrollTo('schools')}>Schools</button>
          <button onClick={() => scrollTo('pricing')}>Pricing</button>
          <button onClick={() => scrollTo('services')}>Services</button>
        </div>
        <button onClick={() => scrollTo('contact')} className="btn-cta">Request Free Demo</button>
      </nav>

      <section className="landing-section hero" id="home">
        <div className="hero-text reveal">
          <h1>Ironclad.<br />Intelligent.<br />SISsphere.</h1>
          <p style={{ color: '#b0bec5', marginBottom: '2rem', fontSize: '1.1rem' }}>
            The student information system that thinks.
            Bank-grade encryption, AI-driven insights, and strict tenant isolation.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => scrollTo('features')} className="btn-cta">Explore Features</button>
            <button onClick={() => navigate('/login')} style={{ padding: '0.6rem 1.5rem', border: '1px solid white', color: 'white', textDecoration: 'none', borderRadius: '50px', background: 'transparent', cursor: 'pointer' }}>Portal Login</button>
          </div>
        </div>
        <div className="hero-visuals">
          <div className="float-card c1">
            <div style={{ fontSize: '0.8rem', borderBottom: '1px solid #333', marginBottom: '5px' }}>AI PREDICTION</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>At Risk: 2%</div>
            <div className="bar-chart"><div className="bar" style={{ height: '40%' }}></div><div className="bar" style={{ height: '80%' }}></div><div className="bar" style={{ height: '30%' }}></div></div>
          </div>
          <div className="float-card c2">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AUDIT LOG</span><span style={{ width: '8px', height: '8px', background: 'red', borderRadius: '50%', boxShadow: '0 0 5px red' }}></span>
            </div>
            <div style={{ fontSize: '0.7rem', marginTop: '10px', opacity: 0.8 }}>&gt; User: Admin_01<br />&gt; Action: Fee_Update<br />&gt; Encryption: AES-256</div>
          </div>
          <div className="float-card c3">
            <div style={{ textAlign: 'center' }}>ATTENDANCE</div><div style={{ fontSize: '2rem', textAlign: 'center' }}>98.4%</div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="section-header reveal">
          <h2>System Architecture</h2>
          <p>Built for speed, security, and scale.</p>
        </div>
        <div className="landing-grid">
          <div className="landing-card reveal">
            <div className="anim-box"><svg className="lock-svg" viewBox="0 0 50 50"><path className="shackle" d="M15 20 V10 A10 10 0 0 1 35 10 V20" /><rect x="10" y="20" width="30" height="25" rx="3" fill="#5C2438" stroke="none" /></svg></div>
            <h3>Ironclad Security</h3><p>Bank-grade encryption, tenant isolation, and strict RBAC. Data bursts reunite and lock instantly.</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><div className="qr-box"><div className="q-dot"></div><div className="q-dot" style={{ opacity: 0 }}></div><div className="q-dot"></div><div className="q-dot"></div><div className="q-dot"></div><div className="q-dot"></div><div className="q-dot" style={{ opacity: 0 }}></div><div className="q-dot"></div><div className="scan-line"></div></div></div>
            <h3>QR Safety Gate</h3><p>Parents use dynamic QR codes for gate passes. Instant logs of who picked up whom and when.</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><svg className="robot-svg" viewBox="0 0 50 50"><rect x="10" y="15" width="30" height="25" rx="5" /><circle className="robot-eye" cx="18" cy="25" r="3" /><circle className="robot-eye" cx="32" cy="25" r="3" /><line className="robot-ant" x1="25" y1="15" x2="25" y2="5" /><circle cx="25" cy="5" r="2" fill="var(--neon-teal)" /></svg></div>
            <h3>AI Driven Data</h3><p>Predictive analytics identify at-risk students. Actionable insights for school boards.</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><svg className="bolt-svg" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg></div>
            <h3>Lightning Fast</h3><p>Optimized for speed even on slow connections. Works perfectly on any device, anywhere (Mobile First).</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><svg className="fin-svg" viewBox="0 0 60 40"><rect className="card-rect" x="2" y="5" width="56" height="30" rx="4" /><line x1="2" y1="12" x2="58" y2="12" /><rect x="8" y="20" width="10" height="6" fill="#ffcc00" /></svg></div>
            <h3>Automated Finance</h3><p>Seamless fee collection, automated invoicing, and instant reconciliation with global gateways.</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><svg className="ppl-svg" viewBox="0 0 60 50"><circle className="head p-left" cx="20" cy="15" r="6" /><path className="p-left" d="M10 40 Q20 20 30 40" /><circle className="head p-right" cx="40" cy="15" r="6" /><path className="p-right" d="M30 40 Q40 20 50 40" /></svg></div>
            <h3>Parent Engagement</h3><p>Real-time updates to keep parents in the loop via dedicated mobile portals.</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><svg className="doc-svg" viewBox="0 0 50 60"><path d="M10 5 H40 V55 H10 Z" /><path className="check-mark check-1" d="M15 15 L20 20 L35 10" /><path className="check-mark check-2" d="M15 30 L20 35 L35 25" /><path className="check-mark check-3" d="M15 45 L20 50 L35 40" /></svg></div>
            <h3>Smart Admissions</h3><p>Paperless enrollment. Digital forms with automated document verification.</p>
          </div>
          <div className="landing-card reveal">
            <div className="anim-box"><div className="chart-svg"><div className="c-bar cb1" style={{ height: '30%' }}></div><div className="c-bar cb2" style={{ height: '60%' }}></div><div className="c-bar cb3" style={{ height: '45%' }}></div><div className="c-bar cb1" style={{ height: '80%' }}></div></div></div>
            <h3>Data Analytics</h3><p>Visual reports for multi-branch institutions. View growth, revenue, and retention at a glance.</p>
          </div>
        </div>
      </section>

      <section className="landing-section" id="schools">
        <div className="portal-box">
          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 700, color: 'white' }}>Find Your Institution</h2>
          <p style={{ color: '#b0bec5', marginBottom: '2rem' }}>
            Securely redirect to your school's isolated tenant.
          </p>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="portal-input"
              placeholder="Enter School ID or Name (e.g. SCH-092)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFindSchool()}
            />
            <div
              style={{ position: 'absolute', right: '15px', top: '38px', color: 'var(--neon-teal)', cursor: 'pointer' }}
              onClick={handleFindSchool}
            >
              🔍
            </div>
          </div>
          <button
            className="btn-cta"
            style={{ width: '100%', fontSize: '1.1rem', marginTop: '1rem' }}
            onClick={handleFindSchool}
          >
            ACCESS SECURE PORTAL
          </button>
          <p style={{ fontSize: '0.8rem', marginTop: '1rem', opacity: '0.6' }}>* All access is logged and audited.</p>
        </div>
      </section>

      <section className="landing-section" id="pricing">
        <div className="section-header reveal">
          <h2>Transparent Pricing</h2>
          <p>Choose the power you need.</p>
        </div>
        <div className="landing-grid">
          <div className="pricing-card reveal">
            <div className="price-title">BASIC</div>
            <ul className="price-list"><li>Core SIS</li><li>Parent Dashboard</li><li>Smart Admissions</li><li>Board 'God View'</li></ul>
            <button className="btn-price">Choose BASIC</button>
          </div>
          <div className="pricing-card popular reveal">
            <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', background: 'var(--wine)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>POPULAR</div>
            <div className="price-title">PLUS</div>
            <ul className="price-list"><li>Everything in BASIC</li><li>AI Assistant</li><li>Teacher's Hub</li><li>Multilingual Support</li></ul>
            <button className="btn-price">Choose PLUS</button>
          </div>
          <div className="pricing-card reveal">
            <div className="price-title">PRO</div>
            <ul className="price-list"><li>Everything in PLUS</li><li>Risk Early Warning</li><li>QR Safety Gate</li><li>Audit Justification</li><li>Advanced Analytics</li></ul>
            <button className="btn-price">Choose PRO</button>
          </div>
        </div>
      </section>

      <section className="landing-section" id="services">
        <div className="contact-container reveal" style={{ background: 'rgba(255,255,255,0.02)', border: 'none' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700, color: 'white' }}>More Than Software</h2>
            <p style={{ marginBottom: '2rem', color: '#b0bec5' }}>
              We provide end-to-end services to ensure your school succeeds. From data migration to staff training, we are with you every step of the way.
            </p>
            <div style={{ width: '200px', height: '200px', background: 'radial-gradient(circle, var(--wine-bright) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'pulseBg 3s infinite' }}></div>
          </div>
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--neon-teal)' }}>Service Suite</h3>
            <div className="service-list">
              <div className="service-point"><span>✓</span> On-site Training</div>
              <div className="service-point"><span>✓</span> 24/7 Priority Support</div>
              <div className="service-point"><span>✓</span> Hardware Integration (Biometric/QR)</div>
              <div className="service-point"><span>✓</span> Custom Report Generation</div>
              <div className="service-point"><span>✓</span> Excel Data Migration Support</div>
              <div className="service-point"><span>✓</span> Continuous Support & Feature Adds</div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="contact">
        <div className="contact-container reveal">
          <div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700, color: 'white' }}>Get in Touch</h2>
            <p style={{ marginBottom: '2rem', color: '#ccc' }}>Ready to transform your school?</p>
            <div className="contact-info-box"><div className="c-icon">📧</div><div><div style={{ fontSize: '0.8rem', opacity: '0.7' }}>Email Us</div><strong>sandeshgh07@gmail.com</strong></div></div>
            <div className="contact-info-box"><div className="c-icon">📱</div><div><div style={{ fontSize: '0.8rem', opacity: '0.7' }}>Call Us</div><strong>+1 (647) 745-2035</strong></div></div>
            <div className="why-list">
              <h4 style={{ marginBottom: '1rem' }}>Why Choose SISsphere?</h4>
              <div className="why-item"><span>✓</span> End-to-end school management</div>
              <div className="why-item"><span>✓</span> AI-powered insights</div>
              <div className="why-item"><span>✓</span> 24/7 priority support</div>
              <div className="why-item"><span>✓</span> Custom training included</div>
            </div>
          </div>
          <div className="contact-form">
            <h3 style={{ color: '#123332', marginBottom: '0.5rem' }}>Send Us a Message</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Fill out the form below and we'll get back to you shortly.</p>

            <form onSubmit={handleContactSubmit}>
              <div className="form-row">
                <div>
                  <label className="landing-label">Name *</label>
                  <input
                    name="name"
                    value={contactForm.name}
                    onChange={handleContactChange}
                    type="text"
                    className="landing-input"
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div>
                  <label className="landing-label">Email *</label>
                  <input
                    name="email"
                    value={contactForm.email}
                    onChange={handleContactChange}
                    type="email"
                    className="landing-input"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="landing-label">Subject *</label>
                <input
                  name="subject"
                  value={contactForm.subject}
                  onChange={handleContactChange}
                  type="text"
                  className="landing-input"
                  placeholder="How can we help?"
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="landing-label">School Name (Optional)</label>
                <input
                  name="school_name"
                  value={contactForm.school_name}
                  onChange={handleContactChange}
                  type="text"
                  className="landing-input"
                  placeholder="Your institution's name"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="landing-label">Message *</label>
                <textarea
                  name="message"
                  value={contactForm.message}
                  onChange={handleContactChange}
                  className="landing-textarea"
                  rows="4"
                  placeholder="Tell us about your needs..."
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '2rem', fontSize: '0.8rem', opacity: '0.6' }}>&copy; 2026 SISsphere Systems Inc.</footer>
    </div>
  );
};

export default LandingPage;
