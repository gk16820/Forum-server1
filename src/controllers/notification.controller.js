import { getDb } from '../config/db.js';

export const getNotifications = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT n.*, u.username as actorName, u.avatar as actorAvatar, p.title as postTitle
      FROM notifications n
      JOIN users u ON n.actorId = u.id
      LEFT JOIN posts p ON n.postId = p.id
      WHERE n.userId = ?
      ORDER BY n.createdAt DESC LIMIT 50
    `, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const markNotificationAsRead = async (req, res) => {
  const db = getDb();
  try {
    await db.run('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};
