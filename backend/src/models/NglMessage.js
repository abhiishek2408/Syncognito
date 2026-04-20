import mongoose from 'mongoose';

const nglMessageSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

export default mongoose.model('NglMessage', nglMessageSchema);
