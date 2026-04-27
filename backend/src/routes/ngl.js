import express from 'express';
import { body, param, validationResult } from 'express-validator';
import NglMessage from '../models/NglMessage.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
import { authenticateToken } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();

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

  // Simple spam filter — block messages with too many repeated chars or offensive patterns
  const SPAM_PATTERNS = [
    /(.)\1{8,}/i, // same char repeated 8+ times
    /https?:\/\//i, // links
    /bit\.ly|tinyurl/i, // shortened links
  ];
  const isSpam = SPAM_PATTERNS.some(p => p.test(text));

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
    if (ua.includes('Android')) deviceHint = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) deviceHint = 'iOS';
    else if (ua.includes('Mozilla') || ua.includes('Chrome')) deviceHint = 'Web';

    const newMessage = new NglMessage({ recipientId: targetId, text, isSpam, deviceHint });
    await newMessage.save();
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

export default router;
