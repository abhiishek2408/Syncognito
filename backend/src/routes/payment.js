import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_secret',
});

const PLANS = {
  plus: {
    id: 'plus',
    name: 'Syncognito Plus',
    price: 4.99,
    durationDays: 30,
    features: ['Ad-free experience', 'Reveal Sender Hints', 'Basic Analytics']
  },
  elite: {
    id: 'elite',
    name: 'Syncognito Elite',
    price: 9.99,
    durationDays: 30,
    features: ['All Plus features', 'Ghost AI Auto-Reply', 'Advanced Analytics', 'Animated Profile Glow']
  }
};

// Get available plans
router.get('/plans', (req, res) => {
  res.json(Object.values(PLANS));
});

// Create a mock payment session
router.post('/create-session', authenticateToken, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];

  if (!plan) return res.status(400).json({ message: 'Invalid plan' });

  try {
    const amountInPaise = Math.round(plan.price * 100); // Razorpay expects amount in paise

    const options = {
      amount: amountInPaise,
      currency: 'INR', // Razorpay works best with INR
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    const transaction = new Transaction({
      userId: req.user.id,
      planId,
      amount: plan.price,
      currency: 'INR',
      status: 'pending',
      stripeSessionId: order.id, // Using this field for Order ID
    });
    await transaction.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_id',
      message: 'Razorpay order created'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify Razorpay Signature
router.post('/verify-signature', authenticateToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_secret')
    .update(sign.toString())
    .digest("hex");

  if (razorpay_signature === expectedSign) {
    try {
      const transaction = await Transaction.findOne({ stripeSessionId: razorpay_order_id });
      if (transaction) {
        transaction.status = 'completed';
        transaction.paymentIntentId = razorpay_payment_id;
        await transaction.save();
      }

      // Update User Premium Status
      const plan = PLANS[planId];
      const user = await User.findById(req.user.id);
      
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (plan?.durationDays || 30));

      user.isPremium = true;
      user.premiumUntil = expiry;
      await user.save();

      return res.json({ success: true, message: "Payment verified successfully!" });
    } catch (err) {
      return res.status(500).json({ message: "Error updating subscription" });
    }
  } else {
    return res.status(400).json({ message: "Invalid signature" });
  }
});

export default router;
