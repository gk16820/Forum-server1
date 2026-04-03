import express from 'express';
import { getPostComments, createComment } from '../controllers/comment.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.get('/', getPostComments);
router.post('/', authenticateToken, createComment);

export default router;
