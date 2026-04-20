import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
  name: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tracks: [
    {
      title: String,
      artist: String,
      url: String,
      source: String, // 'spotify', 'youtube', 'free'
      duration: Number
    }
  ]
});

export default mongoose.model('Playlist', playlistSchema);
