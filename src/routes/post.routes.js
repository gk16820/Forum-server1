import express from 'express';
import { getPosts, getPostById, createPost, updatePost, deletePost, votePost, searchPosts, getTrendingTags, incrementViewCount } from '../controllers/post.controller.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuthenticateToken, getPosts);
router.post('/', authenticateToken, createPost);
router.get('/search', optionalAuthenticateToken, searchPosts);
router.get('/trending', getTrendingTags);
router.get('/:id', optionalAuthenticateToken, getPostById);
router.post('/:id/view', incrementViewCount);
router.put('/:id', authenticateToken, updatePost);
router.delete('/:id', authenticateToken, deletePost);
router.put('/:id/vote', authenticateToken, votePost);

// Note: search and trending should be before :id if they can clash, but standard practice is to use specific routes first.
// Currently /search and /trending are before /:id in my order, which is good.

export default router;
