import mongoose from 'mongoose';

const nglMessageSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  reaction: { type: String, default: null }, // emoji reaction from recipient
  isPinned: { type: Boolean, default: false },
  isSpam: { type: Boolean, default: false },
  deviceHint: { type: String, default: null }, // e.g. "Android", "iOS", "Web" — subtle hint about sender
});

export default mongoose.model('NglMessage', nglMessageSchema);
