import { getDb } from '../config/db.js';

export const createCommunity = async (req, res) => {
  const db = getDb();
  if (req.user.userType !== 'guvi faculty') {
    return res.status(403).json({ error: 'Only GUVI faculty can create communities' });
  }
  const { name, description } = req.body;
  if (!name || !description) return res.status(400).json({ error: 'Name and description are required' });
  try {
    const result = await db.run('INSERT INTO communities (name, description, createdBy) VALUES (?, ?, ?)', [name, description, req.user.id]);
    await db.run('INSERT INTO community_members (userId, communityId) VALUES (?, ?)', [req.user.id, result.lastID]);
    res.status(201).json({ id: result.lastID, success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create community' });
  }
};

export const listCommunities = async (req, res) => {
  const db = getDb();
  try {
    const communities = await db.all('SELECT c.*, u.username as creatorName FROM communities c JOIN users u ON c.createdBy = u.id ORDER BY c.createdAt DESC');
    
    let memberCommunities = new Set();
    if (req.user) {
      const memberships = await db.all('SELECT communityId FROM community_members WHERE userId = ?', [req.user.id]);
      memberships.forEach(m => memberCommunities.add(m.communityId));
    }

    const results = communities.map(c => ({
      ...c,
      isMember: req.user ? memberCommunities.has(c.id) : false
    }));
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list communities' });
  }
};

export const joinCommunity = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    const exists = await db.get('SELECT 1 FROM community_members WHERE userId = ? AND communityId = ?', [req.user.id, id]);
    if (exists) {
      return res.status(400).json({ error: 'Already a member' });
    }
    await db.run('INSERT INTO community_members (userId, communityId) VALUES (?, ?)', [req.user.id, id]);
    res.json({ success: true, joined: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to join community' });
  }
};

export const getCommunity = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    const community = await db.get('SELECT c.*, u.username as creatorName FROM communities c JOIN users u ON c.createdBy = u.id WHERE c.id = ?', [id]);
    if (!community) return res.status(404).json({ error: 'Not found' });

    let isMember = false;
    if (req.user) {
      const membership = await db.get('SELECT 1 FROM community_members WHERE userId = ? AND communityId = ?', [req.user.id, id]);
      isMember = !!membership;
    }

    const memberCount = await db.get('SELECT COUNT(*) as count FROM community_members WHERE communityId = ?', [id]);
    res.json({ ...community, isMember, memberCount: memberCount.count });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get community' });
  }
};
