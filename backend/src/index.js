
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
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/music-sync');



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
      if (room) {
        // If room was empty, reset to paused state for a fresh start
        if (room.members.length === 0) {
          room.currentTrack.isPlaying = false;
        }

        // Remove any existing entries for this user ID (to prevent duplicates) or this socket
        if (userId) {
          room.members = room.members.filter(m => m.userId?.toString() !== userId.toString());
        }
        room.members = room.members.filter(m => m.socketId !== socket.id);

        // Add member to room
        room.members.push({
          userId: userId || null,
          displayName: name,
          isAnonymous: !!isAnonymous,
          socketId: socket.id,
        });
        // If this is the host, update hostSocketId
        if (userId && room.host._id.toString() === userId) {
          room.hostSocketId = socket.id;
        }
        await room.save();

        // Send current room state to the joining user
        socket.emit('room-state', {
          roomCode: room.roomCode,
          name: room.name,
          mood: room.mood,
          members: room.members,
          currentTrack: room.currentTrack,
          messages: room.messages.slice(-50),
          songQueue: room.songQueue,
          gameMode: room.gameMode,
          hostId: room.host._id.toString(),
          hostName: room.host.name,
          hostAvatar: room.host.avatar,
        });

        // Notify others
        socket.to(socketKey).emit('member-joined', {
          socketId: socket.id,
          displayName: name,
          isAnonymous: !!isAnonymous,
          memberCount: room.members.length,
        });

        // Broadcast full updated member list to everyone in the room
        io.to(socketKey).emit('room-update', { members: room.members });
      }
    } catch (err) {
      console.error('join-room DB error:', err);
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

      // If room is empty, stop playback
      if (room.members.length === 0) {
        room.currentTrack.isPlaying = false;
      }
      // Note: We're disabling immediate deletion to keep host-created rooms alive
      // while they navigate between app screens.
      /*
      if (room.members.length === 0) {
        await Room.deleteOne({ _id: room._id });
      } else {
      */
        await room.save();
        io.to(`room:${info.roomCode}`).emit('member-left', {
          socketId: socket.id,
          displayName: info.displayName,
          memberCount: room.members.length,
        });
        // Broadcast full updated member list to everyone left
        io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
      // }
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

