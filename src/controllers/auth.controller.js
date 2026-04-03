import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';

const JWT_SECRET = 'super-secret-key-for-edutech';

export const register = async (req, res) => {
  const db = getDb();
  const { username, email, password, role, domain, userType } = req.body;
  if (!username || !email || !password || !role || !domain) {
    return res.status(400).json({ error: 'All fields including role and domain are required' });
  }
  const finalUserType = userType === 'guvi faculty' ? 'guvi faculty' : 'commonuser';
  try {
    const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already taken' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = '/Blank profile.png';
    const result = await db.run(
      'INSERT INTO users (username, email, password, avatar, role, domain, userType) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, avatar, role, domain, finalUserType]
    );
    
    const token = jwt.sign({ id: result.lastID, username, role, domain, avatar, userType: finalUserType }, JWT_SECRET);
    res.status(201).json({ token, user: { id: result.lastID, username, avatar, role, domain, userType: finalUserType } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (req, res) => {
  const db = getDb();
  const { email, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, domain: user.domain, description: user.description, avatar: user.avatar, userType: user.userType }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar, role: user.role, domain: user.domain, description: user.description, userType: user.userType } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
