import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

export async function initDb() {
  const db = await open({
    filename: './forum.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Member',
      avatar TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      tags TEXT NOT NULL,
      upvotes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      parentId INTEGER,
      question TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES posts(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (parentId) REFERENCES comments(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      postId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (postId, userId),
      FOREIGN KEY (postId) REFERENCES posts(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS followers (
      followerId INTEGER NOT NULL,
      followingId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (followerId, followingId),
      FOREIGN KEY (followerId) REFERENCES users(id),
      FOREIGN KEY (followingId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      actorId INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'follow', 'comment'
      postId INTEGER,
      isRead INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (actorId) REFERENCES users(id),
      FOREIGN KEY (postId) REFERENCES posts(id)
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      postId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, postId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (postId) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS communities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      createdBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS community_members (
      userId INTEGER NOT NULL,
      communityId INTEGER NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, communityId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (communityId) REFERENCES communities(id)
    );
  `);

  try {
    await db.run('ALTER TABLE users ADD COLUMN description TEXT DEFAULT ""');
  } catch (err) {} 
  try {
    await db.run('ALTER TABLE users ADD COLUMN location TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE users ADD COLUMN interests TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE users ADD COLUMN domain TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts RENAME COLUMN content TO question');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE comments RENAME COLUMN content TO question');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE bookmarks ADD COLUMN category TEXT DEFAULT "General"');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts ADD COLUMN domain TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts ADD COLUMN image TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE users ADD COLUMN userType TEXT DEFAULT "commonuser"');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts ADD COLUMN communityId INTEGER DEFAULT NULL');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts ADD COLUMN category TEXT DEFAULT ""');
  } catch (err) {}
  try {
    await db.run('ALTER TABLE posts ADD COLUMN categories TEXT DEFAULT "[]"');
  } catch (err) {}
  try {
    await db.run('CREATE TABLE IF NOT EXISTS bookmark_lists (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, name TEXT, UNIQUE(userId, name))').catch(() => {});
  } catch (err) {}

  // Seed with an initial user if empty
  const userCount = await db.get('SELECT COUNT(*) as c FROM users');
  if (userCount.c === 0) {
    const defaultPassword = await bcrypt.hash('password123', 10);
    await db.run(
      'INSERT INTO users (username, email, password, role, avatar, points, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['admin', 'admin@gmail.com', defaultPassword, 'Admin', '/Blank profile.png', 1500, 'Chief Administrator of Forum.']
    );

    await db.run(
      'INSERT INTO posts (userId, title, question, tags, upvotes) VALUES (?, ?, ?, ?, ?)',
      [1, 'Welcome to Forum v2', 'This is the newly overhauled platform with proper authentication and real dynamic data. Let us know your thoughts.', JSON.stringify(['Announcement', 'Platform']), 10]
    );
  }

  return db;
}
