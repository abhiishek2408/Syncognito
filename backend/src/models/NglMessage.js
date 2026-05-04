import mongoose from 'mongoose';

const nglMessageSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  reaction: { type: String, default: null }, // emoji reaction from recipient
  isPinned: { type: Boolean, default: false },
  isSpam: { type: Boolean, default: false },
  deviceHint: { type: String, default: null }, // e.g. "Android", "iOS", "Web"
  locationHint: { type: String, default: null }, // e.g. "London, UK"
  deviceFull: { type: String, default: null }, // e.g. "iPhone 15 Pro"
  senderUserHint: { type: String, default: null }, // e.g. "A***"
  provider: { type: String, default: null }, // e.g. "Jio", "Airtel"
  batteryLevel: { type: Number, default: null }, // e.g. 85
  mood: { type: String, default: 'Neutral' }, // e.g. "Happy", "Angry"
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  }
});

export default mongoose.model('NglMessage', nglMessageSchema);
