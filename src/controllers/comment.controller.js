import { getDb } from '../config/db.js';

export const getPostComments = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    const rows = await db.all(`
      SELECT c.*, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar 
      FROM comments c
      JOIN users u ON c.userId = u.id
      WHERE c.postId = ?
      ORDER BY c.createdAt ASC
    `, [id]);
    
    const comments = rows.map(row => ({
      id: row.id,
      parentId: row.parentId,
      question: row.question,
      createdAt: row.createdAt,
      author: {
        id: row.authorId,
        name: row.authorName,
        description: row.authorDescription,
        avatar: row.authorAvatar
      }
    }));
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export const createComment = async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { question, parentId } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO comments (postId, userId, parentId, question) VALUES (?, ?, ?, ?)',
      [id, req.user.id, parentId || null, question]
    );
    
    await db.run('UPDATE posts SET comments = comments + 1 WHERE id = ?', [id]);
    await db.run('UPDATE users SET points = points + 1 WHERE id = ?', [req.user.id]);
    
    // Create notification for post owner
    const post = await db.get('SELECT userId FROM posts WHERE id = ?', [id]);
    if (post && post.userId !== req.user.id) {
       await db.run(
         'INSERT INTO notifications (userId, actorId, type, postId) VALUES (?, ?, ?, ?)',
         [post.userId, req.user.id, 'comment', id]
       );
    }

    // Mentions
    const mentions = question.match(/@(\w+)/g) || [];
    const tagSeen = new Set();
    for (const m of mentions) {
      const username = m.substring(1);
      if (tagSeen.has(username.toLowerCase())) continue;
      tagSeen.add(username.toLowerCase());
      
      const taggedUser = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [username]);
      if (taggedUser && taggedUser.id !== req.user.id && (!post || taggedUser.id !== post.userId)) {
         await db.run(
           'INSERT INTO notifications (userId, actorId, type, postId) VALUES (?, ?, ?, ?)',
           [taggedUser.id, req.user.id, 'mention', id]
         );
      }
    }

    res.status(201).json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Failed to comment' });
  }
};
