import mongoose from 'mongoose';

const nglPollSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  options: [{
    text: { type: String, required: true },
    votes: { type: Number, default: 0 }
  }],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }, // 24 hours default
  isClosed: { type: Boolean, default: false },
  voters: [{ type: String }], // IP addresses to prevent double voting (simple check)
});

export default mongoose.model('NglPoll', nglPollSchema);
