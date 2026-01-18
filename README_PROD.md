# Classa Enterprise - Production Hardening Guide

## Architecture Overview

Classa Enterprise operates as a hybrid platform with two distinct access layers:

1.  **Public Portal (Landing Page & Admissions)**
    *   **Technology:** React (Vite) + Framer Motion (Frontend), FastAPI (Backend).
    *   **Access:** Unauthenticated, public-facing.
    *   **Routes:** `/`, `/public/admissions/{school_uuid}`, `/api/chat/public`.
    *   **Security:** Rate-limited (20 requests/hour for chat, 5 requests/hour for admissions) per IP via `slowapi`.
    *   **Purpose:** Marketing, Lead Capture, and Student Enrollment.

2.  **Private Dashboard (School Management)**
    *   **Technology:** React (SPA), FastAPI, SQLAlchemy (SQLite/PostgreSQL).
    *   **Access:** Authenticated (JWT with Session Kill-Switch).
    *   **Routes:** `/dashboard/*`, `/api/students`, `/api/finance`, etc.
    *   **Security:** Role-Based Access Control (RBAC), Session Invalidation on Role Change.

## Deployment Notes

### Environment Variables
Ensure the following are set in production:
```bash
DATABASE_URL=postgresql://user:pass@db:5432/classa
SECRET_KEY=your-secure-secret-key
GEMINI_API_KEY=your-ai-api-key
VITE_BACKEND_URL=https://api.yourdomain.com
```

### Rate Limiting
The `slowapi` library uses an in-memory storage by default. For multi-worker production deployments (e.g., Gunicorn), configure a Redis backend for the limiter in `core/limiter.py`.

### Public Admissions Link
The Landing Page currently links to a demo school UUID:
`123e4567-e89b-12d3-a456-426614174000`

**Action Required:** In a real deployment, replace this UUID in `frontend/src/pages/LandingPage.jsx` with the actual UUID of the school receiving inquiries, or implement a dynamic routing mechanism.

## Lead Capture Workflow
1.  **Visitor** asks about "pricing" or "demo" in the AI Chat.
2.  **AI** detects keywords and suggests the Inquiry Form.
3.  **Visitor** clicks "Request Demo" or "Free Trial".
4.  **Redirect** to `/public/admissions/{uuid}`.
5.  **Submission** creates an `AdmissionApplication` in the database.
6.  **Staff** reviews the application in the Dashboard -> Admissions Workspace.

## Performance
*   Frontend assets are minified via Vite.
*   Backend utilizes `async` for non-blocking I/O where possible.
*   Heavy computations (Finance Velocity) use caching.
