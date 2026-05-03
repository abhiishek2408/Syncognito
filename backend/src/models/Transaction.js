import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: String, required: true }, // 'plus', 'elite'
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  stripeSessionId: String,
  paymentIntentId: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Transaction', transactionSchema);
