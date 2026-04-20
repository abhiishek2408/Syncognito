import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import Landing from './Landing';
import Privacy from './Privacy';
import Terms from './Terms';
import Features from './Features';
import AudioEngine from './AudioEngine';
import Pricing from './Pricing';
import Documentation from './Documentation';
import ApiReference from './ApiReference';
import OpenSource from './OpenSource';
import Security from './Security';
import Cookies from './Cookies';
import HelpCenter from './HelpCenter';
import AnonMessage from './AnonMessage';

export default function App() {
  return (
    <Router>
      <div className="glow-blob glow-top-left"></div>
      <div className="glow-blob glow-bottom-right"></div>
      
      <nav className="navbar">
        <Link to="/" className="logo-area">
          <div className="logo-icon">
            <Activity size={24} />
          </div>
          Syncognito
        </Link>
        <div className="nav-links">
          <Link to="/features" className="nav-link">Features</Link>
          <Link to="/audio-engine" className="nav-link">Engine</Link>
          <Link to="/pricing" className="nav-link">Pricing</Link>
          <a href="#" className="btn-primary" style={{ padding: '8px 24px', fontSize: '14px' }}>Get App</a>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/audio-engine" element={<AudioEngine />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/documentation" element={<Documentation />} />
        <Route path="/api-reference" element={<ApiReference />} />
        <Route path="/open-source" element={<OpenSource />} />
        <Route path="/security" element={<Security />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/anon/:identifier" element={<AnonMessage />} />
      </Routes>

      <footer className="footer-mega">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-col brand-col">
              <Link to="/" className="footer-logo">
                <div className="logo-icon-small">
                  <Activity size={20} />
                </div>
                Syncognito
              </Link>
              <p className="footer-tagline">
                The most advanced real-time social audio platform. Listen together in pristine fidelity, anywhere on earth.
              </p>
              <div className="social-links">
                <a href="#" className="social-icon">𝕏</a>
                <a href="#" className="social-icon">in</a>
                <a href="#" className="social-icon">IG</a>
                <a href="#" className="social-icon">GH</a>
              </div>
            </div>

            <div className="footer-col">
              <h4>Product</h4>
              <Link to="/">Download App</Link>
              <Link to="/features">Features</Link>
              <Link to="/audio-engine">Audio Engine</Link>
              <Link to="/pricing">Pricing</Link>
            </div>

            <div className="footer-col">
              <h4>Developers</h4>
              <Link to="/documentation">Documentation</Link>
              <Link to="/api-reference">API Reference</Link>
              <Link to="/open-source">Open Source</Link>
              <Link to="/security">Security Status</Link>
            </div>

            <div className="footer-col">
              <h4>Legal & Support</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/cookies">Cookies Policy</Link>
              <Link to="/help">Help Center</Link>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-text">© 2026 Syncognito Inc. All rights reserved. Made with ♥ for audiophiles.</p>
            <div className="footer-bottom-links">
              <span>Status: <span className="status-green">All Systems Operational</span></span>
              <span className="dot">•</span>
              <span>English (US)</span>
            </div>
          </div>
        </div>
      </footer>
    </Router>
  );
}
