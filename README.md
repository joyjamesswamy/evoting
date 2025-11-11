# TICKET COUNTING SYSTEM

Full‑stack app with Node.js + Express + MongoDB (Mongoose) and React (Vite).

## Structure
- `/server` — Express API (auth, polls, votes)
- `/client` — React UI (login/register, create poll, vote, view results)

## Quick Start (Local)
1. Start MongoDB (local) or get a MongoDB Atlas connection string.
2. Server:
   ```bash
   cd server
   cp .env.example .env
   # Edit .env: set MONGO_URI, JWT_SECRET, CORS_ORIGIN
   npm install
   npm run dev
   ```
3. Client:
   ```bash
   cd ../client
   cp .env.example .env
   # ensure VITE_API_BASE_URL points to your server base URL
   npm install
   npm run dev
   ```

## API
- `POST /api/auth/register` — { name, email, password }
- `POST /api/auth/login` — returns { token, user }
- `POST /api/polls` — create (auth)
- `GET /api/polls?status=active` — list
- `POST /api/polls/:id/vote` — vote (auth)
- `GET /api/polls/:id/results` — counts
