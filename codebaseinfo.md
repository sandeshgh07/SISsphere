# SISsphere - Codebase Reference Guide

This document serves as a centralized developer guide and architectural map of the **SISsphere** Student Information System. Reviewing this document avoids the need to audit the entire codebase repeatedly.

---

## 1. System Overview & Tech Stack

**SISsphere** is a multi-tenant Student Information System designed specifically for school administration, academic setups, billing automation, security, and Parent-Student engagement.

*   **Backend Framework:** FastAPI (Python 3.10+)
*   **Database ORM:** SQLAlchemy with support for:
    *   **SQLite** (Development/Local: `dev.db` / `sissphere.db`)
    *   **PostgreSQL** (Production via `DATABASE_URL`)
*   **Frontend Web App:** React (Vite SPA) + Tailwind CSS + shadcn/ui components
*   **AI Engine:** Google Gemini (`gemini-1.5-flash`) Integration
*   **Email Deliverability:** SMTP integration (Gmail SMTP by default)
*   **Rate Limiting:** `slowapi` (utilizing in-memory tracking or Redis in multi-worker environments)

---

## 2. Directory Structure

```
SISsphere/
├── main.py                     # Backend entrypoint (registers routes & startup tasks)
├── database.py                 # SQLite/PostgreSQL connection & DB listener hookups
├── config.py                   # Pydantic Settings configuration from environment variables
├── logging_config.py           # Application-wide structured logging
├── apply_migration.py          # Metadata-driven database tables initializer
├── auth/                       # Authentication, JWT, and session management
├── schools/                    # School tenants and SaaS subscription layers
├── academics/                  # Grades, subjects, timetables, and grading rules
├── students/                   # Student profiles, 360-views, and admissions
├── finance/                    # Fee templates, billing runs, ledger, and discounts
├── attendance/                 # Class attendance and QR Gate passes
├── ai/                         # Gemini chatbots (public inquiry & parent portal helpers)
├── communication/              # Notices and complaints tracking
├── audit/                      # Database change auditing (before/after states delta)
├── reports/                    # Exportable academic & financial reports
├── analytics/                  # Scoped widgets for parents, principals, and board executives
├── dashboard/                  # Router endpoints for dashboards
├── static/                     # Assets: logos, manual PDF payment receipts, admissions
├── templates/                  # HTML email & PDF templates
└── frontend/                   # React frontend application
    ├── vite.config.js          # Vite config
    ├── tailwind.config.js      # CSS configuration
    └── src/
        ├── App.jsx             # React routing table (public/private routes)
        ├── main.jsx            # React root renderer
        ├── components/         # Reusable ui, layout, and domain components
        └── pages/              # Page view components (including /godview)
```

---

## 3. Core Architecture Subsystems

### A. Multi-Tenancy & Isolation
All core operational tables contain a `school_id` foreign key referencing the `School` model. 
Database-level constraints and route dependencies verify that query lookups are strictly bound to the authenticated user's `school_id` (except globally authorized `superuser` requests under the God View).

### B. SaaS Subscriptions
Subscription packages are managed at the tenant level. The tier determines feature flags across the platform:
*   **Tiers:** `FREE_TRIAL`, `BASIC`, `PLUS`, `PRO`
*   **Feature Gate Configuration:** Located in [schools/constants.py](file:///Users/sandeshghimire/ai-sandbox/repos/SISsphere/schools/constants.py)
*   **Grace Period:** A 33-day grace window is offered once a subscription expires before the school is shifted into a `LOCKED` state, suspending login access.

### C. Access Control (RBAC) & Session Control
Role-Based Access Control is enforced by dependencies defined in [auth/dependencies.py](file:///Users/sandeshghimire/ai-sandbox/repos/SISsphere/auth/dependencies.py).
*   **Platform Role (Global):**
    *   `superuser`: Global platform owner with access to all schools via `/god-view`.
*   **Tenant Roles (School Level):**
    *   `super_admin`: School owner/operator.
    *   `school_admin`: Regular system administrator.
    *   `principal`: Academic overview and approvals.
    *   `academic_admin`: Controls class scheduling, setups, and grade books.
    *   `accountant`: Manages tuition structures, invoices, cash payments, and ledger.
    *   `teacher`: Handles grading, recording class attendance, and lesson planning.
    *   `parent`: Views child academics, pays fees, and requests gate passes.
    *   `student`: Checks class schedules, results, and attendance.
    *   `board`: High-level strategic school performance analytics.
    *   `security_guard`: Uses scanner app on gate devices to authorize student pickups.

**Kill-Switch Security:** To instantly invalidate active sessions when a user's role is updated or credentials change, the token payload includes a `token_version`. A backend DB check triggers verification on every request. If a mismatch is found, the user is immediately logged out.

### D. Advanced Academic Timetabling
Academics utilizes a modular timetable system:
*   **Schedule Templates:** Time blocks defined as JSON configurations (e.g., standard 8-period structure, half-day templates).
*   **Weekly Rules:** Mappings of template structures to days of the week (Monday-Friday patterns).
*   **Overrides:** Multi-grade overrides for exam periods or custom events (e.g., Friday assemblies).
*   **Assignments:** Mappings of teacher, section, and subjects to timetables.

### E. Financial Billing & Auto-Invoicing
*   **Fee Item Templates:** Definitions of recurring charges (monthly, quarterly, or yearly) scoped by grade.
*   **Student Addons:** Handles optional school items (hostel enrollment, school bus service) that students choose to join.
*   **Discount Engine:** Automatic checks are run for sibling discounts, staff child deductions, and scholarships. Manual discount applications can be requested, requiring approval.
*   **Invoicing Run:** Auto-generates student invoices based on active item templates, enrolled addons, and eligible discounts.
*   **General Ledger:** Double-entry-ready invoice transaction ledger tracks payments categorised by office cash or remote bank gateway transfers.
*   **Payment Plans:** Installment-based payment schedules require principal/school admin approvals.

### F. QR Gate Passes & Security
To ensure student safety, SISsphere tracks authorized pick-ups:
*   **Normal Gate Pass:** A daily pass generated by parents indicating who is picking up the student.
*   **Super Pass:** A multi-day or special exception pass with mandatory reason fields.
*   **Verification:** Guards scan the QR pass at the school gate. The app verifies:
    1.  Pass expiration date and time.
    2.  Parent-Student authorization linkage.
    3.  Critical safety overrides (e.g. `pickup_blocked` flags).

### G. Database Change Auditing
All structural edits are audited dynamically.
*   **SQLAlchemy Listeners:** Captures `INSERT`, `UPDATE`, and `DELETE` queries on audited tables.
*   **Delta Capture:** Saves the full `before_state` and `after_state` in the database as JSON.
*   **Metadata Integration:** Stores `actor_id` (who made the change), `reason` (manual override justification), and `trace_id` (Trace ID tracking HTTP contexts).

### H. Chatbots (Gemini AI)
*   **Public Chatbot:** Embedded on the landing page to answer pricing, admissions, and demo inquiries. Uses keyword triggers to suggest the Admissions Form.
*   **Nepsis Portal Assistant:** Authenticated chatbot inside the parent portal. Evaluates the parent's linked student context to fetch grades, attendance logs, and fee balances.

---

## 4. Key Database Model Relations

Mapped in SQLAlchemy, the database schema spans across modules:

| Table Name | Primary Purpose | Key Foreign Keys / Relations |
| :--- | :--- | :--- |
| `schools` | Multi-tenant tenant records | - |
| `users` | Logins, roles, and personal info | `school_id` -> `schools` |
| `user_roles` | Holds secondary roles for active switching | `user_id` -> `users` |
| `students` | Active student records | `school_id`, `grade_id`, `section_id`, `user_id` |
| `parent_student_links` | Maps parents to authorized pickups | `parent_id` -> `users`, `student_id` -> `students` |
| `attendance` | Records daily student status | `student_id` -> `students`, `grade_id` -> `grades` |
| `gate_passes` | QR safety passes for gates | `student_id` -> `students`, `issuer_user_id` -> `users` |
| `fee_item_templates` | Setup profiles for recurring billing | `school_id`, `grade_id` |
| `student_invoices` | Auto-generated billing instances | `student_id` -> `students`, `school_id` -> `schools` |
| `payments` | Transactions, manual cash, or Stripe logs | `invoice_id` -> `invoices`, `recorded_by` -> `users` |
| `audit_logs` | Deep auditing database changes | `school_id` -> `schools` |
| `complaints` | Security or admin tickets | `student_id` -> `students`, `assigned_to_user_id` -> `users` |
| `notices` | Bulletin board announcements | `author_id` -> `users` |
| `grade_subjects` | Subjects linked to specific grades | `grade_id` -> `grades`, `subject_id` -> `subjects` |
| `teaching_assignments` | Mappings of teachers to section/subjects | `teacher_user_id` -> `users`, `subject_id` -> `subjects` |

---

## 5. Main API Routes (FastAPI Routing)

FastAPI registers routers under the following namespaces in `main.py`:

*   `/api/auth` (Login, user registration, JWT generation, password resets, role switching)
*   `/api/schools` (School setup, active tier evaluations, status details)
*   `/api/academics` (Academic years, sections, grades setup, subject templates)
*   `/api/teaching-assignments` (Teacher subjects and grade configurations)
*   `/api/students` (Enrollment details, Student 360 lookup, admissions workflow)
*   `/api/finance` (Ledger logs, payment processing, fee item templates, discount rules, automated invoicing)
*   `/api/attendance` (Classroom logs, attendance reports)
*   `/api/gate-passes` (Security QR ticket generation, guard scans)
*   `/api/communication` (School notices board, principal routing complaints)
*   `/api/analytics` (Principals class metrics, board revenue velocity)
*   `/api/dashboard` (Personal dashboards for parents, teachers, and students)
*   `/api/audit` (Audit trail listing with trace matches)
*   `/api/chat` (AI chatbot processing engine)

---

## 6. Frontend Routing Table (`App.jsx`)

The React application uses a nested layout structure based on role visibility:

| Path | Required Roles | Target Component / Page |
| :--- | :--- | :--- |
| `/` | Public | `LandingPage` |
| `/find-school` | Public | `FindSchool` |
| `/login` | Public | `LoginPage` |
| `/public/admissions/:school_uuid` | Public | `PublicAdmission` |
| `/dashboard` | Authenticated | `DashboardLayout` (Wraps nested dashboards) |
| `/dashboard/scan` | `security_guard`, `principal`, `super_admin` | `GuardScanner` (QR Gate Scanner) |
| `/dashboard/fees` | `principal`, `super_admin`, `school_admin`, `accountant` | `FeesPage` (Billing runs) |
| `/dashboard/financials/overview` | `principal`, `super_admin`, `school_admin`, `accountant` | `FinanceOverviewDashboard` |
| `/dashboard/board-analytics` | `super_admin`, `board` | `BoardExecutiveDashboard` |
| `/dashboard/parent-dashboard` | `parent` | `ParentDashboard` |
| `/dashboard/parent/academics` | `parent` | `ParentAcademics` |
| `/dashboard/parent/financials` | `parent` | `ParentFinancials` |
| `/dashboard/parent/directory` | `parent` | `ParentDirectory` |
| `/dashboard/academics` | Anyone (Except `security_guard`) | `AcademicsPage` |
| `/dashboard/academic-setup` | `principal`, `super_admin` | `AcademicSetupHub` (Schedules, Years, Policies) |
| `/dashboard/grading` | `principal`, `super_admin`, `teacher` | `GradingWorkspace` |
| `/dashboard/attendance/record` | `teacher`, `principal`, `super_admin` | `RecordAttendancePage` |
| `/dashboard/my-students` | `teacher` | `MyStudentsPage` |
| `/dashboard/students/:studentId`| `teacher`, `principal`, `super_admin`, `school_admin`, `accountant` | `Student360Profile` |
| `/god-view` | `superuser` (Global Platform Admin Only) | `SuperAdminLayout` (System-wide metrics, multi-school logs) |
