# Forum Server

REST API backend for the Forum application. Built with **Node.js + Express**, deployed on **Vercel**, and backed by **PostgreSQL (Supabase)** in production and **SQLite** locally.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express 4 |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` |
| Database (prod) | PostgreSQL via Supabase (`pg`) |
| Database (local) | SQLite (`sqlite` + `sqlite3`) |
| Config | `dotenv` + `.env.local` override |
| Deployment | Vercel (serverless) |

---

## Project Structure

```
server/
├── src/
│   ├── index.js          # Entry point — loads env, starts Express server
│   ├── app.js            # Express app setup, middleware, route mounting
│   ├── db.js             # DB abstraction (shared SQLite/PG interface)
│   ├── config/
│   │   └── db.js         # Database init, schema creation, PG adapter
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── post.routes.js
│   │   ├── comment.routes.js
│   │   ├── bookmark.routes.js
│   │   ├── community.routes.js
│   │   ├── notification.routes.js
│   │   └── user.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── post.controller.js
│   │   ├── comment.controller.js
│   │   ├── bookmark.controller.js
│   │   ├── community.controller.js
│   │   ├── notification.controller.js
│   │   └── user.controller.js
│   └── middleware/
│       └── auth.js       # JWT authentication middleware
├── .env                  # Production env vars (DATABASE_URL for Supabase)
├── .env.local            # Local overrides (SQLite, no DATABASE_URL)
├── forum.sqlite          # Local SQLite database file (gitignored)
└── package.json
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase). If absent, falls back to SQLite. |
| `JWT_SECRET` | Secret key used to sign and verify JWTs. |
| `PORT` | Port to listen on (defaults to `3000`). |

### Local Development (`.env.local`)

Create a `.env.local` file in the `server/` directory. This file overrides `.env` and is **not committed to git**.

```env
# Leave DATABASE_URL unset to use local SQLite
JWT_SECRET=your_local_secret
PORT=3000
```

### Production (`.env`)

```env
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<db>?sslmode=require&pgbouncer=true
JWT_SECRET=your_production_secret
```

---

## Database Abstraction

The server uses a **unified DB adapter** (`src/config/db.js`) that exposes a consistent `.all()` / `.get()` / `.run()` / `.exec()` interface regardless of the underlying database:

- **`DATABASE_URL` set** → connects to PostgreSQL (Supabase), applies PG schema
- **`DATABASE_URL` not set** → opens a local `forum.sqlite` file, applies SQLite schema

The adapter also handles SQL dialect differences automatically (e.g. `?` → `$1` placeholders, `LIKE` → `ILIKE`, `STRFTIME` → `EXTRACT(EPOCH ...)`).

---

## API Routes

All routes are prefixed with `/api`.

### Auth — `/api`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | ❌ | Register a new user |
| POST | `/login` | ❌ | Login and receive a JWT |

### Posts — `/api/posts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Optional | List all posts |
| POST | `/` | ✅ | Create a post |
| GET | `/search` | Optional | Search posts |
| GET | `/trending` | ❌ | Get trending tags |
| GET | `/:id` | Optional | Get a single post |
| POST | `/:id/view` | ❌ | Increment view count |
| PUT | `/:id` | ✅ | Edit a post |
| DELETE | `/:id` | ✅ | Delete a post |
| PUT | `/:id/vote` | ✅ | Upvote / downvote a post |

### Comments — `/api/posts/:id/comments`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ❌ | Get comments for a post |
| POST | `/` | ✅ | Add a comment |

### Bookmarks — `/api/bookmarks` *(all require auth)*
| Method | Path | Description |
|---|---|---|
| GET | `/` | Get user's bookmarks |
| GET | `/lists` | Get bookmark lists |
| POST | `/lists` | Create a bookmark list |
| PUT | `/lists` | Update a bookmark list |
| POST | `/:postId` | Bookmark a post |
| DELETE | `/:postId` | Remove a bookmark |

### Communities — `/api/communities`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Optional | List communities |
| POST | `/` | ✅ | Create a community |
| GET | `/:id` | Optional | Get a community |
| POST | `/:id/join` | ✅ | Join a community |

### Notifications — `/api/notifications` *(all require auth)*
| Method | Path | Description |
|---|---|---|
| GET | `/` | Get user's notifications |
| PUT | `/:id/read` | Mark a notification as read |

### Users — `/api/users`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/top` | ❌ | Get top users by points |
| PUT | `/profile` | ✅ | Update profile |
| GET | `/me/posts` | ✅ | Get my posts |
| GET | `/me/upvotes` | ✅ | Get my upvoted posts |
| GET | `/me/replies` | ✅ | Get my replies |
| GET | `/me/followers` | ✅ | Get my followers |
| GET | `/me/following` | ✅ | Get who I follow |
| GET | `/:id` | Optional | Get a user by ID |
| POST | `/:id/follow` | ✅ | Follow / unfollow a user |

### Diagnostics
| Method | Path | Description |
|---|---|---|
| GET | `/api/ping` | Health check — returns `pong` |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server (uses SQLite automatically when .env.local has no DATABASE_URL)
npm run dev
```

Server starts on `http://localhost:3000` by default.

---

## Database Schema

Tables created automatically on first startup:

- **`users`** — user accounts, profiles, points
- **`posts`** — forum posts with tags, domain, category, image
- **`comments`** — threaded comments on posts
- **`votes`** — upvote/downvote records
- **`followers`** — user follow relationships
- **`notifications`** — activity notifications
- **`bookmarks`** — saved posts with custom categories
- **`bookmark_lists`** — named bookmark collections
- **`communities`** — topic communities
- **`community_members`** — community membership records
