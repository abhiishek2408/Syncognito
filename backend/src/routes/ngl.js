import express from 'express';
import axios from 'axios';
import { body, param, validationResult } from 'express-validator';
import NglMessage from '../models/NglMessage.js';
import User from '../models/User.js';
import NglLinkView from '../models/NglLinkView.js';
import dotenv from 'dotenv';
import geoip from 'geoip-lite';
import { authenticateToken } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();
 
// Get global stats (Total messages, etc.)
router.get('/stats/global', async (req, res) => {
  try {
    const totalMessages = await NglMessage.countDocuments({ isSpam: false });
    const totalLinks = await User.countDocuments({ anonSlug: { $exists: true, $ne: '' } });
    const totalViews = await NglLinkView.countDocuments();
    
    res.json({
      totalMessages,
      totalLinks,
      totalViews
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get recipient info by slug or ID (public)
router.get('/recipient/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    let user = null;
    // Try finding by ID first if it looks like a Mongo ID
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(identifier).select('name anonSlug avatar');
    }
    // Then try by slug
    if (!user) {
      user = await User.findOne({ anonSlug: identifier.toLowerCase() }).select('name anonSlug avatar');
    }
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Premium Analytics: Track view
    try {
      const viewerIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const referrer = req.headers['referer'] || req.headers['referrer'];

      await NglLinkView.create({
        recipientId: user._id,
        viewerIp,
        userAgent,
        referrer
      });
    } catch (vErr) {
      console.warn('[NGL] View tracking error:', vErr.message);
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware to check validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Update my secret slug
router.patch('/slug', 
  authenticateToken,
  [
    body('slug')
      .trim()
      .notEmpty().withMessage('Slug is required')
      .isString().withMessage('Slug must be text')
      .matches(/^[a-zA-Z0-9_\-]+$/).withMessage('Invalid slug. Only letters, numbers, - and _ allowed.')
      .isLength({ min: 3, max: 30 }).withMessage('Slug must be between 3 and 30 characters')
  ],
  validateRequest,
  async (req, res) => {
  const { slug } = req.body;
  console.log('[NGL] Slug update request:', { userId: req.user.id, slug });
  try {
    const existing = await User.findOne({ anonSlug: slug.toLowerCase() });
    if (existing && existing._id.toString() !== req.user.id) {
      return res.status(400).json({ message: 'This slug is already taken' });
    }
    await User.findByIdAndUpdate(req.user.id, { anonSlug: slug.toLowerCase() });
    res.json({ message: 'Slug updated!', slug: slug.toLowerCase() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send anonymous message (with spam filter + device hint)
router.post('/send', 
  [
    body('text')
      .trim()
      .notEmpty().withMessage('Message text is missing')
      .isString().withMessage('Message must be text')
      .isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters')
  ],
  validateRequest,
  async (req, res) => {
  const { recipientId, slug, text } = req.body;

  // Enhanced Spam Filter & Mood Analysis
  const SPAM_PATTERNS = [
    /(.)\1{8,}/i, // same char repeated 8+ times
    /https?:\/\//i, // links
    /bit\.ly|tinyurl/i, // shortened links
    /\b(fuck|bitch|shit|asshole|pussy|porn|sex|buy now|offer)\b/i, // offensive/spam keywords
  ];
  const isSpam = SPAM_PATTERNS.some(p => p.test(text));

  // Simple AI Mood Analysis (Heuristic)
  let mood = 'Neutral';
  const MOOD_RULES = [
    { mood: 'Happy', pattern: /\b(love|happy|great|nice|cool|best|🔥|❤️|😊|🙌)\b/i },
    { mood: 'Angry', pattern: /\b(hate|bad|worst|stupid|idiot|wtf|😡|🤬|👎)\b/i },
    { mood: 'Romantic', pattern: /\b(crush|date|kiss|cute|miss you|babe|😘|💍|🌹)\b/i },
    { mood: 'Sarcastic', pattern: /\b(yeah right|whatever|lol|rofl|😂|🙄|🤡)\b/i },
    { mood: 'Curious', pattern: /\?|how|why|who|when/i },
  ];
  for (const rule of MOOD_RULES) {
    if (rule.pattern.test(text)) {
      mood = rule.mood;
      break;
    }
  }

  try {
    let targetId = recipientId;
    if (slug) {
      if (slug.match(/^[0-9a-fA-F]{24}$/)) {
        targetId = slug;
      } else {
        const user = await User.findOne({ anonSlug: slug.toLowerCase() });
        if (!user) return res.status(404).json({ message: 'User not found' });
        targetId = user._id;
      }
    }
    if (!targetId) return res.status(400).json({ message: 'Recipient not found' });

    // Detect device from User-Agent
    const ua = req.headers['user-agent'] || '';
    let deviceHint = 'Unknown';
    let deviceFull = 'Unknown Device';
    if (ua.includes('Android')) {
      deviceHint = 'Android';
      const match = ua.match(/Android\s([^\s;]+)/);
      deviceFull = match ? `Android ${match[1]}` : 'Android Device';
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      deviceHint = 'iOS';
      deviceFull = ua.includes('iPhone') ? 'iPhone' : 'iPad';
    } else if (ua.includes('Mozilla') || ua.includes('Chrome')) {
      deviceHint = 'Web';
      deviceFull = 'Web Browser';
    }

    // Real Location Hint (GeoIP with API Fallback)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    console.log(`[NGL] Message from IP: ${ip}`);
    let locationHint = "Global Web User";
    
    try {
      const geo = geoip.lookup(ip);
      if (geo && geo.city) {
        locationHint = `${geo.city}, ${geo.country}`;
      } else if (ip === '::1' || ip === '127.0.0.1' || ip.includes('192.168')) {
        locationHint = "Local Network (You)";
      } else {
        // Fallback to real-time API for more accuracy
        const apiResp = await axios.get(`http://ip-api.com/json/${ip}?fields=status,city,countryCode`);
        if (apiResp.data && apiResp.data.status === 'success') {
           locationHint = `${apiResp.data.city}, ${apiResp.data.countryCode}`;
        } else if (geo) {
           locationHint = `Region: ${geo.country}`;
        }
      }
    } catch (err) {
      console.warn('[NGL] GeoIP Error:', err.message);
    }

    if (locationHint === "Global Web User") {
      locationHint = `Web User (IP: ${ip.substring(0, 7)}...)`;
    }

    // Capture extra insights from body
    const { provider, batteryLevel, lat, lng } = req.body;

    const newMessage = await NglMessage.create({ 
      recipientId: targetId, 
      text, 
      isSpam, 
      deviceHint,
      deviceFull,
      locationHint,
      mood,
      provider: provider || null,
      batteryLevel: batteryLevel || null,
      coordinates: (lat && lng) ? { lat, lng } : null
    });
    res.status(201).json({ message: 'Sent anonymously!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get my anonymous messages (excludes spam by default)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const includeSpam = req.query.includeSpam === 'true';
    const filter = { recipientId: req.user.id };
    if (!includeSpam) filter.isSpam = false;
    
    const messages = await NglMessage.find(filter).sort({ isPinned: -1, createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// React to a message
router.patch('/:id/react', authenticateToken, async (req, res) => {
  try {
    const { reaction } = req.body; // emoji string or null to remove
    const msg = await NglMessage.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { reaction: reaction || null },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Pin/unpin a message
router.patch('/:id/pin', authenticateToken, async (req, res) => {
  try {
    const msg = await NglMessage.findOne({ _id: req.params.id, recipientId: req.user.id });
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    
    msg.isPinned = !msg.isPinned;
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark message as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const msg = await NglMessage.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await NglMessage.updateMany(
      { recipientId: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete message
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await NglMessage.findOneAndDelete({ _id: req.params.id, recipientId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Premium: Get Analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.isPremium) return res.status(403).json({ message: 'Premium required' });

    const views = await NglLinkView.find({ recipientId: req.user.id }).sort({ createdAt: -1 });
    const totalViews = views.length;
    
    // Group by day (last 7 days)
    const chartData = {};
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      chartData[d.toDateString()] = 0;
    }

    views.forEach(v => {
      const dStr = new Date(v.createdAt).toDateString();
      if (chartData[dStr] !== undefined) chartData[dStr]++;
    });

    res.json({
      totalViews,
      views: views.slice(0, 50), // last 50 detailed views
      chartData: Object.entries(chartData).map(([name, value]) => ({ name, value })).reverse()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Premium: Ghost AI Reply Draft
router.post('/ghost-ai', authenticateToken, async (req, res) => {
  const { messageText } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user.isPremium) return res.status(403).json({ message: 'Premium required' });

    // Mock AI Generation Logic
    const prompts = [
      `I'm actually quite mysterious if you get to know me... 😉`,
      `That's for me to know and you to find out!`,
      `I have a feeling I know who this is. Maybe.`,
      `Thanks for the note! You have good taste.`,
      `Vibe check passed. Next question?`,
      `I was literally just thinking about this!`,
    ];
    const suggestion = prompts[Math.floor(Math.random() * prompts.length)];

    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Premium: Toggle for Demo Purposes
router.post('/premium-toggle', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.isPremium = !user.isPremium;
    await user.save();
    res.json({ isPremium: user.isPremium });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
