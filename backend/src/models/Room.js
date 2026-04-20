import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: String, default: 'Anonymous' }, // display name or 'Anonymous'
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  text: String,
  isSongSuggestion: { type: Boolean, default: false },
  suggestedSong: { type: String, default: null },
  isAnonymous: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  displayName: { type: String, default: 'Anonymous' },
  isAnonymous: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  socketId: { type: String },
  latencyMs: { type: Number, default: 0 },
  hasPermission: { type: Boolean, default: false },
});

const roomSchema = new mongoose.Schema({
  roomCode: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostSocketId: { type: String },
  members: [memberSchema],
  isPublic: { type: Boolean, default: true },
  mood: { type: String, enum: ['chill', 'sad', 'party', 'focus', 'romantic', 'any'], default: 'any' },
  messages: [messageSchema],
  songQueue: [{
    title: String,
    artist: String,
    suggestedBy: String,
    isAnonymous: { type: Boolean, default: true },
  }],
  currentTrack: {
    title: { type: String, default: '' },
    artist: { type: String, default: '' },
    url: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    isPlaying: { type: Boolean, default: false },
    lastSyncTimestamp: { type: Number, default: 0 },
  },
  gameMode: { type: String, enum: ['none', 'guess-who-added'], default: 'none' },
  maxMembers: { type: Number, default: 50 },
  createdAt: { type: Date, default: Date.now },
});

// Generate a short random room code
roomSchema.statics.generateCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export default mongoose.model('Room', roomSchema);
