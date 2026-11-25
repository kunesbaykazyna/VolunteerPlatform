# 🌿 Helping Hands – Volunteer Platform

A full-stack web application that connects volunteers with local social, environmental, and community projects, and gives organizers and multi-organizer teams the tools to manage projects and volunteer applications safely.

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Team & Roles](#-team--roles)
- [Getting Started](#️-getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Database Setup (Cloud Neon or Local PostgreSQL)](#2-database-setup-cloud-neon-or-local-postgresql)
  - [3. Backend Setup](#3-backend-setup)
  - [4. Frontend Setup](#4-frontend-setup)
- [Environment Variables](#-environment-variables)
- [Email Setup (Gmail or Mailtrap)](#-email-setup-gmail-or-mailtrap)
- [API Documentation](#-api-documentation)
- [Testing Info & Test Accounts](#-testing-info--test-accounts)
- [Quality Assurance (DB Testing)](#-quality-assurance-db-testing)
- [Documentation & Reports](#-documentation--reports)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

* **User Authentication & Session Sync:** Secure registration and login using JWT tokens (`HTTPBearer`), with session persistence across page reloads (`localStorage`) and automatic state synchronization via `GET /api/auth/me`.
* **Email Verification & Password Reset:** New users confirm their email address by a link sent to their inbox, and can reset a forgotten password through an emailed one-time link.
* **Volunteer & Organizer Profiles:** Dedicated profile editing for volunteers (`phone`, `skills`, `bio`, avatar upload) and organizations (`company_name`, `website`, `contact_phone`, `description`), plus public organizer pages (`#/organizers/:id`) showing company info and open projects.
* **Multi-Organizer Company Governance:**
  * Organizers can either **create a new company** (becoming `super_organizer` with a unique `invite_code`) or **join an existing company** via invite code (starting as `pending` until approved).
  * **Role Hierarchy:** Only the `super_organizer` can approve/remove colleagues, transfer the `super_organizer` role, edit shared company profile fields, or modify/delete colleagues' projects.
  * **Conflict Prevention:** Optimistic locking (`projects.version` → `409 Conflict`) prevents overwriting simultaneous project edits, and row-level locking (`FOR UPDATE` + `expected_status` → `409 Conflict`) prevents double-processing applications or exceeding capacity.
* **Project Catalog:** Search, filter by category, date, and location, and sort projects by date, newest, or remaining capacity.
* **Application System:** Apply to a project with a motivation statement (20–1000 characters), track statuses on **My Applications**, or withdraw applications.
* **Application Management for Organizers:** Review responses with motivation, approve/reject (with reason) or reopen applications, edit or cancel projects, close/reopen applications, and permanently delete projects.
* **Appearance:** Responsive interface with a theme switcher (**Green** default, **Pink**, and **Dark**) saved in the browser.
* **Languages:** English, Russian, and Kazakh interface (`EN` / `RU` / `KZ`).
* **Data Integrity & Security:**
  * Database-level constraints, unique application checks (no double-applying), and partial unique index `uq_one_super_organizer_per_org` enforcing strictly one active `super_organizer` per company.
  * Automatic capacity enforcement through a database trigger (`check_project_capacity()`).
  * Safe account deletion: `super_organizer` cannot delete their account while active colleagues remain; regular organizers' projects are reassigned to the `super_organizer`.
  * Secure `%s` parameter binding for all SQL queries; passwords hashed with `bcrypt`; verification/reset tokens stored strictly as SHA-256 hashes.
* **Interactive API Docs:** Swagger UI available out of the box.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React.js, Axios, Vite |
| **Backend** | Python, FastAPI, Uvicorn, python-jose (JWT), passlib/bcrypt, Pydantic, psycopg2 |
| **Database** | PostgreSQL (Cloud Neon / local PostgreSQL, raw SQL queries, triggers & constraints) |
| **Email** | SMTP (Mailtrap Sandbox, Gmail app password, Mailpit, or any provider) |

## 👥 Team & Roles

* **System Analyst:** Frontend development, UI/UX, requirements gathering.
* **Developer:** Backend logic, REST API endpoints, client-server integration.
* **QA (Quality Assurance):** Database integrity testing, automated unit tests, negative/positive constraint testing.
* **Architecture and Security:** Role hierarchy, conflict prevention, error handling, secure parameter binding.
* **Data and DB (Lead):** Database architecture, ER diagram, table creation, migrations, triggers.

---

## ⚙️ Getting Started

Follow these steps to run the project on your machine.

### Prerequisites

* [Python](https://www.python.org/downloads/) 3.9+
* [Node.js](https://nodejs.org/) and npm
* [PostgreSQL](https://www.postgresql.org/download/) (only needed if running a local DB instead of the shared Neon cloud DB)
* Git
* An SMTP account for emails (see [Email Setup](#-email-setup-gmail-or-mailtrap))

### 1. Clone the Repository

```bash
git clone https://github.com/kunesbaykazyna/VolunteerPlatform.git
cd VolunteerPlatform
```

### 2. Database Setup (Cloud Neon or Local PostgreSQL)

#### Option A: Shared Cloud Database (Neon — Recommended for Team)
The team database is hosted on **Neon** so every team member works with the same companies, projects, and test accounts without local setup:

1. Request the shared `DATABASE_URL` (with `?sslmode=require`) from the team in a private chat (never commit it to Git).
2. Use that URL in Step 3 (`Backend Setup`).

#### Option B: Local PostgreSQL Setup
1. Create a local database named `volunteer_db`:

   ```sql
   CREATE DATABASE volunteer_db;
   ```

2. Restore the base structure and run migrations:

   ```bash
   psql -U postgres -d volunteer_db -f init.sql
   psql -U postgres -d volunteer_db -f volunteer_backend/migrations/002_project_management.sql
   psql -U postgres -d volunteer_db -f volunteer_backend/migrations/003_email_authentication.sql
   ```

   > The backend also automatically ensures `organizations`, `organization_members`, `uq_one_super_organizer_per_org`, `projects.version`, `users.avatar_url`, `registrations.motivation`, and `registrations.rejection_reason` on startup.

### 3. Backend Setup

1. Navigate to the backend directory (`volunteer_backend`):

   ```bash
   cd volunteer_backend
   ```

2. Create and activate a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate      # On Windows: venv\Scripts\activate
   ```

3. Install the required dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Set the environment variables in the same terminal where you start Uvicorn. The backend **will not start** without `SECRET_KEY` and `DATABASE_URL`, and registration/password reset **will not work** without SMTP variables.

   **Windows PowerShell:**

   ```powershell
   Set-Location '<path-to>\volunteer_backend'

   # Shared Neon URL (recommended) or local: postgresql://postgres:<PASSWORD>@localhost:5432/volunteer_db
   $env:DATABASE_URL = "<YOUR_NEON_OR_LOCAL_DATABASE_URL>"
   $env:SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
   $env:FRONTEND_URL = "http://localhost:5173"

   # Mailtrap test inbox (recommended for local testing, see Email Setup)
   $env:SMTP_HOST = "sandbox.smtp.mailtrap.io"
   $env:SMTP_PORT = "2525"
   $env:SMTP_USER = "<mailtrap-username>"
   $env:SMTP_PASSWORD = "<mailtrap-password>"
   $env:SMTP_FROM = "noreply@helpinghands.test"
   ```

   **macOS / Linux (bash / zsh):**

   ```bash
   # Shared Neon URL (recommended) or local: postgresql://localhost:5432/volunteer_db
   export DATABASE_URL="<YOUR_NEON_OR_LOCAL_DATABASE_URL>"
   export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
   export FRONTEND_URL="http://localhost:5173"

   export SMTP_HOST="sandbox.smtp.mailtrap.io"
   export SMTP_PORT="2525"
   export SMTP_USER="<mailtrap-username>"
   export SMTP_PASSWORD="<mailtrap-password>"
   export SMTP_FROM="noreply@helpinghands.test"
   ```

   > Variables live only in the current terminal session. Generating a new `SECRET_KEY` logs out existing browser sessions; for convenience during local development, you can generate it once and reuse the generated string in your local terminal. Never commit credentials to Git.

5. Start the FastAPI server:

   ```bash
   uvicorn main:app --reload
   ```

   *The backend will run on `http://localhost:8000`.*

### 4. Frontend Setup

1. Open a **second** terminal window (`volunteer_frontend`) and install dependencies:

   ```bash
   cd <path-to-project>/volunteer_frontend
   npm install
   ```

2. Start the Vite development server:

   ```bash
   npm run dev
   ```

   *The frontend will be available at `http://localhost:5173`.*

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string: Neon URL (`postgresql://...?sslmode=require`) or local (`postgresql://postgres:<password>@localhost:5432/volunteer_db`, or `postgresql://localhost:5432/volunteer_db` on macOS without password). URL-encode special characters in passwords (`@` → `%40`). |
| `SECRET_KEY` | Yes | Long random string used to sign JWT login tokens. Generate one with `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it logs out all users. |
| `FRONTEND_URL` | Yes (for emails) | Frontend URL used to build email links. Local value: `http://localhost:5173`. |
| `SMTP_HOST` | Yes (for emails) | SMTP host, e.g. `sandbox.smtp.mailtrap.io` (Mailtrap) or `smtp.gmail.com` (Gmail). |
| `SMTP_PORT` | Yes (for emails) | `2525` or `587` for STARTTLS, or `465` for implicit TLS. |
| `SMTP_USER` | Yes (for emails) | SMTP username. |
| `SMTP_PASSWORD` | Yes (for emails) | SMTP password (Gmail requires an App Password). |
| `SMTP_FROM` | Yes (for emails) | Sender address (any address works with Mailtrap, e.g. `noreply@helpinghands.test`). |

Email verification links expire after 24 hours; password-reset links expire after 1 hour and are single-use.

---

## 📧 Email Setup (Gmail or Mailtrap)

### Option A: Gmail (real emails)
1. Enable 2-Step Verification in your Google account and generate an App Password at <https://myaccount.google.com/apppasswords>.
2. Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, your Gmail address for `SMTP_USER` and `SMTP_FROM`, and the 16-character App Password (without spaces) for `SMTP_PASSWORD`.

### Option B: Mailtrap (recommended for testing)
1. Sign up at <https://mailtrap.io> (free plan).
2. Open **Sandboxes** (or **Email Testing → Inboxes**) → **My Sandbox / My Inbox → Integration → SMTP** and reveal the credentials.
   *(Do not use Sending / API / Python SDK credentials — this project uses Email Testing Sandbox SMTP.)*
3. Use host `sandbox.smtp.mailtrap.io`, port `2525`, and your Sandbox username/password.
4. Emails appear inside your Mailtrap inbox instead of being delivered externally, allowing registration with any example email (e.g. `test1@example.com`).

### Option C: Mailpit (local, no account)
Install [Mailpit](https://mailpit.axllent.org/), run it, and use `SMTP_HOST=localhost`, `SMTP_PORT=1025`. View captured emails at <http://localhost:8025>.

---

## 📖 API Documentation

Once the backend is running, interactive Swagger documentation is available at:

* **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

To test protected endpoints in Swagger UI, log in via `/api/login` to obtain a JWT token, click **Authorize**, and paste the token.

---

## 🧪 Testing Info & Test Accounts

### 1. Pre-Seeded Test Accounts
The shared test dataset includes 2 companies, 5 organizers, 6 volunteers, 10 projects, and 28 applications. All pre-seeded accounts share the password **`Test1234`**:

| Email | Role | Company / Status | Purpose |
|---|---|---|---|
| `super1@helpinghands.test` | `organizer` | **Green Almaty Foundation** (`super_organizer`, `active`) | Company owner: invite code `GREEN001`, approve/remove colleagues, transfer super role, manage any company project |
| `org1@helpinghands.test` | `organizer` | **Green Almaty Foundation** (`organizer`, `active`) | Second organizer: create own projects, review company applications; blocked from deleting `super1` projects or editing company details |
| `org1_pending@helpinghands.test` | `organizer` | **Green Almaty Foundation** (`organizer`, `pending`) | Joined via invite code; blocked from creating projects until approved by `super1` |
| `super2@helpinghands.test` | `organizer` | **Qamqor Care** (`super_organizer`, `active`) | Second company (`QAMQOR02`) for cross-company isolation testing |
| `org2@helpinghands.test` | `organizer` | **Qamqor Care** (`organizer`, `active`) | Second active organizer in Qamqor Care |
| `vol1@helpinghands.test` – `vol5@helpinghands.test` | `volunteer` | Verified (`email_verified = true`) | Browse catalog, apply (min 20 chars motivation), check statuses and rejection/cancellation reasons |
| `vol6_unverified@helpinghands.test` | `volunteer` | Unverified (`email_verified = false`) | Test verification banner and `403 email_not_verified` block |

### 2. Running Automated Backend Tests
From `volunteer_backend` (with `venv` activated):

```bash
python -m unittest test_platform15.py -v
python -m unittest test_auth_helpers.py -v
```

`test_platform15.py` executes 15 automated unit/integration tests covering password policy, token hashing/expiration, email verification guardrails, invite-code validation, multi-organizer RBAC, `409 Conflict` concurrency checks, company profile locks, atomic super-role transfer, and account-deletion safeguards using mocks (safe to run without modifying the shared database).

---

## 🧪 Quality Assurance (DB Testing)

To verify database constraints and trigger enforcement directly in PostgreSQL:

```bash
psql -d volunteer_db -f qa_db_tests/qa_db_tests.sql
```

The DB QA tests cover:
1. Prevention of duplicate email registrations.
2. Prevention of double-applying to the same project.
3. Capacity enforcement via the `check_project_capacity()` trigger.
4. Enforcement of at most one active `super_organizer` per company via `uq_one_super_organizer_per_org`.

---

## 📄 Documentation & Reports

* **`test.md`** — Full testing guide, test dataset reference, and 15 end-to-end QA test cases (`TC-01` – `TC-15`).
* **`REPORT.md`** — Final project report covering system architecture, database relationships, multi-organizer conflict prevention, and test results.

---

## 🩺 Troubleshooting

* **Backend stops at startup and asks for `SECRET_KEY` or `DATABASE_URL`:** Set them in the same terminal session before running `uvicorn`.
* **`RuntimeError: SMTP_HOST is not configured` / "Email could not be sent":** SMTP environment variables are missing in the terminal where Uvicorn is running. Set them and restart Uvicorn.
* **Registration returns `400 invalid_invite_code`:** Verify the company invite code (e.g., `GREEN001` or `QAMQOR02`) with the company's `super_organizer`.
* **`psql` / `pg_dump` version mismatch on macOS (`Postgres.app` vs Homebrew):** Invoke the binary matching your server version directly, e.g. `/Applications/Postgres.app/Contents/Versions/17/bin/psql`.
* **`psycopg2` complains about `channel_binding` with Neon URL:** Remove `&channel_binding=require` from the end of `DATABASE_URL`, keeping `?sslmode=require`.
* **DataGrip error `Incorrect driver and/or database URL specified` or `iteration must be >= 4096` with Neon:** Do not paste `postgresql://user:pass@...` into DataGrip's URL field. Fill **Host**, **Port** (`5432`), **User** (`neondb_owner`), **Password**, and **Database** (`neondb`) separately, enable **SSH/SSL → Use SSL (Require)**, or run `ALTER ROLE neondb_owner WITH PASSWORD '...'` in Neon SQL Editor.
* **`ModuleNotFoundError` when running tests inside `venv` (e.g., Anaconda intercepts `python`):** Run `./venv/bin/python -m unittest test_platform15.py -v`.
* **CSS changes do not appear in the browser:** Perform a hard refresh (`Cmd + Shift + R` on macOS, `Ctrl + Shift + R` on Windows/Linux).
* **Port already in use:** Stop the existing process or run on another port (`uvicorn main:app --reload --port 8001`).