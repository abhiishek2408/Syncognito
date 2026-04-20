
import dotenv from 'dotenv';
dotenv.config();
import { OAuth2Client } from 'google-auth-library';

// Use only the server-side Google client ID — frontend client IDs belong in the frontend
const GOOGLE_CLIENT = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT) {
  console.warn('No server-side GOOGLE_CLIENT_ID found in environment. Google token verification will fail.');
}

const client = new OAuth2Client(GOOGLE_CLIENT);

export const verifyGoogleToken = async (token) => {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT,
  });
  return ticket.getPayload();
};
