import express from 'express';
import cors from 'cors';
import { initDb } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';
import bookmarkRoutes from './routes/bookmark.routes.js';
import communityRoutes from './routes/community.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers and platforms (Vercel) handle 200 better for preflights
}));

// Ensure DB is initialized for serverless environments (Vercel)
app.use(async (req, res, next) => {
  if (req.path === '/api/ping') return next();
  try {
    await initDb();
    next();
  } catch (err) {
    console.error('Database initialization failed:', err);
    res.status(500).json({ error: 'Database failed to initialize' });
  }
});

app.use(express.json());

// Diagnostics
app.get('/api/ping', (req, res) => res.send('pong'));

// Ensure DB is initialized for serverless environments (Vercel)
app.use('/api', authRoutes);
app.use('/api/posts/:id/comments', commentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

export default app;
