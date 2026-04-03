import { getDb } from '../config/db.js';
import { getPostWithMeta } from './post.controller.js';

export const getMyPosts = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT p.*, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar 
      FROM posts p JOIN users u ON p.userId = u.id 
      WHERE p.userId = ? ORDER BY p.createdAt DESC
    `, [req.user.id]);
    const posts = await Promise.all(rows.map(row => getPostWithMeta(row, req.user)));
    res.json(posts);
  } catch (e) { res.status(500).json({error: 'Failed'}); }
};

export const getMyUpvotes = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT p.*, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar 
      FROM posts p 
      JOIN users u ON p.userId = u.id 
      JOIN votes v ON p.id = v.postId
      WHERE v.userId = ? AND v.type = 'up'
      ORDER BY p.createdAt DESC
    `, [req.user.id]);
    const posts = await Promise.all(rows.map(row => getPostWithMeta(row, req.user)));
    res.json(posts);
  } catch (e) { res.status(500).json({error: 'Failed'}); }
};

export const getMyReplies = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT c.id as commentId, c.question as commentContent, c.createdAt as commentCreatedAt,
             p.id as postId, p.question as postQuestion, p.title as postTitle, /* p.tags as postTags, */ p.upvotes as postUpvotes, p.views as postViews, p.comments as postComments, p.createdAt as postCreatedAt,
             u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar
      FROM comments c
      JOIN posts p ON c.postId = p.id
      JOIN users u ON p.userId = u.id
      WHERE c.userId = ?
      ORDER BY c.createdAt DESC
    `, [req.user.id]);
    const replies = rows.map(r => ({
      id: r.commentId,
      content: r.commentContent,
      createdAt: r.commentCreatedAt,
      post: {
        id: r.postId, question: r.postQuestion,
        author: { id: r.authorId, name: r.authorName, avatar: r.authorAvatar }
      }
    }));
    res.json(replies);
  } catch (e) { res.status(500).json({error: 'Failed'}); }
};

export const getTopUsers = async (req, res) => {
  const db = getDb();
  try {
    const users = await db.all('SELECT id, username, description, points, avatar FROM users ORDER BY points DESC LIMIT 3');
    res.json(users);
  } catch (e) {
    res.json([]);
  }
};

export const getUserById = async (req, res) => {
  const db = getDb();
  try {
    const user = await db.get('SELECT id, username, description, avatar, points, location, interests, role, domain, userType, createdAt FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Not found' });
    
    const followers = await db.get('SELECT COUNT(*) as c FROM followers WHERE followingId = ?', [user.id]);
    const following = await db.get('SELECT COUNT(*) as c FROM followers WHERE followerId = ?', [user.id]);
    
    const postsCount = await db.get('SELECT COUNT(*) as c FROM posts WHERE userId = ?', [user.id]);
    const repliesCount = await db.get('SELECT COUNT(*) as c FROM comments WHERE userId = ?', [user.id]);

    let isFollowing = false;
    if (req.user) {
       const followRow = await db.get('SELECT 1 FROM followers WHERE followerId = ? AND followingId = ?', [req.user.id, user.id]);
       isFollowing = !!followRow;
    }
    
    res.json({ ...user, expectedFollowers: followers.c, expectedFollowing: following.c, isFollowing, postsCount: postsCount.c, repliesCount: repliesCount.c });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const followUser = async (req, res) => {
  const db = getDb();
  const followingId = req.params.id;
  const followerId = req.user.id;
  if (String(followingId) === String(followerId)) return res.status(400).json({ error: 'Cannot follow yourself' });

  try {
    const exists = await db.get('SELECT 1 FROM followers WHERE followerId = ? AND followingId = ?', [followerId, followingId]);
    if (exists) {
      await db.run('DELETE FROM followers WHERE followerId = ? AND followingId = ?', [followerId, followingId]);
      res.json({ following: false });
    } else {
      await db.run('INSERT INTO followers (followerId, followingId) VALUES (?, ?)', [followerId, followingId]);
      await db.run('INSERT INTO notifications (userId, actorId, type) VALUES (?, ?, ?)', [followingId, followerId, 'follow']);
      res.json({ following: true });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const updateProfile = async (req, res) => {
  const db = getDb();
  const { avatar, description, location, interests, role, domain } = req.body;
  try {
    await db.run(
      'UPDATE users SET avatar = ?, description = ?, location = ?, interests = ?, role = ?, domain = ? WHERE id = ?', 
      [avatar || '/Blank profile.png', description, location, interests, role, domain, req.user.id]
    );
    const user = await db.get('SELECT id, username, avatar, description, location, interests, role, domain, points, userType FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getMyFollowers = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT u.id, u.username, u.avatar, u.role, u.domain
      FROM followers f JOIN users u ON f.followerId = u.id
      WHERE f.followingId = ?
      ORDER BY f.createdAt DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getMyFollowing = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(`
      SELECT u.id, u.username, u.avatar, u.role, u.domain
      FROM followers f JOIN users u ON f.followingId = u.id
      WHERE f.followerId = ?
      ORDER BY f.createdAt DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};
