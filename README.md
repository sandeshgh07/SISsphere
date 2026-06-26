# SISsphere

A multi-tenant Student Information System (SIS) for school administration, academics, billing, security, and parent-student engagement.

## Features

- **Multi-tenancy** — Each school gets isolated data with role-based access
- **10 User Roles** — Super Admin, School Admin, Principal, Academic Admin, Accountant, Teacher, Parent, Student, Board Member, Security Guard
- **Academic Management** — Grades, sections, timetables, grading, attendance
- **Financial Billing** — Fee templates, auto-invoicing, payment tracking, discounts
- **QR Gate Passes** — Parents generate QR codes, guards scan at pickup
- **AI Chatbot** — Public inquiry bot + authenticated parent portal assistant
- **Audit Trail** — Every database change is captured with before/after states
- **Platform Admin (God View)** — Global oversight across all tenant schools

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, SQLAlchemy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui |
| Auth | JWT with session kill-switch |
| AI | Google Gemini (optional) |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/SISsphere.git
cd SISsphere
```

### 2. Backend setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt  # or install manually — see below
```

Create your `.env` from the example:

```bash
cp .env.example .env
# Edit .env with your values (at minimum, set SUPERUSER_USERNAME and SUPERUSER_PASSWORD)
```

Start the backend:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app is now running at **http://localhost:5173**

### 4. First login

1. Go to `http://localhost:5173/admin/login`
2. Sign in with the `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` you set in `.env`
3. Create a new school from the Platform Admin dashboard — this creates a school and its Super Admin user
4. Log in to the school portal with the Super Admin credentials you just created

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPERUSER_USERNAME` | Yes | Platform owner email |
| `SUPERUSER_PASSWORD` | Yes | Platform owner password |
| `SECRET_KEY` | No | JWT secret (defaults to dev value) |
| `DATABASE_URL` | No | PostgreSQL connection string (defaults to SQLite) |
| `GEMINI_API_KEY` | No | Google Gemini API key for AI chatbot |
| `MAIL_USERNAME` | No | SMTP email for notifications |
| `MAIL_PASSWORD` | No | SMTP app password |

See `.env.example` for all available options.

## Project Structure

```
SISsphere/
├── main.py                 # FastAPI app entrypoint
├── config.py               # Environment-based settings
├── database.py             # SQLAlchemy engine & session
├── auth/                   # JWT auth, RBAC, login
├── schools/                # Multi-tenant school models
├── academics/              # Grades, sections, timetables
├── students/               # Student profiles, admissions
├── finance/                # Billing, invoicing, ledger
├── attendance/             # Class attendance, QR gate passes
├── communication/          # Notices, complaints
├── analytics/              # Dashboards per role
├── audit/                  # Database change auditing
├── ai/                     # Gemini chatbot integration
├── dashboard/              # Role-specific dashboard APIs
├── reports/                # Exportable reports
├── templates/              # Email & PDF templates
├── static/                 # Logos, receipts, uploads
├── frontend/               # React SPA
│   └── src/
│       ├── App.jsx         # Route definitions
│       ├── pages/          # Page components
│       └── components/     # Reusable UI components
└── scripts/                # Dev/ops helper scripts
```

## Roles & Access

| Role | Access Level |
|------|-------------|
| `superuser` | Platform-wide admin (God View across all schools) |
| `super_admin` | Highest tenant role — full school access |
| `school_admin` | School operations, finances, board analytics |
| `principal` | Academic oversight, approvals, user management |
| `academic_admin` | Class scheduling, grade books |
| `accountant` | Fee management, invoicing, ledger |
| `teacher` | Grading, attendance, lesson plans |
| `parent` | View child academics, pay fees, gate passes |
| `student` | View own schedule, results, attendance |
| `board` | Strategic analytics dashboard |
| `security_guard` | QR gate scanner app |

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.
