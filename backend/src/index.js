
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
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import playlistRoutes from './routes/playlist.js';
import userRoutes from './routes/user.js';
import roomRoutes from './routes/room.js';
import alarmRoutes from './routes/alarm.js';
import nglRoutes from './routes/ngl.js';
import paymentRoutes from './routes/payment.js';
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

app.use('/api/ngl', nglRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/', (req, res) => {
  res.send('Syncognito Backend Running');
});

// ===========================
// Audio Upload for Room Sync
// ===========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads', 'audio');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Multer config for audio uploads (max 30MB)
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (req, file, cb) => {
    const allowed = /audio\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Upload audio endpoint
app.post('/api/rooms/upload-audio', audioUpload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }
  
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/audio/${req.file.filename}`;
  
  console.log(`Audio uploaded: ${req.file.originalname} → ${fileUrl}`);
  
  // Auto-delete uploaded file after 2 hours
  setTimeout(() => {
    const filePath = path.join(uploadsDir, req.file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Auto-deleted: ${req.file.filename}`);
    }
  }, 2 * 60 * 60 * 1000);

  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    size: req.file.size
  });
});

// ===========================
// Socket.IO — Room-based real-time sync
// ===========================

// Track connected sockets and their rooms
const socketRooms = new Map(); // socketId -> { roomCode, userId, displayName, isAnonymous }
const latencyMap = new Map();  // socketId -> latency in ms
const hostDisconnectTimers = new Map(); // roomCode -> { timer, socketId }

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

    // Auto-leave any previous room associated with this socket
    await handleLeaveRoom(socket);

    // CRITICAL: Force-close any OTHER online rooms hosted by this user
    if (userId) {
      const otherRooms = await Room.find({ 
        host: userId, 
        roomCode: { $ne: roomCode },
        status: 'online' 
      });
      for (const otherRoom of otherRooms) {
        otherRoom.status = 'offline';
        otherRoom.members = [];
        otherRoom.hostSocketId = null;
        await otherRoom.save();
        io.to(`room:${otherRoom.roomCode}`).emit('room-closed', { 
          message: 'Host has started another room. This session ended.' 
        });
      }
    }

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
        // Cancel any pending host disconnect grace timer
        const pendingTimer = hostDisconnectTimers.get(roomCode);
        if (pendingTimer) {
          clearTimeout(pendingTimer.timer);
          hostDisconnectTimers.delete(roomCode);
          console.log(`Host reconnected to room ${roomCode} — grace timer cancelled.`);
        }

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
          theme: room.theme || 'default',
          allowDJAccess: !!room.allowDJAccess,
          isHost: true
        });
        io.to(socketKey).emit('room-update', { members: room.members });
      } 
      // 3. If it's a regular member joining
      else {
        // Check if already an approved member (by userId)
        const isAlreadyMember = room.members.find(m => 
          (userId && m.userId?.toString() === userId.toString()) || (m.socketId === socket.id)
        );

        if (isAlreadyMember) {
          // Update their socketId in case they reconnected with a new one
          isAlreadyMember.socketId = socket.id;
          isAlreadyMember.displayName = name;
          await room.save();

          // Just send the state, no need for approval
          socket.emit('room-state', {
            roomCode: room.roomCode,
            name: room.name,
            members: room.members,
            currentTrack: room.currentTrack,
            messages: room.messages.slice(-50),
            songQueue: room.songQueue,
            allowDJAccess: !!room.allowDJAccess,
            isHost: false
          });
          // Broadcast updated member list so everyone sees the reconnection
          io.to(socketKey).emit('room-update', { members: room.members });
          return;
        }

        // Add to pending members (filter out existing entries for this user/socket first)
        room.pendingMembers = room.pendingMembers.filter(m => 
          !( (userId && m.userId?.toString() === userId.toString()) || (m.socketId === socket.id) )
        );
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
        
        // REMOVE DUPLICATE from active members before adding (if they were already there)
        if (pendingUser.userId) {
          room.members = room.members.filter(m => m.userId?.toString() !== pendingUser.userId.toString());
        } else {
          room.members = room.members.filter(m => m.socketId !== pendingUser.socketId);
        }
        
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
            allowDJAccess: !!room.allowDJAccess,
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
      const isHost = (info.userId && room.host.toString() === info.userId) || (room.hostSocketId === socket.id);

      if (!isHost && !isMemberPermitted) {
        console.log(`Playback control denied for socket ${socket.id}. IsHost: ${isHost}`);
        socket.emit('error-msg', { message: 'Only the host or permitted members can control playback' });
        return;
      }

      // Update room state
      const now = Date.now();
      if (data.action === 'play') {
        room.currentTrack.isPlaying = true;
        room.currentTrack.position = (data.position !== undefined) ? data.position : room.currentTrack.position;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'pause') {
        room.currentTrack.isPlaying = false;
        room.currentTrack.position = (data.position !== undefined) ? data.position : room.currentTrack.position;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'seek' || data.action === 'position-update') {
        room.currentTrack.position = (data.position !== undefined) ? data.position : 0;
        room.currentTrack.lastSyncTimestamp = now;
      } else if (data.action === 'track-change') {
        room.currentTrack.title = data.track?.title || '';
        room.currentTrack.artist = data.track?.artist || '';
        room.currentTrack.url = data.track?.url || '';
        room.currentTrack.duration = data.track?.duration || 0;
        room.currentTrack.position = 0;
        room.currentTrack.isPlaying = true;
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
          suggestedById: info.userId || null,
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
        suggestedById: info.userId || null,
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

  // ---- Queue Voting ----
  socket.on('vote-song', async (data) => {
    // data: { songId, vote: 1 | -1 }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode || !info.userId) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;

      const song = room.songQueue.id(data.songId);
      if (song) {
        // Simple voting logic: allow multiple votes for now or toggle? Let's do cumulative.
        song.votes = (song.votes || 0) + (data.vote || 0);
        
        // Sort queue by votes (descending)
        room.songQueue.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        
        await room.save();
        io.to(`room:${info.roomCode}`).emit('song-queue-update', { queue: room.songQueue });
      }
    } catch (err) {
      console.error('vote-song error:', err);
    }
  });

  // ---- Game: Submit Guess ----
  socket.on('submit-guess', async (data) => {
    // data: { songId, guessedHostId }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode || !info.userId) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room || room.gameMode !== 'guess-who-added') return;

      const song = room.songQueue.id(data.songId);
      if (song) {
        const isCorrect = song.suggestedById?.toString() === data.guessedHostId;
        song.guesses.push({
          userId: info.userId,
          guessedHostId: data.guessedHostId,
          correct: isCorrect
        });
        await room.save();
        
        socket.emit('guess-result', { correct: isCorrect, songId: data.songId });
        if (isCorrect) {
          io.to(`room:${info.roomCode}`).emit('room-chat', {
            sender: 'SYSTEM',
            text: `${info.displayName} correctly guessed who added "${song.title}"! 🎉`,
            createdAt: new Date()
          });
        }
      }
    } catch (err) {
      console.error('submit-guess error:', err);
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

  // ---- Emoji Reaction ----
  socket.on('send-reaction', (data) => {
    // data: { emoji }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;
    io.to(`room:${info.roomCode}`).emit('new-reaction', {
      emoji: data.emoji,
      userId: info.userId,
      socketId: socket.id
    });
  });

  // ---- Change Theme (Host Only) ----
  socket.on('change-theme', async (data) => {
    // data: { theme }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      if (info.userId && room.host.toString() !== info.userId) return;

      room.theme = data.theme || 'default';
      await room.save();
      io.to(`room:${info.roomCode}`).emit('theme-changed', { theme: room.theme });
    } catch (err) {
      console.error('change-theme error:', err);
    }
  });

  socket.on('approve-hand', async (data) => {
    // data: { targetSocketId, roomCode }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;
    
    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (room) {
        // EXCLUSIVE: Revoke permission from ALL other members first
        for (const m of room.members) {
          if (m.socketId !== data.targetSocketId && m.hasPermission) {
            m.hasPermission = false;
            io.to(m.socketId).emit('permission-status', { status: 'revoked' });
          }
        }

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
        io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
      }
    } catch (err) {
      console.error('reject-hand error:', err);
    }
  });

  // ---- Toggle Permission (Host can grant/revoke from Members tab) ----
  socket.on('toggle-permission', async (data) => {
    // data: { targetSocketId, grant: boolean }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      // Only host can toggle
      if (room.hostSocketId !== socket.id) return;

      if (data.grant) {
        // EXCLUSIVE: Revoke from everyone else first
        for (const m of room.members) {
          if (m.socketId !== data.targetSocketId && m.hasPermission) {
            m.hasPermission = false;
            io.to(m.socketId).emit('permission-status', { status: 'revoked' });
          }
        }
        // Grant to target
        const target = room.members.find(m => m.socketId === data.targetSocketId);
        if (target) {
          target.hasPermission = true;
          io.to(data.targetSocketId).emit('permission-status', { status: 'approved' });
        }
      } else {
        // Revoke from target
        const target = room.members.find(m => m.socketId === data.targetSocketId);
        if (target) {
          target.hasPermission = false;
          io.to(data.targetSocketId).emit('permission-status', { status: 'revoked' });
        }
      }

      await room.save();
      io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
    } catch (err) {
      console.error('toggle-permission error:', err);
    }
  });

  // ---- Toggle DJ Access Feature (Host enables/disables the whole feature) ----
  socket.on('toggle-dj-access', async (data) => {
    // data: { allow: boolean }
    const info = socketRooms.get(socket.id);
    if (!info?.roomCode) return;

    try {
      const room = await Room.findOne({ roomCode: info.roomCode });
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;

      room.allowDJAccess = !!data.allow;

      // If disabling, revoke all existing permissions
      if (!data.allow) {
        for (const m of room.members) {
          if (m.hasPermission) {
            m.hasPermission = false;
            io.to(m.socketId).emit('permission-status', { status: 'revoked' });
          }
        }
      }

      await room.save();
      io.to(`room:${info.roomCode}`).emit('dj-access-changed', { allowDJAccess: room.allowDJAccess });
      io.to(`room:${info.roomCode}`).emit('room-update', { members: room.members });
    } catch (err) {
      console.error('toggle-dj-access error:', err);
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
    await handleLeaveRoom(socket, true); // true = isDisconnect (use grace period for host)
  });
});

// Helper: remove socket from room
// isDisconnect = true means socket dropped (use grace period for host)
// isDisconnect = false means intentional leave (close immediately)
async function handleLeaveRoom(socket, isDisconnect = false) {
  const info = socketRooms.get(socket.id);
  if (!info?.roomCode) return;

  const GRACE_PERIOD_MS = 15000; // 15 seconds grace for host reconnection

  try {
    const room = await Room.findOne({ roomCode: info.roomCode });
    if (room) {
      const isHostLeaving = room.hostSocketId === socket.id;
      const userId = info.userId;

      // Remove this socket from members & pending
      room.members = room.members.filter(m => 
        m.socketId !== socket.id && (!userId || m.userId?.toString() !== userId.toString())
      );
      room.pendingMembers = room.pendingMembers.filter(m => 
        m.socketId !== socket.id && (!userId || m.userId?.toString() !== userId.toString())
      );
      
      if (isHostLeaving) {
        // If this is a network disconnect, give host a grace period to reconnect
        if (isDisconnect) {
          console.log(`Host disconnected from room ${info.roomCode}. Starting ${GRACE_PERIOD_MS/1000}s grace period...`);
          
          // Pause playback while host is away
          room.currentTrack.isPlaying = false;
          room.hostSocketId = null;
          await room.save();

          // Notify members that host briefly disconnected (NOT room-closed)
          io.to(`room:${info.roomCode}`).emit('host-disconnected', { 
            message: 'Host temporarily disconnected. Waiting for reconnection...',
            gracePeriodMs: GRACE_PERIOD_MS 
          });

          // Set a timer — if host doesn't reconnect, THEN close the room
          const timer = setTimeout(async () => {
            try {
              const roomCheck = await Room.findOne({ roomCode: info.roomCode });
              if (roomCheck && roomCheck.status === 'online' && !roomCheck.hostSocketId) {
                // Host did NOT reconnect in time → close the room
                console.log(`Grace period expired for room ${info.roomCode}. Closing room.`);
                roomCheck.status = 'offline';
                roomCheck.currentTrack = {
                  title: '',
                  artist: '',
                  url: '',
                  duration: 0,
                  position: 0,
                  isPlaying: false,
                  lastSyncTimestamp: 0
                };
                roomCheck.members = [];
                await roomCheck.save();

                io.to(`room:${info.roomCode}`).emit('room-closed', { 
                  message: 'Host disconnected. Room session ended.' 
                });
              }
            } catch (err) {
              console.error('Grace period timer error:', err);
            }
            hostDisconnectTimers.delete(info.roomCode);
          }, GRACE_PERIOD_MS);

          hostDisconnectTimers.set(info.roomCode, { timer, socketId: socket.id });

        } else {
          // Intentional leave (host pressed Close Room) → close immediately
          room.status = 'offline';
          room.currentTrack = {
            title: '',
            artist: '',
            url: '',
            duration: 0,
            position: 0,
            isPlaying: false,
            lastSyncTimestamp: 0
          };
          room.hostSocketId = null;
          room.members = [];
          await room.save();
          
          // Cancel any lingering grace timer
          const pendingTimer = hostDisconnectTimers.get(info.roomCode);
          if (pendingTimer) {
            clearTimeout(pendingTimer.timer);
            hostDisconnectTimers.delete(info.roomCode);
          }

          io.to(`room:${info.roomCode}`).emit('room-closed', { 
            message: 'Host has closed the room. Session ended.' 
          });
        }
      } else if (room.members.length === 0 && !room.hostSocketId) {
        room.status = 'offline';
        room.currentTrack = {
          title: '',
          artist: '',
          url: '',
          duration: 0,
          position: 0,
          isPlaying: false,
          lastSyncTimestamp: 0
        };
        await room.save();
      } else {
        await room.save();
        io.to(`room:${info.roomCode}`).emit('member-left', {
          socketId: socket.id,
          displayName: info.displayName,
          memberCount: room.members.length,
        });
        
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

