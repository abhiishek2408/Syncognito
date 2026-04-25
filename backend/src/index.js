
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import nodeFetch from 'node-fetch';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import playlistRoutes from './routes/playlist.js';
import userRoutes from './routes/user.js';
import roomRoutes from './routes/room.js';
import alarmRoutes from './routes/alarm.js';
import nglRoutes from './routes/ngl.js';
import User from './models/User.js';
import Room from './models/Room.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- Security Middlewares ---
app.use(helmet()); // Set security HTTP headers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 1000, // Limit each IP to 1000 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter); // Apply rate limiter to all API routes
app.use(mongoSanitize()); // Data sanitization against NoSQL query injection
app.use(hpp()); // Prevent HTTP Parameter Pollution

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent payload DOS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));


// MongoDB connection
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/music-sync')
  .then(() => console.log('Successfully connected to MongoDB Cluster.'))
  .catch((err) => {
    console.error('CRITICAL: MongoDB connection failed!');
    console.error('Error Details:', err.message);
    process.exit(1); // Exit if DB connection fails to trigger a restart
  });




// Routes

app.use('/api/playlists', playlistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/ngl', nglRoutes);

app.get('/', (req, res) => {
  res.send('Syncognito Backend Running');
});

// ===========================
// Socket.IO — Room-based real-time sync
// ===========================

// Track connected sockets and their rooms
const socketRooms = new Map(); // socketId -> { roomCode, userId, displayName, isAnonymous }
const latencyMap = new Map();  // socketId -> latency in ms

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // ---- Latency measurement (ping/pong) ----
  const pingInterval = setInterval(() => {
    socket.emit('sync-ping', { serverTime: Date.now() });
  }, 5000);

  socket.on('sync-pong', (data) => {
    const latency = Math.round((Date.now() - data.serverTime) / 2);
    latencyMap.set(socket.id, latency);
    socket.emit('latency-update', { latencyMs: latency });
    // Broadcast latency to room members
    const info = socketRooms.get(socket.id);
    if (info?.roomCode) {
      io.to(`room:${info.roomCode}`).emit('member-latency', {
        socketId: socket.id,
        displayName: info.displayName,
        latencyMs: latency,
      });
    }
  });

  // ---- Join Room ----
  socket.on('join-room', async (data) => {
    // data: { roomCode, userId?, displayName?, isAnonymous? }
    const { roomCode, userId, displayName, isAnonymous } = data;
    if (!roomCode) return;

    const socketKey = `room:${roomCode}`;
    socket.join(socketKey);

    const name = isAnonymous ? 'Anonymous' : (displayName || 'User');
    socketRooms.set(socket.id, { roomCode, userId, displayName: name, isAnonymous: !!isAnonymous });

    // Update room in DB
    try {
      const room = await Room.findOne({ roomCode }).populate('host', 'name avatar');
      if (!room) return;

      const isRoomHost = userId && room.host._id.toString() === userId.toString();

      // 1. If room is OFFLINE and joining person is NOT the host, reject.
      if (room.status === 'offline' && !isRoomHost) {
        socket.emit('error-msg', { message: 'Room has not been started by the host yet.' });
        return;
      }

      // 2. If it's the Host joining
      if (isRoomHost) {
        room.status = 'online';
        room.hostSocketId = socket.id;
        // Host is always an active member
        room.members = room.members.filter(m => m.userId?.toString() !== userId.toString());
        room.members.push({
          userId: userId,
          displayName: displayName || 'Host',
          socketId: socket.id,
        });
        await room.save();

        socket.emit('room-state', {
          roomCode: room.roomCode,
          name: room.name,
          members: room.members,
          pendingMembers: room.pendingMembers,
          currentTrack: room.currentTrack,
          messages: room.messages.slice(-50),
          isHost: true
        });
        io.to(socketKey).emit('room-update', { members: room.members });
      } 
      // 3. If it's a regular member joining
      else {
        // Add to pending members
        room.pendingMembers = room.pendingMembers.filter(m => m.socketId !== socket.id);
        room.pendingMembers.push({
          userId: userId || null,
          displayName: name,
          isAnonymous: !!isAnonymous,
          socketId: socket.id,
        });
        await room.save();

        socket.emit('waiting-for-approval', { message: 'Request sent to host. Waiting for approval...' });
        
        // Notify the host
        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit('new-join-request', {
            socketId: socket.id,
            displayName: name,
            userId: userId || null
          });
        }
      }
    } catch (err) {
      console.error('join-room DB error:', err);
    }
  });

  // ---- Approve Join Request ----
  socket.on('approve-join', async (data) => {
    // data: { targetSocketId, roomCode }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      if (room.hostSocketId !== socket.id) return; // Only host can approve

      const pendingUser = room.pendingMembers.find(m => m.socketId === data.targetSocketId);
      if (pendingUser) {
        // Move from pending to active members
        room.pendingMembers = room.pendingMembers.filter(m => m.socketId !== data.targetSocketId);
        room.members.push(pendingUser);
        await room.save();

        // Notify the user they are in!
        io.to(data.targetSocketId).emit('join-approved', {
          roomState: {
            roomCode: room.roomCode,
            name: room.name,
            members: room.members,
            currentTrack: room.currentTrack,
            messages: room.messages.slice(-50),
            songQueue: room.songQueue,
          }
        });

        // Broadcast updated member list
        io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
        // Notify host about updated pending list
        socket.emit('pending-update', { pendingMembers: room.pendingMembers });
      }
    } catch (err) {
      console.error('approve-join error:', err);
    }
  });

  // ---- Reject Join Request ----
  socket.on('reject-join', async (data) => {
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;

      room.pendingMembers = room.pendingMembers.filter(m => m.socketId !== data.targetSocketId);
      await room.save();

      io.to(data.targetSocketId).emit('join-rejected', { message: 'Your request to join was rejected by the host.' });
      socket.emit('pending-update', { pendingMembers: room.pendingMembers });
    } catch (err) {
      console.error('reject-join error:', err);
    }
  });

  // ---- Leave Room ----
  socket.on('leave-room', async () => {
    await handleLeaveRoom(socket);
  });

  // ---- Host Playback Controls (room-scoped) ----
  socket.on('room-playback', async (data) => {
    // data: { roomCode, action: 'play'|'pause'|'seek'|'track-change', position?, track? }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;

      // Only host or permitted members can control playback
      const isMemberPermitted = room.members.find(m => m.socketId === socket.id && m.hasPermission);
      const isHost = info.userId && room.host.toString() === info.userId;

      if (!isHost && !isMemberPermitted) {
        socket.emit('error-msg', { message: 'Only the host or permitted members can control playback' });
        return;
      }

      // Update room state
      const now = Date.now();
      if (data.action === 'play') {
        room.currentTrack.isPlaying = true;
        room.currentTrack.position = data.position || room.currentTrack.position;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'pause') {
        room.currentTrack.isPlaying = false;
        room.currentTrack.position = data.position || room.currentTrack.position;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'seek') {
        room.currentTrack.position = data.position || 0;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'track-change') {
        room.currentTrack.title = data.track?.title || '';
        room.currentTrack.artist = data.track?.artist || '';
        room.currentTrack.url = data.track?.url || '';
        room.currentTrack.duration = data.track?.duration || 0;
        room.currentTrack.position = 0;
        room.currentTrack.isPlaying = false;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'track-update') {
        if (data.duration) room.currentTrack.duration = data.duration;
        if (data.title) room.currentTrack.title = data.title;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'unload') {
        room.currentTrack.title = '';
        room.currentTrack.artist = '';
        room.currentTrack.url = '';
        room.currentTrack.duration = 0;
        room.currentTrack.position = 0;
        room.currentTrack.isPlaying = false;
        room.currentTrack.lastSyncTimestamp = now;
      }
      await room.save();

      // Broadcast to all room members (including sender for confirmation)
      io.to(`room:${info.roomCode}`).emit('room-playback-sync', {
        action: data.action,
        currentTrack: room.currentTrack,
        serverTimestamp: now,
      });
    } catch (err) {
      console.error('room-playback error:', err);
    }
  });

  // ---- Room Chat (supports anonymous) ----
  socket.on('room-chat', async (data) => {
    // data: { text, isSongSuggestion?, suggestedSong? }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;

      const msg = {
        sender: info.isAnonymous ? 'Anonymous' : info.displayName,
        senderId: info.userId || null,
        text: data.text,
        isSongSuggestion: !!data.isSongSuggestion,
        suggestedSong: data.suggestedSong || null,
        isAnonymous: !!info.isAnonymous,
        createdAt: new Date(),
      };

      room.messages.push(msg);
      // Keep only last 200 messages
      if (room.messages.length > 200) {
        room.messages = room.messages.slice(-200);
      }

      // If it's a song suggestion, add to queue
      if (data.isSongSuggestion && data.suggestedSong) {
        room.songQueue.push({
          title: data.suggestedSong,
          artist: '',
          suggestedBy: info.isAnonymous ? 'Anonymous' : info.displayName,
          isAnonymous: !!info.isAnonymous,
        });
      }

      await room.save();

      // Broadcast message
      io.to(`room:${info.roomCode}`).emit('room-message', msg);
    } catch (err) {
      console.error('room-chat error:', err);
    }
  });

  // ---- Song Queue Management ----
  socket.on('suggest-song', async (data) => {
    // data: { title, artist? }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;

      const suggestion = {
        title: data.title,
        artist: data.artist || '',
        suggestedBy: info.isAnonymous ? 'Anonymous' : info.displayName,
        isAnonymous: !!info.isAnonymous,
      };

      room.songQueue.push(suggestion);
      await room.save();

      io.to(`room:${info.roomCode}`).emit('song-queue-update', {
        queue: room.songQueue,
        newSuggestion: suggestion,
      });
    } catch (err) {
      console.error('suggest-song error:', err);
    }
  });

  // ---- Game Mode: Guess Who Added ----
  socket.on('toggle-game-mode', async (data) => {
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      if (info.userId && room.host.toString() !== info.userId) return;

      room.gameMode = room.gameMode === 'guess-who-added' ? 'none' : 'guess-who-added';
      await room.save();

      io.to(`room:${info.roomCode}`).emit('game-mode-changed', { gameMode: room.gameMode });
    } catch (err) {
      console.error('toggle-game-mode error:', err);
    }
  });

  // ---- Mood Change (host only) ----
  socket.on('change-mood', async (data) => {
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      if (info.userId && room.host.toString() !== info.userId) return;

      room.mood = data.mood || 'any';
      await room.save();

      io.to(`room:${info.roomCode}`).emit('mood-changed', { mood: room.mood });
    } catch (err) {
      console.error('change-mood error:', err);
    }
  });

  // ---- Hand Raise / Permission Request ----
  socket.on('raise-hand', (data) => {
    // data: { roomCode, userId, displayName }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;
    
    // Notify the host about the request
    io.to(`room:${info.roomCode}`).emit('hand-raised', {
      socketId: socket.id,
      userId: info.userId,
      displayName: info.displayName
    });
  });

  socket.on('approve-hand', async (data) => {
    // data: { targetSocketId, roomCode }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;
    
    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (room) {
        const member = room.members.find(m => m.socketId === data.targetSocketId);
        if (member) {
          member.hasPermission = true;
          await room.save();
          io.to(data.targetSocketId).emit('permission-status', { status: 'approved' });
          // Broadcast updated member list (permission changed)
          io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
        }
      }
    } catch (err) {
      console.error('approve-hand error:', err);
    }
  });

  socket.on('reject-hand', async (data) => {
    // data: { targetSocketId, roomCode }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;
    
    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (room) {
        const member = room.members.find(m => m.socketId === data.targetSocketId);
        if (member) {
          member.hasPermission = false;
          await room.save();
        }
        io.to(data.targetSocketId).emit('permission-status', { status: 'rejected' });
      }
    } catch (err) {
      console.error('reject-hand error:', err);
    }
  });

  // ---- Legacy events for backward compatibility ----
  // Group playback sync events
  socket.on('playback-action', (data) => {
    // data: { action: 'play'|'pause'|'seek'|'track', position, trackIndex }
    socket.broadcast.emit('playback-action', data);
  });

  // Legacy sync-action for backward compatibility
  socket.on('sync-action', (data) => {
    socket.broadcast.emit('sync-action', data);
  });

  // Real-time chat
  socket.on('chat-message', async (msg) => {
    io.emit('chat-message', { user: socket.id, message: msg });
    // Remote push notification
    try {
      const users = await User.find({});
      const sender = socket.id;
      const tokens = users.filter(u => u.pushToken).map(u => u.pushToken);
      if (tokens.length > 0) {
        await nodeFetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokens.map(token => ({
            to: token,
            sound: 'default',
            title: 'New Chat Message',
            body: `${sender}: ${msg}`,
          })))
        });
      }
    } catch (e) { /* ignore */ }
  });

  // ---- Disconnect ----
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    clearInterval(pingInterval);
    latencyMap.delete(socket.id);
    await handleLeaveRoom(socket);
  });
});

// Helper: remove socket from room
async function handleLeaveRoom(socket) {
  const info = socketRooms.get(socket.id);
  if (!info?.roomCode) return;

  try {
    const room = await Room.findOne({ roomCode: info.roomCode });
    if (room) {
      room.members = room.members.filter(m => m.socketId !== socket.id);
      
      // Clear host socket if host leaves
      if (room.hostSocketId === socket.id) {
        room.hostSocketId = null;
      }

      // Never delete the room, just set it to offline if empty
      if (room.members.length === 0) {
        room.status = 'offline';
        room.currentTrack.isPlaying = false;
        room.hostSocketId = null;
        await room.save();
      } else {
        await room.save();
        io.to(`room:${info.roomCode}`).emit('member-left', {
          socketId: socket.id,
          displayName: info.displayName,
          memberCount: room.members.length,
        });
        
        // Broadcast full updated member list to everyone left
        io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
      }
    }
  } catch (err) {
    console.error('handleLeaveRoom error:', err);
  }

  socket.leave(`room:${info.roomCode}`);
  socketRooms.delete(socket.id);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

