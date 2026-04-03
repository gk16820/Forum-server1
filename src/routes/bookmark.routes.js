import express from 'express';
import { getBookmarks, createBookmark, deleteBookmark, getBookmarkLists, createBookmarkList, updateBookmarkList } from '../controllers/bookmark.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken); // All bookmark routes require auth

router.get('/', getBookmarks);
router.get('/lists', getBookmarkLists);
router.post('/lists', createBookmarkList);
router.put('/lists', updateBookmarkList);
router.post('/:postId', createBookmark);
router.delete('/:postId', deleteBookmark);

export default router;
