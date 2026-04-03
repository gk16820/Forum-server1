import express from 'express';
import { getMyPosts, getMyUpvotes, getMyReplies, getTopUsers, getUserById, followUser, updateProfile, getMyFollowers, getMyFollowing } from '../controllers/user.controller.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/top', getTopUsers);
router.put('/profile', authenticateToken, updateProfile);
router.get('/me/posts', authenticateToken, getMyPosts);
router.get('/me/upvotes', authenticateToken, getMyUpvotes);
router.get('/me/replies', authenticateToken, getMyReplies);
router.get('/me/followers', authenticateToken, getMyFollowers);
router.get('/me/following', authenticateToken, getMyFollowing);
router.get('/:id', optionalAuthenticateToken, getUserById);
router.post('/:id/follow', authenticateToken, followUser);

export default router;
