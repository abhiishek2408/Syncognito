import express from 'express';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Create a new room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, isPublic, mood } = req.body;
    let roomCode;
    // Ensure unique code
    do {
      roomCode = Room.generateCode();
    } while (await Room.findOne({ roomCode }));

    const room = await Room.create({
      roomCode,
      name: name || `${roomCode}'s Room`,
      host: req.user.id,
      isPublic: isPublic !== false,
      mood: mood || 'any',
      members: [],
    });
    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ message: 'Failed to create room' });
  }
});

// List rooms (Public + Host's own Private rooms)
router.get('/public', optionalAuth, async (req, res) => {
  try {
    let filter = { $or: [] };
    const publicCondition = { isPublic: true };
    
    if (req.query.mood && req.query.mood !== 'any') {
      publicCondition.mood = req.query.mood;
    }
    
    filter.$or.push(publicCondition);
    
    if (req.user?.id) {
      const hostIdStr = req.user.id.toString();
      console.log('Fetching rooms for authenticated host:', hostIdStr);
      filter.$or.push({ host: hostIdStr });
    } else {
      console.log('Fetching rooms for anonymous/unauthenticated user');
      filter = publicCondition;
    }

    console.log('Room search filter applied:', JSON.stringify(filter, null, 2));
    
    const rooms = await Room.find(filter)
      .populate('host', 'name email avatar')
      .select('-messages')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(rooms);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ message: 'Failed to list rooms' });
  }
});

// Get global stats (total listeners & active rooms)
router.get('/stats/global', async (req, res) => {
  try {
    const rooms = await Room.find({ isPublic: true });
    const totalPublicRooms = rooms.length;
    const totalListeners = rooms.reduce((sum, r) => sum + (r.members?.length || 0), 0);
    
    res.json({
      activeRooms: totalPublicRooms,
      listeners: totalListeners,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch global stats' });
  }
});


// Get room by code
router.get('/code/:code', optionalAuth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.code.toUpperCase() })
      .populate('host', 'name email avatar');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // If private, only allow members/host
    if (!room.isPublic) {
      const userId = req.user?.id;
      const isMember = room.host._id.toString() === userId ||
        room.members.some(m => m.userId?.toString() === userId);
      if (!isMember && !userId) {
        // Anonymous can still join private rooms via code
      }
    }
    res.json(room);
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ message: 'Failed to get room' });
  }
});

// Get room by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('host', 'name email avatar');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ message: 'Failed to get room' });
  }
});

// Rooms are now permanent and cannot be deleted via API.

// Update room mood (host only)
router.put('/:id/mood', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.host.toString() !== req.user.id) return res.status(403).json({ message: 'Only host can change mood' });
    room.mood = req.body.mood || 'any';
    await room.save();
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update mood' });
  }
});

export default router;
