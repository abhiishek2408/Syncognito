import mongoose from 'mongoose';

const nglLinkViewSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewerIp: String,
  userAgent: String,
  referrer: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('NglLinkView', nglLinkViewSchema);
