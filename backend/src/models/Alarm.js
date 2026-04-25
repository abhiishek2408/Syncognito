import mongoose from 'mongoose';

const alarmSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  triggerAt: { type: Date, required: true },
  message: { type: String, default: '' },
  title: { type: String, default: 'Alarm' },
  isTriggered: { type: Boolean, default: false },
  toneUrl: { type: String, default: null },
  duration: { type: Number, default: 30 }, // in seconds
  repetitionOn: { type: Boolean, default: false },
  repeatCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Index for efficient query of upcoming alarms
alarmSchema.index({ userId: 1, triggerAt: 1 });

export default mongoose.model('Alarm', alarmSchema);
