import express from 'express';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Alarm from '../models/Alarm.js';
import { sendPushNotification } from '../utils/push.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user stats (rooms count, friends, alarms)
router.get('/me/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [roomCount, user, alarmCount] = await Promise.all([
      Room.countDocuments({ host: userId }),
      User.findById(userId).select('friends'),
      Alarm.countDocuments({ user: userId }),
    ]);
    res.json({
      rooms: roomCount,
      friends: user?.friends?.length || 0,
      alarms: alarmCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-playlists');
  if (!user) return res.sendStatus(404);
  res.json(user);
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  const { displayName, anonSlug } = req.body;
  const updates = {};
  
  if (displayName) updates.name = displayName;
  
  if (anonSlug) {
    const slug = anonSlug.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_\-]+$/.test(slug)) {
      return res.status(400).json({ message: 'Invalid slug format' });
    }
    const existing = await User.findOne({ anonSlug: slug });
    if (existing && existing._id.toString() !== req.user.id) {
      return res.status(400).json({ message: 'This slug is already taken' });
    }
    updates.anonSlug = slug;
  }
  
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
  res.json(user);
});

// Update timezone
router.put('/me/timezone', authenticateToken, async (req, res) => {
  const { timezone } = req.body;
  const user = await User.findByIdAndUpdate(req.user.id, { timezone }, { new: true });
  res.json(user);
});

// Update avatar
router.put('/me/avatar', authenticateToken, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ message: 'Avatar required' });
  const user = await User.findByIdAndUpdate(req.user.id, { avatar }, { new: true });
  res.json(user);
});

// Update push token
router.put('/me/push-token', authenticateToken, async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ message: 'Token required' });
  await User.findByIdAndUpdate(req.user.id, { pushToken });
  res.json({ message: 'Push token updated' });
});

// Search users by display name
router.get('/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = await User.find({
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ],
  }).select('name email avatar');
  res.json(users);
});

// Get friends list
router.get('/me/friends', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).populate('friends', 'name email avatar');
  if (!user) return res.sendStatus(404);
  res.json(user.friends || []);
});

// Get pending requests (received & sent)
router.get('/me/requests', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).populate('requestsReceived', 'name email avatar').populate('requestsSent', 'name email avatar');
  if (!user) return res.sendStatus(404);
  res.json({ received: user.requestsReceived || [], sent: user.requestsSent || [] });
});

// Send friend request to :targetId
router.post('/me/friend-request/:targetId', authenticateToken, async (req, res) => {
  const { targetId } = req.params;
  if (req.user.id === targetId) return res.status(400).json({ message: 'Cannot friend yourself' });
  const sender = await User.findById(req.user.id);
  const target = await User.findById(targetId);
  if (!sender || !target) return res.sendStatus(404);
  if (sender.friends.includes(target._id)) return res.status(400).json({ message: 'Already friends' });
  if (sender.requestsSent.includes(target._id)) return res.status(400).json({ message: 'Request already sent' });
  sender.requestsSent.push(target._id);
  target.requestsReceived.push(sender._id);
  await sender.save();
  await target.save();

  // Send push notification to target
  if (target.pushToken) {
    sendPushNotification(
      target.pushToken,
      'New Friend Request',
      `${sender.name} sent you a friend request!`,
      { type: 'FRIEND_REQUEST', senderId: sender._id.toString() }
    );
  }

  res.json({ message: 'Request sent' });
});

// Cancel a previously sent request to :targetId
router.post('/me/friend-request/:targetId/cancel', authenticateToken, async (req, res) => {
  const { targetId } = req.params;
  const sender = await User.findById(req.user.id);
  const target = await User.findById(targetId);
  if (!sender || !target) return res.sendStatus(404);
  sender.requestsSent = sender.requestsSent.filter(id => id.toString() !== target._id.toString());
  target.requestsReceived = target.requestsReceived.filter(id => id.toString() !== sender._id.toString());
  await sender.save();
  await target.save();
  res.json({ message: 'Request cancelled' });
});

// Accept a friend request from :senderId
router.post('/me/friend-request/:senderId/accept', authenticateToken, async (req, res) => {
  const { senderId } = req.params;
  const me = await User.findById(req.user.id);
  const sender = await User.findById(senderId);
  if (!me || !sender) return res.sendStatus(404);
  if (!me.requestsReceived.includes(sender._id)) return res.status(400).json({ message: 'No request from this user' });
  me.friends.push(sender._id);
  sender.friends.push(me._id);
  me.requestsReceived = me.requestsReceived.filter(id => id.toString() !== sender._id.toString());
  sender.requestsSent = sender.requestsSent.filter(id => id.toString() !== me._id.toString());
  await me.save();
  await sender.save();
  res.json({ message: 'Friend request accepted' });
});

// Decline a friend request from :senderId
router.post('/me/friend-request/:senderId/decline', authenticateToken, async (req, res) => {
  const { senderId } = req.params;
  const me = await User.findById(req.user.id);
  const sender = await User.findById(senderId);
  if (!me || !sender) return res.sendStatus(404);
  me.requestsReceived = me.requestsReceived.filter(id => id.toString() !== sender._id.toString());
  sender.requestsSent = sender.requestsSent.filter(id => id.toString() !== me._id.toString());
  await me.save();
  await sender.save();
  res.json({ message: 'Request declined' });
});

// Remove a friend (unfriend)
router.delete('/me/friend/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    const me = await User.findById(req.user.id);
    const friend = await User.findById(friendId);
    if (!me || !friend) return res.sendStatus(404);
    me.friends = me.friends.filter(id => id.toString() !== friend._id.toString());
    friend.friends = friend.friends.filter(id => id.toString() !== me._id.toString());
    await me.save();
    await friend.save();
    res.json({ message: 'Unfriended successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to unfriend' });
  }
});

export default router;
