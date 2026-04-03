import { getDb } from '../config/db.js';

export const getPosts = async (req, res) => {
  const db = getDb();
  try {
    const { sort, communityId } = req.query;
    const orderClause = sort === 'popular' 
      ? "ORDER BY ((p.upvotes * 10) + p.views + (p.comments * 5)) / CAST(((STRFTIME('%s', 'now') - STRFTIME('%s', p.createdAt)) / 3600.0) + 2.0 AS REAL) DESC" 
      : "ORDER BY p.createdAt DESC";

    let whereClause = communityId ? 'WHERE p.communityId = ?' : 'WHERE p.communityId IS NULL';
    let params = communityId ? [communityId] : [];
    
    if (!communityId && req.user) {
      whereClause = 'WHERE p.communityId IS NULL OR p.communityId IN (SELECT communityId FROM community_members WHERE userId = ?)';
      params = [req.user.id];
    }

    const rows = await db.all(`
      SELECT p.*, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar 
      FROM posts p
      JOIN users u ON p.userId = u.id
      ${whereClause}
      ${orderClause}
    `, params);
    
    let userVotes = {};
    let userBookmarks = new Set();
    if (req.user) {
      const vRows = await db.all('SELECT postId, type FROM votes WHERE userId = ?', [req.user.id]);
      vRows.forEach(v => userVotes[v.postId] = v.type);
      const bRows = await db.all('SELECT postId FROM bookmarks WHERE userId = ?', [req.user.id]);
      bRows.forEach(b => userBookmarks.add(b.postId));
    }
    
    const posts = rows.map(row => ({
      id: row.id,
      author: {
        id: row.authorId,
        name: row.authorName,
        description: row.authorDescription,
        avatar: row.authorAvatar
      },
      createdAt: row.createdAt,
      timeAgo: row.createdAt,
      title: row.title,
      question: row.question,
      // tags: JSON.parse(row.tags),
      upvotes: row.upvotes,
      views: row.views || 0,
      comments: row.comments,
      domain: (() => {
        try {
          if (!row.domain) return [];
          const d = row.domain.startsWith('[') ? JSON.parse(row.domain) : [row.domain];
          return Array.isArray(d) ? d.filter(v => typeof v === 'string') : [];
        } catch(e) { return row.domain ? [String(row.domain)] : []; }
      })(),
      image: row.image || '',
      category: row.category || (() => {
        try {
          const cats = JSON.parse(row.categories || '[]');
          return Array.isArray(cats) ? cats[0] || '' : '';
        } catch(e) { return ''; }
      })(),
      userVote: req.user ? (userVotes[row.id] || null) : null,
      isBookmarked: req.user ? userBookmarks.has(row.id) : false
    }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

export const getPostById = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;

    const row = await db.get(`
      SELECT p.*, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar 
      FROM posts p
      JOIN users u ON p.userId = u.id
      WHERE p.id = ?
    `, [id]);
    
    if (!row) return res.status(404).json({ error: 'Post not found' });

    let userVote = null;
    let isBookmarked = false;
    if (req.user) {
      const vote = await db.get('SELECT type FROM votes WHERE userId = ? AND postId = ?', [req.user.id, id]);
      if (vote) userVote = vote.type;
      const mark = await db.get('SELECT 1 FROM bookmarks WHERE userId = ? AND postId = ?', [req.user.id, id]);
      if (mark) isBookmarked = true;
    }

    res.json({
      id: row.id,
      author: {
        id: row.authorId,
        name: row.authorName,
        description: row.authorDescription,
        avatar: row.authorAvatar
      },
      createdAt: row.createdAt,
      timeAgo: row.createdAt,
      title: row.title,
      question: row.question,
      // tags: JSON.parse(row.tags),
      upvotes: row.upvotes,
      views: row.views || 0,
      comments: row.comments,
      domain: (() => {
        try {
          if (!row.domain) return [];
          const d = row.domain.startsWith('[') ? JSON.parse(row.domain) : [row.domain];
          return Array.isArray(d) ? d.filter(v => typeof v === 'string') : [];
        } catch(e) { return row.domain ? [String(row.domain)] : []; }
      })(),
      image: row.image || '',
      category: row.category || (() => {
        try {
          const cats = JSON.parse(row.categories || '[]');
          return Array.isArray(cats) ? cats[0] || '' : '';
        } catch(e) { return ''; }
      })(),
      userVote,
      isBookmarked
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const incrementViewCount = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    await db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to increment view count' });
  }
};

export const createPost = async (req, res) => {
  const db = getDb();
  try {
    const { title, question, /* tags, */ domain, image, communityId, category } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (communityId) {
      const isFaculty = await db.get('SELECT 1 FROM users WHERE id = ? AND (role = ? OR userType = ?)', [req.user.id, 'faculty', 'guvi faculty']);
      if (!isFaculty) {
        return res.status(403).json({ error: 'Only GUVI faculty can post in a community' });
      }
    }

    const result = await db.run(
      'INSERT INTO posts (userId, title, question, tags, domain, image, communityId, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, title || 'Question', question, JSON.stringify([]), JSON.stringify(domain || []), image || '', communityId || null, category || '']
    );
    
    // Award user points for posting
    await db.run('UPDATE users SET points = points + 5 WHERE id = ?', [req.user.id]);
    
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

export const deletePost = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    const post = await db.get('SELECT userId FROM posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    if (post.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await db.run('DELETE FROM posts WHERE id = ?', [id]);
    await db.run('DELETE FROM comments WHERE postId = ?', [id]);
    await db.run('DELETE FROM votes WHERE postId = ?', [id]);
    await db.run('DELETE FROM bookmarks WHERE postId = ?', [id]);
    
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
};

export const updatePost = async (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    const { question, /* tags, */ domain, image } = req.body;
    const post = await db.get('SELECT userId FROM posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    let updateFields = [];
    let params = [];
    if (question !== undefined) { updateFields.push('question = ?'); params.push(question); }
    // if (tags !== undefined) { updateFields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (domain !== undefined) { updateFields.push('domain = ?'); params.push(JSON.stringify(domain)); }
    if (image !== undefined) { updateFields.push('image = ?'); params.push(image); }
    if (req.body.category !== undefined) { updateFields.push('category = ?'); params.push(req.body.category); }
    
    if (updateFields.length > 0) {
      params.push(id);
      const postMeta = await db.get('SELECT communityId FROM posts WHERE id = ?', [id]);
      if (postMeta?.communityId && req.user.userType !== 'guvi faculty') {
        return res.status(403).json({ error: 'Only GUVI faculty can edit community posts' });
      }
      await db.run(`UPDATE posts SET ${updateFields.join(', ')} WHERE id = ?`, params);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
};


export const votePost = async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { type } = req.body;
  try {
    const post = await db.get('SELECT upvotes, userId FROM posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ error: 'Not found' });

    const existingVote = await db.get('SELECT type FROM votes WHERE postId = ? AND userId = ?', [id, req.user.id]);
    
    let newUpvotes = post.upvotes;
    let diff = 0;

    if (existingVote) {
       if (existingVote.type === type) {
           await db.run('DELETE FROM votes WHERE postId = ? AND userId = ?', [id, req.user.id]);
           diff = type === 'up' ? -1 : 1;
       } else {
           await db.run('UPDATE votes SET type = ? WHERE postId = ? AND userId = ?', [type, id, req.user.id]);
           diff = type === 'up' ? 2 : -2;
       }
    } else {
       await db.run('INSERT INTO votes (postId, userId, type) VALUES (?, ?, ?)', [id, req.user.id, type]);
       diff = type === 'up' ? 1 : -1;
    }
    
    newUpvotes += diff;
    await db.run('UPDATE posts SET upvotes = ? WHERE id = ?', [newUpvotes, id]);
    
    if (diff !== 0) {
       await db.run('UPDATE users SET points = points + ? WHERE id = ?', [diff, post.userId]);
    }
    
    res.json({ success: true, upvotes: newUpvotes, userVote: diff === 0 ? existingVote.type : (existingVote?.type === type ? null : type) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote' });
  }
};

export const searchPosts = async (req, res) => {
  const db = getDb();
  try {
    const q = (req.query.q || '').toString().trim();
    const domain = (req.query.domain || '').toString().trim();
    const status = (req.query.status || '').toString().trim();
    const searchType = (req.query.type || 'posts').toString().trim();

    if (q.startsWith('@') || searchType === 'users') {
      const username = q.startsWith('@') ? q.slice(1) : q;
      let users;
      if (username) {
        users = await db.all('SELECT id, username, description, role, domain, points, avatar FROM users WHERE username LIKE ? COLLATE NOCASE LIMIT 20', [`%${username}%`]);
      } else {
        users = await db.all('SELECT id, username, description, role, domain, points, avatar FROM users LIMIT 50');
      }
      if (domain) users = users.filter((u) => u.domain === domain);
      return res.json({ type: 'users', results: users });
    } else if (!q && !domain && !status) {
      return res.json({ type: 'empty', results: [] });
    } else {
      const isTag = q.startsWith('#');
      const searchTerm = isTag ? q.slice(1) : q;
      
      let queryStr = `
        SELECT p.*, u.id as authorId, u.username as authorName, u.description as authorDescription, u.avatar as authorAvatar 
        FROM posts p
        JOIN users u ON p.userId = u.id
        WHERE 1=1
      `;
      let queryParams = [];

      if (isTag) {
         queryStr += ` AND p.domain LIKE ? COLLATE NOCASE`;
         queryParams.push(`%${searchTerm}%`);
      } else if (searchTerm) {
         queryStr += ` AND (p.title LIKE ? COLLATE NOCASE OR p.question LIKE ? COLLATE NOCASE)`;
         queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      if (domain) {
        try {
          const domainList = JSON.parse(domain);
          if (domainList.length > 0) {
            queryStr += ` AND (${domainList.map(() => `p.domain LIKE ? COLLATE NOCASE`).join(' OR ')})`;
            queryParams.push(...domainList.map(d => `%${d}%`));
          }
        } catch(e) {
          queryStr += ` AND p.domain LIKE ? COLLATE NOCASE`;
          queryParams.push(`%${domain}%`);
        }
      }
      if (status === 'answered') {
         queryStr += ` AND p.comments > 0`;
      } else if (status === 'unanswered') {
         queryStr += ` AND p.comments = 0`;
      }

      queryStr += ` ORDER BY p.createdAt DESC LIMIT 20`;

      const rows = await db.all(queryStr, queryParams);

      let userVotes = {};
      if (req.user) {
        const vRows = await db.all('SELECT postId, type FROM votes WHERE userId = ?', [req.user.id]);
        vRows.forEach(v => userVotes[v.postId] = v.type);
      }

      const posts = rows.map(row => ({
        id: row.id,
        author: {
          id: row.authorId,
          name: row.authorName,
          description: row.authorDescription,
          avatar: row.authorAvatar
        },
        createdAt: row.createdAt,
        title: row.title,
        question: row.question,
        domain: (() => {
          try {
            if (!row.domain) return [];
            const d = row.domain.startsWith('[') ? JSON.parse(row.domain) : [row.domain];
            return Array.isArray(d) ? d.filter(v => typeof v === 'string') : [];
          } catch(e) { return row.domain ? [String(row.domain)] : []; }
        })(),
        category: row.category || (() => {
          try {
            const cats = JSON.parse(row.categories || '[]');
            return Array.isArray(cats) ? cats[0] || '' : '';
          } catch(e) { return ''; }
        })(),
        image: row.image || '',
        // tags: JSON.parse(row.tags || '[]'),
        upvotes: row.upvotes,
        views: row.views || 0,
        comments: row.comments,
        userVote: req.user ? (userVotes[row.id] || null) : null
      }));

      return res.json({ type: 'posts', queryType: isTag ? 'tag' : 'text', results: posts });
    }
  } catch (e) {
    res.status(500).json({ error: 'Search failed' });
  }
};

export const getTrendingTags = async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all('SELECT domain FROM posts LIMIT 100');
    const tagCounts = {};
    rows.forEach(r => {
      try {
        let domains = [];
        if (r.domain) {
           domains = r.domain.startsWith('[') ? JSON.parse(r.domain) : [r.domain];
           if (!Array.isArray(domains)) domains = [];
        }
        domains.filter(v => typeof v === 'string').forEach((tag) => {
          const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
      } catch(e) {}
    });
    
    const trending = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
      
    res.json(trending);
  } catch (e) {
    res.json([]);
  }
};

export const getPostWithMeta = async (postRow, user) => {
  const db = getDb();
  let userVote = null;
  let isBookmarked = false;
  if (user) {
    const vote = await db.get('SELECT type FROM votes WHERE userId = ? AND postId = ?', [user.id, postRow.id]);
    if (vote) userVote = vote.type;
    const mark = await db.get('SELECT 1 FROM bookmarks WHERE userId = ? AND postId = ?', [user.id, postRow.id]);
    if (mark) isBookmarked = true;
  }
  return {
    id: postRow.id,
    author: {
      id: postRow.authorId,
      name: postRow.authorName,
      description: postRow.authorDescription,
      avatar: postRow.authorAvatar
    },
    createdAt: postRow.createdAt,
    timeAgo: postRow.createdAt,
    title: postRow.title,
    question: postRow.question,
    // tags: JSON.parse(postRow.tags),
    upvotes: postRow.upvotes,
    views: postRow.views || 0,
    comments: postRow.comments,
    userVote,
    isBookmarked
  };
};
