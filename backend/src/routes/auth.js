import express from 'express';
const router = express.Router();


import { googleLogin } from '../controllers/authController.js';

router.post('/google', googleLogin);

export default router;
