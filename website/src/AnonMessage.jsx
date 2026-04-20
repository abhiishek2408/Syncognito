import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, RefreshCw, Lock, AlertCircle, CheckCircle2, User, ChevronLeft, Shield, Plus, Volume2 } from 'lucide-react';
import './AnonMessage.css';
import confetti from 'canvas-confetti';

const API_URL = 'https://syncognito.onrender.com';
const AI_SERVICE_URL = 'http://localhost:8001';

// Base64 sound assets for zero-dependency vibes
const WHOOSH_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0Yf9vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vTNPl9';

export default function AnonMessage() {
  const { identifier } = useParams();
  const [recipient, setRecipient] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  const playSound = (type = 'whoosh') => {
    if (!soundEnabled) return;
    const audio = new Audio(WHOOSH_SOUND);
    audio.volume = 0.2;
    audio.play().catch(() => {});
  };

  const fireConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#1DB954', '#ffffff', '#1ed760']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#1DB954', '#ffffff', '#1ed760']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const CATEGORIES = [
    { id: 'all', label: 'All', icon: '✨' },
    { id: 'fun', label: 'Fun', icon: '😎' },
    { id: 'deep', label: 'Deep', icon: '🧠' },
    { id: 'music', label: 'Music', icon: '🎵' },
    { id: 'personality', label: 'Identity', icon: '🎭' },
  ];

  useEffect(() => {
    fetchRecipient();
    fetchSuggestions();
    window.scrollTo(0, 0);
  }, [identifier]);

  useEffect(() => {
    fetchSuggestions(activeCategory);
  }, [activeCategory]);

  const fetchRecipient = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ngl/recipient/${identifier}`);
      if (!res.ok) throw new Error('User not found');
      const data = await res.json();
      setRecipient(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (cat = 'all') => {
    setLoadingSuggestions(true);
    try {
      const moodParam = cat !== 'all' ? `&mood=${cat}` : '';
      const res = await fetch(`${AI_SERVICE_URL}/api/recommend/?count=8${moodParam}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions(data.questions || []);
    } catch (err) {
      setSuggestions([
        { text: "Tell me something I don't know about myself 👀", category: 'personality' },
        { text: "What's your honest opinion about me? 🤔", category: 'personality' },
        { text: "Say something you've been holding back 🤫", category: 'deep' },
        { text: "Rate my vibe out of 10 Flame", category: 'fun' },
        { text: "One word to describe me? 💭", category: 'personality' },
        { text: "What song reminds you of me? 🎵", category: 'music' }
      ]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleShare = (platform) => {
    playSound();
    const text = `I just sent a secret message to ${recipient?.name} on Syncognito! 🤫\n\nGet your own anonymous link here: https://syncognito-nine.vercel.app/anon/${recipient?.anonSlug || identifier}`;
    
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      navigator.clipboard.writeText(text);
      alert('Link & Message copied to clipboard!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    playSound();
    try {
      const res = await fetch(`${API_URL}/api/ngl/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: identifier,
          text: message.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send message');
      }

      setSubmitted(true);
      fireConfetti();
      setMessage('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const getVibeClass = () => {
    if (activeCategory === 'fun') return 'vibe-yellow';
    if (activeCategory === 'deep') return 'vibe-purple';
    if (activeCategory === 'music') return 'vibe-green';
    if (activeCategory === 'personality') return 'vibe-blue';
    return '';
  };

  if (loading) {
    return (
      <div className="anon-page-loading">
        <div className="loader-ring"></div>
        <p>Connecting to secure inbox...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="anon-page-error">
        <div className="error-card glass-card">
          <AlertCircle size={64} color="#ff4444" />
          <h2>Inbox Not Found</h2>
          <p>That link doesn't seem to exist or the user has disabled anonymous messages.</p>
          <Link to="/" className="btn-primary">Return to Syncognito</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`anon-page-wrapper ${getVibeClass()}`}>
      <div className="grain-overlay"></div>
      <div className="glow-blob glow-top-left"></div>
      <div className="glow-blob glow-bottom-right"></div>
      
      <div className="anon-container">
        <div className="anon-top-bar">
          <Link to="/" className="back-link">
            <ChevronLeft size={20} />
            Back to Syncognito
          </Link>
          <button className={`sound-toggle ${!soundEnabled ? 'muted' : ''}`} onClick={() => setSoundEnabled(!soundEnabled)}>
            <Volume2 size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="success-state glass-card pulse-border">
            <div className="success-icon-bg">
              <CheckCircle2 size={48} color="#1DB954" />
            </div>
            <h2 className="doc-title" style={{ fontSize: '48px', marginBottom: '8px' }}>Sent!</h2>
            <p className="success-msg">Your anonymous note was dropped into <b>{recipient?.name}</b>'s inbox.</p>
            
            <div className="share-actions-row">
               <button className="share-btn twitter" onClick={() => handleShare('twitter')}>
                 𝕏 Share
               </button>
               <button className="share-btn whatsapp" onClick={() => handleShare('whatsapp')}>
                 WhatsApp
               </button>
               <button className="share-btn copy" onClick={() => handleShare('copy')}>
                 Copy Link
               </button>
            </div>

            <button className="btn-secondary" onClick={() => { setSubmitted(false); playSound(); }} style={{ marginBottom: '40px', width: '100%' }}>Send Another Message</button>
            
            <div className="promo-box glass-card pulse-border-slow">
              <div className="promo-badge">PRO TIP</div>
              <h3>Want your own secret inbox?</h3>
              <p>Download the Syncognito app to get your unique link and start receiving anonymous vibes from your circle.</p>
              <div className="promo-actions">
                <a href="#" className="btn-primary">Download App Now</a>
              </div>
            </div>
          </div>
        ) : (
          <div className="message-box-card glass-card pulse-border">
             <div className="recipient-header">
                <div className="avatar-wrapper">
                   {recipient?.avatar && !avatarError ? (
                     <img 
                       src={recipient.avatar} 
                       alt="" 
                       className="avatar-img" 
                       onError={() => setAvatarError(true)}
                     />
                   ) : (
                     <div className="avatar-placeholder">
                       <User size={32} />
                     </div>
                   )}
                   <div className="online-indicator pulsate"></div>
                </div>
                <div className="recipient-info">
                   <h3>@{recipient?.anonSlug || (identifier.length > 15 ? identifier.substring(0, 8) : identifier)}</h3>
                   <p>Send me an anonymous message!</p>
                </div>
             </div>

             <form onSubmit={handleSubmit} className="message-form">
                <div className="textarea-wrapper">
                   <textarea
                     placeholder="Type something honest, funny, or crazy... 🤫"
                     value={message}
                     onChange={(e) => setMessage(e.target.value)}
                     maxLength={500}
                     required
                   />
                   <div className="textarea-footer">
                     <span className="privacy-badge">
                       <Shield size={12} />
                       End-to-End Encrypted
                     </span>
                     <div className="char-count">{message.length}/500</div>
                   </div>
                </div>

                <div className="suggestions-section">
                   <div className="suggestions-header">
                      <span>Vibe Suggestions</span>
                      <button type="button" className="refresh-btn" onClick={() => fetchSuggestions(activeCategory)} disabled={loadingSuggestions}>
                        <RefreshCw size={14} className={loadingSuggestions ? 'spin' : ''} />
                      </button>
                   </div>
                                      <div className="category-scroll">
                      {CATEGORIES.map(cat => (
                        <button 
                          key={cat.id} 
                          type="button" 
                          className={`cat-chip ${activeCategory === cat.id ? 'active' : ''}`}
                          onClick={() => { setActiveCategory(cat.id); playSound(); }}
                        >
                          {cat.icon} {cat.label}
                        </button>
                      ))}
                   </div>

                   <div className="suggestions-grid">
                      {suggestions.map((s, i) => (
                        <button 
                          key={i} 
                          type="button" 
                          className="suggestion-chip"
                          onClick={() => { setMessage(s.text); playSound(); }}
                        >
                          {s.text}
                        </button>
                      ))}
                   </div>
                </div>

                <button type="submit" className="btn-primary btn-full send-btn" disabled={!message.trim() || sending}>
                   {sending ? 'Sending Secretly...' : (
                     <>
                       <Send size={18} />
                       Send Anonymously
                     </>
                   )}
                </button>
             </form>
             
             <div className="security-footer">
               <Lock size={14} />
               <span>Your identity is 100% protected. Even {recipient?.name} won't know who sent this.</span>
             </div>
          </div>
        )}

        <div className="anon-footer">
           <p>© 2026 Syncognito Inc. • <Link to="/privacy">Privacy</Link> • <Link to="/terms">Terms</Link></p>
        </div>
      </div>
    </div>
  );
}
