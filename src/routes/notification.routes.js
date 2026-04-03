import express from 'express';
import { getNotifications, markNotificationAsRead } from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken); // All notification routes require auth

router.get('/', getNotifications);
router.put('/:id/read', markNotificationAsRead);

export default router;
