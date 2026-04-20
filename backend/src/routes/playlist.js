import express from 'express';
import Playlist from '../models/Playlist.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all playlists for user
router.get('/', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).populate('playlists');
  res.json(user.playlists);
});

// Create a new playlist
router.post('/', authenticateToken, async (req, res) => {
  const { name, tracks } = req.body;
  const playlist = await Playlist.create({ name, owner: req.user.id, tracks });
  await User.findByIdAndUpdate(req.user.id, { $push: { playlists: playlist._id } });
  res.status(201).json(playlist);
});

// Add track to playlist
router.post('/:id/tracks', authenticateToken, async (req, res) => {
  const { title, artist, url, source, duration } = req.body;
  const playlist = await Playlist.findByIdAndUpdate(
    req.params.id,
    { $push: { tracks: { title, artist, url, source, duration } } },
    { new: true }
  );
  res.json(playlist);
});

// Remove track from playlist
router.delete('/:id/tracks/:trackIndex', authenticateToken, async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.sendStatus(404);
  playlist.tracks.splice(req.params.trackIndex, 1);
  await playlist.save();
  res.json(playlist);
});

export default router;
