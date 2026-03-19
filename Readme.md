# Family Health & Medication Manager

A full-stack production-ready application for managing family patients, medications, and reminders securely. Built with modern tooling including Next.js, FastAPI, and MySQL.

---

## Architecture Overview
- **Database:** MySQL
- **Backend:** FastAPI (Python, async Pydantic models, SQLAlchemy ORM, Alembic Migrations)
- **Frontend:** Next.js 14 (App Router, TailwindCSS)
- **Security Concept:** Frontend retrieves a JWT using FastAPI's custom authentication and passes it to FastAPI as a Bearer token.

---

## Initial Setup Instructions

### 1. Database Setup
1. Install and start a local MySQL server.
2. Create an empty database named `miniproj`.

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
MYSQL_DATABASE_URL=mysql+pymysql://root:@localhost:3306/miniproj
JWT_SECRET_KEY=supersecretkey12345
FRONTEND_ORIGIN=http://localhost:3000
```

Run database migrations:
```bash
alembic upgrade head
```

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `frontend/.env.local` file:
```
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
5. Add your database credentials as Environment variables in Render.
6. Set `FRONTEND_ORIGIN` to your newly deployed Vercel URL.
