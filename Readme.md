# Family Health & Medication Manager

A full-stack production-ready application for managing family patients, medications, and reminders securely. Built with modern tooling including Next.js, FastAPI, and Supabase.

---

## Architecture Overview
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, JWT Auth)
- **Backend:** FastAPI (Python, async Pydantic models)
- **Frontend:** Next.js 14 (App Router, TailwindCSS, `@supabase/ssr`)
- **Security Concept:** Frontend retrieves a Supabase JWT and passes it to FastAPI as a Bearer token. FastAPI verifies this token mathematically, then interacts with Supabase securely using the Service Role Key.

---

## Initial Setup Instructions

### 1. Supabase Setup
1. Create a new project on [Supabase.com](https://supabase.com/).
2. Go to **SQL Editor** and paste the contents of `supabase/schema.sql`. Run the script to create tables and RLS policies.
3. Go to **Project Settings -> API** and copy your credentials.

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `backend/.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # KEEP THIS SECRET!
SUPABASE_JWT_SECRET=your_jwt_secret               # Under Settings -> API -> JWT Settings
FRONTEND_ORIGIN=http://localhost:3000
```

Start the backend:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `frontend/.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:
```bash
npm run dev
```

Visit `http://localhost:3000` to register, log in, and manage your family health profiles!

---

## Deployment (Production Guide)

### Frontend (Vercel recommended)
1. Push your repository to GitHub.
2. Import the `frontend/` directory as a new project in Vercel.
3. Add the `NEXT_PUBLIC_*` variables in Vercel's Environment Variables settings.
4. Deploy! Next.js will build perfectly.

### Backend (Render recommended)
1. In Render, create a new "Web Service".
2. Point it to your GitHub repository and set the Root Directory to `backend/`.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add your `SUPABASE_*` credentials as Environment variables in Render.
6. Set `FRONTEND_ORIGIN` to your newly deployed Vercel URL.
