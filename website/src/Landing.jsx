import { Play, Users, Lock, Radio, Activity, Headset, Zap, ShieldCheck } from 'lucide-react';

export default function Landing() {
  return (
    <>
      <div className="hero-wrapper">
        <div className="page-container hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="live-dot"></span> V1.0 IS NOW LIVE
            </div>
            <h1 className="hero-title">
              Sync Your Vibe.<br/>
              <span className="gradient-text">Listen Together.</span>
            </h1>
            <p className="hero-subtitle">
              The ultimate real-time music sharing platform. Create encrypted rooms, stream pristine high-fidelity audio, and experience music in perfect synchronization with your friends anywhere in the world.
            </p>
            <div className="hero-actions">
              <a href="#" className="btn-primary btn-large">
                <Play fill="currentColor" size={20} />
                Download for Android
              </a>
              <a href="#features" className="btn-secondary">
                Learn More
              </a>
            </div>
            
            <div className="stats-row">
              <div className="stat">
                <h3>0ms</h3>
                <p>Latency</p>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <h3>256k</h3>
                <p>High Fidelity</p>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <h3>E2EE</h3>
                <p>Encrypted</p>
              </div>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="mockup-container">
              <img src="/app_mockup.png" alt="Syncognito App Mockup" className="app-mockup floating-animation" />
              <div className="glass-card stat-card float-delayed">
                <Activity size={20} className="accent-icon" />
                <div>
                  <h4>Perfect Sync</h4>
                  <p>Audio engine synchronized</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="social-proof">
        <p>REDEFINING REAL-TIME AUDIO EXPERIENCES</p>
        <div className="brand-strip">
          <span className="brand-logo">Dolby Atmos</span>
          <span className="brand-logo">Spotify Core</span>
          <span className="brand-logo">High-Res Audio</span>
          <span className="brand-logo">AES-256</span>
        </div>
      </div>

      <section id="features" className="features-section page-container">
        <div className="section-header">
          <h2>Engineered for Social Audio</h2>
          <p>We built Syncognito strictly to conquer the pain points of remote social listening and anonymous communication. Every module is highly tuned.</p>
        </div>

        <div className="features-grid">
          <div className="premium-feature-card">
            <div className="pf-icon"><Radio size={32} /></div>
            <h3>Atomic Synchronization</h3>
            <p>Our custom backend engine ensures that when the Host presses play, pause, or skips, the action executes simultaneously across all connected device sockets globally. No stutters, no delay.</p>
          </div>
          <div className="premium-feature-card">
            <div className="pf-icon"><Activity size={32} /></div>
            <h3>NGL Anonymous Prompts</h3>
            <p>Generate secure, time-aware messaging links. Let your network drop anonymous questions or vibe requests into your inbox, powered by an underlying AI validation engine.</p>
          </div>
          <div className="premium-feature-card">
            <div className="pf-icon"><Users size={32} /></div>
            <h3>Live Room Social</h3>
            <p>Join or host rooms with a single tap. See exactly what your friends are listening to in real-time and join their vibe instantly with perfect audio alignment.</p>
          </div>
          <div className="premium-feature-card">
            <div className="pf-icon"><Play size={32} /></div>
            <h3>Universal Syncognito</h3>
            <p>Our proprietary sync-bridge technology ensures that every listener in the room hears the exact same beat at the exact same millisecond, across any network.</p>
          </div>
          <div className="premium-feature-card">
            <div className="pf-icon"><Zap size={32} /></div>
            <h3>Group Wake-Up Alarms</h3>
            <p>Why wake up out of sync? Set a synchronized social alarm with your friends. Our network triggers the agreed-upon high-energy track to blast on every phone simultaneously.</p>
          </div>
          <div className="premium-feature-card">
            <div className="pf-icon"><ShieldCheck size={32} /></div>
            <h3>Pure AMOLED Architecture</h3>
            <p>The mobile app abandons generic greys for a premium #000000 true black aesthetic. Complete with interactive glassmorphism and AES-compliant JWT token security protecting your account.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-box">
          <div className="glow-blob glow-center"></div>
          <h2>Ready to change how you listen?</h2>
          <p>Join the future of social audio today. Free forever.</p>
          <a href="#" className="btn-primary btn-large cta-btn">
            Get Syncognito Now
          </a>
        </div>
      </section>
    </>
  );
}
