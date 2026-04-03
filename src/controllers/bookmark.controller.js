import { getDb } from '../config/db.js';

export const getBookmarks = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT p.*, b.category as bookmarkCategory, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar
      FROM bookmarks b
      JOIN posts p ON b.postId = p.id
      JOIN users u ON p.userId = u.id
      WHERE b.userId = ?
      ORDER BY b.createdAt DESC
    `, [req.user.id]);
    const posts = rows.map(row => ({
      id: row.id,
      author: { id: row.authorId, name: row.authorName, description: row.authorDescription, avatar: row.authorAvatar },
      createdAt: row.createdAt,
      title: row.title,
      question: row.question,
      // tags: JSON.parse(row.tags || '[]'),
      category: row.category || (() => {
        try {
          const cats = JSON.parse(row.categories || '[]');
          return Array.isArray(cats) ? cats[0] || '' : '';
        } catch(e) { return ''; }
      })(),
      domain: (() => {
        try {
          if (!row.domain) return [];
          const d = row.domain.startsWith('[') ? JSON.parse(row.domain) : [row.domain];
          return Array.isArray(d) ? d.filter(v => typeof v === 'string') : [];
        } catch(e) { return row.domain ? [String(row.domain)] : []; }
      })(),
      upvotes: row.upvotes,
      views: row.views || 0,
      comments: row.comments,
      image: row.image || '',
      bookmarkCategory: row.bookmarkCategory || 'General',
      userVote: null,
      isBookmarked: true
    }));
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const createBookmark = async (req, res) => {
  const db = getDb();
  try {
    const category = req.body?.category || 'General';
    const exists = await db.get('SELECT 1 FROM bookmarks WHERE userId = ? AND postId = ?', [req.user.id, req.params.postId]);
    if (exists) {
      await db.run('UPDATE bookmarks SET category = ? WHERE userId = ? AND postId = ?', [category, req.user.id, req.params.postId]);
    } else {
      await db.run('INSERT INTO bookmarks (userId, postId, category) VALUES (?, ?, ?)', [req.user.id, req.params.postId, category]);
    }
    res.json({ bookmarked: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const deleteBookmark = async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM bookmarks WHERE userId = ? AND postId = ?', [req.user.id, req.params.postId]);
    res.json({ bookmarked: false });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getBookmarkLists = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all('SELECT DISTINCT category FROM bookmarks WHERE userId = ?', [req.user.id]);
    const customLists = await db.all('SELECT name FROM bookmark_lists WHERE userId = ?', [req.user.id]);
    
    const allLists = new Set(['General']);
    rows.forEach(r => { if (r.category) allLists.add(r.category); });
    customLists.forEach(l => allLists.add(l.name));
    
    res.json(Array.from(allLists));
  } catch (e) {
    res.json(['General']);
  }
};

export const createBookmarkList = async (req, res) => {
  const db = getDb();
  const { name } = req.body;
  try {
    await db.run('INSERT INTO bookmark_lists (userId, name) VALUES (?, ?)', [req.user.id, name]);
    res.json({ success: true, name });
  } catch (e) {
    res.status(500).json({ error: 'Failed or already exists' });
  }
};

export const updateBookmarkList = async (req, res) => {
  const db = getDb();
  const { oldName, newName } = req.body;
  try {
    await db.run('UPDATE bookmark_lists SET name = ? WHERE userId = ? AND name = ?', [newName, req.user.id, oldName]);
    await db.run('UPDATE bookmarks SET category = ? WHERE userId = ? AND category = ?', [newName, req.user.id, oldName]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};
