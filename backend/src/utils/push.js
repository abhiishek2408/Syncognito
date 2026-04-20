import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../../config/serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[Push] Firebase Admin initialized');
} else {
  console.warn('[Push] serviceAccountKey.json not found. Remote push notifications disabled.');
}

/**
 * Send a push notification to specific FCM tokens
 * @param {string|string[]} tokens - Target FCM token(s)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 */
export const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!admin.apps.length) return;

  const message = {
    notification: { title, body },
    data: data,
  };

  try {
    if (Array.isArray(tokens)) {
      if (tokens.length === 0) return;
      const response = await admin.messaging().sendEachForMulticast({ ...message, tokens });
      console.log(`[Push] Successfully sent ${response.successCount} messages`);
    } else {
      if (!tokens) return;
      const response = await admin.messaging().send({ ...message, token: tokens });
      console.log('[Push] Successfully sent message:', response);
    }
  } catch (error) {
    console.error('[Push] Error sending push notification:', error);
  }
};
