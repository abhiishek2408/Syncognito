import express from 'express';
import Alarm from '../models/Alarm.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all alarms for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Auto-delete cleanup: Remove triggered or significantly expired alarms (missed by > 30 mins)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    await Alarm.deleteMany({
      userId: req.user.id,
      $or: [
        { isTriggered: true },
        { triggerAt: { $lt: thirtyMinsAgo } }
      ]
    });

    const alarms = await Alarm.find({ userId: req.user.id }).sort({ triggerAt: 1 });
    res.json(alarms);
  } catch (err) {
    console.error('Get alarms error:', err);
    res.status(500).json({ message: 'Failed to get alarms' });
  }
});

// Create a new alarm
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { triggerAt, message, title } = req.body;
    if (!triggerAt) return res.status(400).json({ message: 'triggerAt is required' });
    const alarm = await Alarm.create({
      userId: req.user.id,
      triggerAt: new Date(triggerAt),
      message: message || '',
      title: title || 'Alarm',
    });
    res.status(201).json(alarm);
  } catch (err) {
    console.error('Create alarm error:', err);
    res.status(500).json({ message: 'Failed to create alarm' });
  }
});

// Update an alarm
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { triggerAt, message, title, isTriggered } = req.body;
    
    // If marking as triggered, auto-delete it immediately
    if (isTriggered === true) {
      const result = await Alarm.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
      if (!result) return res.status(404).json({ message: 'Alarm not found' });
      return res.json({ message: 'Alarm triggered and auto-deleted' });
    }

    const alarm = await Alarm.findOne({ _id: req.params.id, userId: req.user.id });
    if (!alarm) return res.status(404).json({ message: 'Alarm not found' });
    
    if (triggerAt) alarm.triggerAt = new Date(triggerAt);
    if (message !== undefined) alarm.message = message;
    if (title !== undefined) alarm.title = title;
    await alarm.save();
    res.json(alarm);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update alarm' });
  }
});

// Delete an alarm
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Alarm.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!result) return res.status(404).json({ message: 'Alarm not found' });
    res.json({ message: 'Alarm deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete alarm' });
  }
});

export default router;
