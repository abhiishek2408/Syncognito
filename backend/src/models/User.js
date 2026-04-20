import mongoose from 'mongoose';



const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  avatar: String,
  profile_pic: String,
  role: { type: String, default: 'user' },
  profile_status: { type: String, enum: ['active', 'inactive', 'banned', 'pending'], default: 'active' },
  provider: { type: String, default: 'google' },
  playlists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  requestsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  requestsSent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pushToken: String,
  anonSlug: { type: String, unique: true, sparse: true },
  timezone: { type: String, default: 'UTC' },
});

export default mongoose.model('User', userSchema);
