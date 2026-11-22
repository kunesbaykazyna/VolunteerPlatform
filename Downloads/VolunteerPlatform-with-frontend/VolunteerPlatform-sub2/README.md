# 🌿 Helping Hands – Volunteer Platform

A full-stack web application that connects volunteers with local social, environmental, and community projects, and gives organizers the tools to manage the people who respond.

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Team & Roles](#-team--roles)
- [Getting Started](#️-getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Database Setup](#2-database-setup)
  - [3. Backend Setup](#3-backend-setup)
  - [4. Frontend Setup](#4-frontend-setup)
- [Environment Variables](#-environment-variables)
- [Email Setup (Gmail or Mailtrap)](#-email-setup-gmail-or-mailtrap)
- [API Documentation](#-api-documentation)
- [Quality Assurance (DB Testing)](#-quality-assurance-db-testing)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

* **User Authentication:** Secure registration and login using JWT tokens (`HTTPBearer`), with role-based access control for volunteers and organizers.
* **Email Verification & Password Reset:** New users confirm their email address by a link sent to their inbox, and can reset a forgotten password through an emailed one-time link.
* **Project Catalog:** Search, filter by category, date, and location, and sort projects by date or remaining capacity.
* **Application System:** Apply to a project with one click.
* **My Applications Dashboard:** Track the projects you have successfully applied to or joined.
* **Application Management for Organizers:** Review responses, edit or cancel projects, close applications, and permanently delete projects.
* **Appearance:** Responsive interface with a theme switcher. The default theme is **Green**. Users can switch to **Pink** or **Dark** with the palette button in the header. The choice is saved in the browser and the system color preference is not used.
* **Languages:** English, Russian, and Kazakh interface.
* **Data Integrity & Security:**
  * Database-level constraints and unique application checks (no double-applying).
  * Automatic capacity enforcement through a database trigger.
  * Secure parameter binding for all SQL queries.
  * Passwords are hashed with bcrypt; verification and reset tokens are stored only as SHA-256 hashes.
* **Interactive API Docs:** Swagger UI available out of the box.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React.js, Axios, Vite |
| **Backend** | Python, FastAPI, Uvicorn, PyJWT, Pydantic, psycopg2 |
| **Database** | PostgreSQL (raw SQL queries, custom triggers and constraints) |
| **Email** | SMTP (Gmail app password, Mailtrap, Mailpit, or any provider) |

## 👥 Team & Roles

* **System Analyst:** Frontend development, UI/UX, requirements gathering.
* **Developer:** Backend logic, REST API endpoints, client-server integration.
* **QA (Quality Assurance):** Database integrity testing, negative/positive constraint testing.
* **Architecture and Security:** Role management, error handling, secure parameter binding.
* **Data and DB (Lead):** Database architecture, ER diagram, table creation, triggers.

---

## ⚙️ Getting Started

Follow these steps to run the project on your local machine.

### Prerequisites

* [Python](https://www.python.org/downloads/) 3.9+
* [Node.js](https://nodejs.org/) and npm
* [PostgreSQL](https://www.postgresql.org/download/)
* Git
* An SMTP account for emails (see [Email Setup](#-email-setup-gmail-or-mailtrap))

### 1. Clone the Repository

```bash
git clone https://github.com/kunesbaykazyna/VolunteerPlatform.git
cd VolunteerPlatform
```

### 2. Database Setup

1. Make sure PostgreSQL is installed and running.
2. Open your terminal or a database client (such as DataGrip or pgAdmin).
3. Create a new database named `volunteer_db`:

   ```sql
   CREATE DATABASE volunteer_db;
   ```

4. Restore the database structure and test data using the provided initialization script:

   ```bash
   psql -U postgres -d volunteer_db -f init.sql
   ```

   The backend adds the project-management columns on startup. To apply them manually instead, run:

   ```bash
   psql -U postgres -d volunteer_db -f volunteer_backend/migrations/002_project_management.sql
   ```

5. Apply the email-authentication migration (the backend also ensures these columns on startup):

   ```bash
   psql -U postgres -d volunteer_db -f volunteer_backend/migrations/003_email_authentication.sql
   ```

### 3. Backend Setup

1. Navigate to the backend directory (`volunteer_backend`):

   ```bash
   cd volunteer_backend
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate      # On Windows: venv\Scripts\activate
   ```

3. Install the required dependencies:

   ```bash
   pip install -r requirements.txt
   ```

   If you prefer to install the packages manually:

   ```bash
   pip install fastapi uvicorn psycopg2-binary pydantic pyjwt
   ```

4. Set the environment variables (see the full list in [Environment Variables](#-environment-variables)). The backend **will not start** without `SECRET_KEY` and `DATABASE_URL`, and registration and password reset **will not work** without the SMTP variables.

   **Windows PowerShell** (run everything in the same window where you start the server):

   ```powershell
   Set-Location '<path-to>\volunteer_backend'

   $env:DATABASE_URL = "postgresql://postgres:<YOUR_DB_PASSWORD>@localhost:5432/volunteer_db"
   $env:SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
   $env:FRONTEND_URL = "http://localhost:5173"

   # Mailtrap test inbox (recommended for local testing, see Email Setup)
   $env:SMTP_HOST = "sandbox.smtp.mailtrap.io"
   $env:SMTP_PORT = "2525"
   $env:SMTP_USER = "<mailtrap-username>"
   $env:SMTP_PASSWORD = "<mailtrap-password>"
   $env:SMTP_FROM = "noreply@helpinghands.test"
   ```

   **macOS / Linux (bash):**

   ```bash
   export DATABASE_URL="postgresql://postgres:<YOUR_DB_PASSWORD>@localhost:5432/volunteer_db"
   export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
   export FRONTEND_URL="http://localhost:5173"
   export SMTP_HOST="sandbox.smtp.mailtrap.io"
   export SMTP_PORT="2525"
   export SMTP_USER="<mailtrap-username>"
   export SMTP_PASSWORD="<mailtrap-password>"
   export SMTP_FROM="noreply@helpinghands.test"
   ```

   > Variables live only in the terminal window where you set them. If you open a new terminal, or restart your computer, set them again. The server reads them only at startup, so restart Uvicorn after changing any of them.
   >
   > Never commit these values to Git and never share them.

5. Start the FastAPI server in the same terminal:

   ```bash
   uvicorn main:app --reload
   ```

   *The backend will run on `http://localhost:8000`.*

### 4. Frontend Setup

1. Open a **second** terminal window. The backend keeps running in the first one.
2. Go to the folder containing the React app (`volunteer_frontend`) and install Node modules:

   ```bash
   cd <path-to-project>/volunteer_frontend
   npm install
   ```

3. Start the React development server:

   ```bash
   npm run dev
   ```

   *The frontend will be available at `http://localhost:5173`.*

> **Tip:** Keep the backend and frontend running in two separate terminal windows.

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://postgres:<password>@localhost:5432/volunteer_db`. If the password contains special characters (`@`, `#`, `/`), URL-encode them (`@` becomes `%40`). |
| `SECRET_KEY` | Yes | Long random string used to sign login tokens. There is no default value on purpose. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it logs out all users. |
| `FRONTEND_URL` | Yes (for emails) | Address of the frontend, used to build links in emails. Local value: `http://localhost:5173`. |
| `SMTP_HOST` | Yes (for emails) | SMTP server host, e.g. `sandbox.smtp.mailtrap.io` (Mailtrap) or `smtp.gmail.com` (Gmail). |
| `SMTP_PORT` | Yes (for emails) | `2525` or `587` for STARTTLS (Mailtrap, Gmail, most providers) or `465` for implicit TLS. |
| `SMTP_USER` | Yes (for emails) | SMTP username (usually the full email address). |
| `SMTP_PASSWORD` | Yes (for emails) | SMTP password. For Gmail this must be an **app password**, not your normal password. |
| `SMTP_FROM` | Yes (for emails) | Sender address. Any address works with Mailtrap. For Gmail use the same address as `SMTP_USER`. |

Email verification links expire after 24 hours. Password-reset links expire after one hour and can only be used once. In deployment, set `FRONTEND_URL` to the public frontend address and configure SPF/DKIM/DMARC with your mail provider for reliable delivery.

Existing accounts are treated as verified by the migration to avoid locking out current users. New registrations must verify their address before applying to or creating projects.

---

## 📧 Email Setup (Gmail or Mailtrap)

### Option A: Gmail (real emails)

1. Turn on 2-Step Verification in your Google account.
2. Open <https://myaccount.google.com/apppasswords> and create an app password (any name, for example "Helping Hands").
3. Copy the 16 characters **without spaces** into `SMTP_PASSWORD`.
4. Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, and the same Gmail address for `SMTP_USER` and `SMTP_FROM`.

### Option B: Mailtrap (recommended for testing)

1. Sign up at <https://mailtrap.io> (free plan).
2. Open **Email Testing → Inboxes → My Inbox → Integration → SMTP**. Copy the credentials (host, port, username, password). Click the eye icon to reveal the password.
3. Put them into `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`. Use port `2525` (STARTTLS) and any sender address for `SMTP_FROM`, for example `noreply@helpinghands.test`.
   Do not use the Sending / API / Python SDK pages of Mailtrap: this project needs the SMTP credentials of the **Email Testing** inbox.
4. Emails will not reach real people. They appear in your Mailtrap inbox, where you can open them and click the verification link. Because nothing is delivered, you can register with any address, for example `test1@example.com`.
5. Every team member can create a free Mailtrap account and use their own credentials, or the team can share one inbox. Share the credentials only in a private chat, never in the repository.
6. Open the verification link on the same computer where the site is running, because it points to `localhost`.

### Option C: Mailpit (local, no account)

Install [Mailpit](https://mailpit.axllent.org/), run it, then use `SMTP_HOST=localhost`, `SMTP_PORT=1025`, and any values for user, password and sender (if the server requires them). Open <http://localhost:8025> to see the emails.

### How to test

1. Register a new account on the site. A "Check your email" message appears.
2. Open the email (check the Spam folder too) and click the link. The account becomes verified.
3. On the login page click **Forgot password?**, enter your email, and use the link from the email to set a new password.

---

## 📖 API Documentation

Once the backend is running, interactive API documentation is generated automatically by FastAPI:

* **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

To test protected endpoints in Swagger UI, log in to obtain a JWT token, click **Authorize**, and paste the token.

---

## 🧪 Quality Assurance (DB Testing)

To verify the database constraints and architecture security, run the `qa_db_tests.sql` script in your DB client, or from the terminal:

```bash
psql -U postgres -d volunteer_db -f qa_db_tests/qa_db_tests.sql
```

The tests cover:

1. Prevention of duplicate email registrations.
2. Prevention of double-applying to the same project.
3. Capacity enforcement via the `check_project_capacity()` trigger.

---

## 🩺 Troubleshooting

* **Backend stops at startup and asks for `SECRET_KEY` or `DATABASE_URL`:** These variables are required. Set them in the same terminal where you run `uvicorn` (see [Backend Setup](#3-backend-setup), step 4).
* **`RuntimeError: SMTP_HOST is not configured` / "Email could not be sent":** The SMTP variables are missing in the terminal where Uvicorn is running. Set them, then restart Uvicorn.
* **`Authentication failed` when sending email:** For Gmail, use an app password (not your normal password), without spaces, and make sure 2-Step Verification is on.
* **`Connection timed out` when sending email:** Check `SMTP_HOST` and `SMTP_PORT`, your internet connection, and whether a firewall or antivirus blocks the port. Try Mailtrap.
* **Registration says the email is already registered, but no email arrived:** An earlier failed attempt may have created the user. Register with another address, delete the row from the users table in pgAdmin, or use **Resend email**.
* **Cannot connect to the database:** Make sure PostgreSQL is running, the `volunteer_db` database exists, and the password in `DATABASE_URL` is correct (URL-encode special characters).
* **`UnicodeDecodeError: 'utf-8' codec can't decode byte ...` at startup:** The backend could not connect to PostgreSQL, and the (non-English) error text from the database could not be read. Check the password, port and database name in `DATABASE_URL` (URL-encode special characters; no placeholders or angle brackets). To see the real message, run `$env:PGCLIENTENCODING = "WIN1251"` before starting Uvicorn.
* **`ModuleNotFoundError` when starting the backend:** Check that your virtual environment is activated and dependencies are installed.
* **Frontend cannot reach the API:** Confirm the backend is running on port `8000` and that the frontend's Axios base URL points to it.
* **Port already in use:** Stop the process using the port, or start the server on a different one (e.g. `uvicorn main:app --reload --port 8001`).
* **Variables disappeared:** PowerShell and bash variables last only for the current terminal session. Set them again in a new terminal.