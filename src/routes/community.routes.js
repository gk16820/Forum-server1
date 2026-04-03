import express from 'express';
import { createCommunity, listCommunities, joinCommunity, getCommunity } from '../controllers/community.controller.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuthenticateToken, listCommunities);
router.post('/', authenticateToken, createCommunity);
router.get('/:id', optionalAuthenticateToken, getCommunity);
router.post('/:id/join', authenticateToken, joinCommunity);

export default router;
