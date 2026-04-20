import jwt from 'jsonwebtoken';
import { verifyGoogleToken } from '../utils/googleVerify.js';
import User from '../models/User.js';

export const googleLogin = async (req, res) => {
	try {
		console.log('POST /api/auth/google headers:', req.headers);
		console.log('POST /api/auth/google body:', req.body);

		// If body is empty, attempt to read raw request body as a fallback
		async function readRaw(req) {
			return new Promise((resolve) => {
				let data = '';
				req.setEncoding('utf8');
				req.on('data', chunk => data += chunk);
				req.on('end', () => resolve(data));
				req.on('error', () => resolve(''));
				// If no listeners (body already consumed), resolve quickly
				setTimeout(() => resolve(data), 10);
			});
		}
		// Accept common token names from various clients: `idToken`, `id_token`, `token`.
		// Also accept query param `idToken` or Bearer token in Authorization header.
		const body = req.body || {};
		const { idToken, id_token, token, timezone } = body;
		let incoming = idToken || id_token || token;

		// Also accept custom header `x-id-token` or `x-id_token`
		if (!incoming && req.headers) incoming = req.headers['x-id-token'] || req.headers['x-id_token'];

		// If still empty and body is empty object, try raw fallback parse
		if (!incoming && Object.keys(body).length === 0) {
			const raw = await readRaw(req);
			if (raw) {
				console.log('raw body fallback:', raw.substring(0, 200));
				// try JSON
				try {
					const parsed = JSON.parse(raw);
					incoming = parsed.idToken || parsed.id_token || parsed.token || incoming;
				} catch (e) {
					// try urlencoded
					const params = new URLSearchParams(raw);
					incoming = params.get('idToken') || params.get('id_token') || params.get('token') || incoming;
				}
			}
		}
		if (!incoming && req.query && (req.query.idToken || req.query.id_token)) {
			incoming = req.query.idToken || req.query.id_token;
		}
		if (!incoming && req.headers && req.headers.authorization) {
			const parts = req.headers.authorization.split(' ');
			if (parts.length === 2 && parts[0] === 'Bearer') incoming = parts[1];
		}
		if (!incoming) {
			console.warn('Missing idToken/token in request body');
			return res.status(400).json({ message: 'Missing idToken (send { idToken } in JSON body)' });
		}
		const payload = await verifyGoogleToken(incoming);
		console.log('Google ID token payload:', {
			sub: payload.sub,
			email: payload.email,
			name: payload.name,
			given_name: payload.given_name,
			family_name: payload.family_name,
		});
		const { email, name, picture, given_name, family_name } = payload;
		const displayName = name || [given_name, family_name].filter(Boolean).join(' ').trim() || email;

		let user = null;
		if (email) user = await User.findOne({ email });
		if (!user) {
			// Generate a unique slug based on name or email
			let baseSlug = (displayName || email?.split('@')[0] || 'user')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '')
				.substring(0, 15);
			
			if (baseSlug.length < 3) baseSlug += Math.floor(Math.random() * 1000);

			let finalSlug = baseSlug;
			let isUnique = false;
			let counter = 1;

			while (!isUnique) {
				const existing = await User.findOne({ anonSlug: finalSlug });
				if (!existing) {
					isUnique = true;
				} else {
					finalSlug = `${baseSlug}${counter}`;
					counter++;
				}
			}

			user = await User.create({
				name: displayName,
				email,
				avatar: picture,
				provider: 'google',
				timezone: timezone || 'UTC',
				anonSlug: finalSlug,
			});
		} else {
			// Update timezone and avatar if provided
			if (timezone) user.timezone = timezone;
			if (picture) user.avatar = picture;
			if (!user.name && displayName) user.name = displayName;
			// Ensure existing users also get a slug if they don't have one
			if (!user.anonSlug) {
				let baseSlug = (user.name || email?.split('@')[0] || 'user')
					.toLowerCase()
					.replace(/[^a-z0-9]/g, '')
					.substring(0, 15);
				let finalSlug = baseSlug;
				let counter = 1;
				while (await User.findOne({ anonSlug: finalSlug })) {
					finalSlug = `${baseSlug}${counter}`;
					counter++;
				}
				user.anonSlug = finalSlug;
			}
			await user.save();
		}

		const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
		console.log('Created local JWT for user:', user._id.toString());

		res.json({ token: jwtToken, user });
	} catch (error) {
		console.error('googleLogin error', error);
		res.status(401).json({ message: 'Google authentication failed' });
	}
};

// (Google login controller will be added here)

