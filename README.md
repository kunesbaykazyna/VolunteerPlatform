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
- [API Documentation](#-api-documentation)
- [Quality Assurance (DB Testing)](#-quality-assurance-db-testing)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

* **User Authentication:** Secure registration and login using JWT tokens (`HTTPBearer`), with role-based access control for volunteers and organizers.
* **Project Catalog:** Browse available volunteer projects with category filtering.
* **Application System:** Apply to a project with one click.
* **My Applications Dashboard:** Track the projects you have successfully applied to or joined.
* **Application Management for Organizers:** Review responses and update application statuses.
* **Data Integrity & Security:**
  * Database-level constraints and unique application checks (no double-applying).
  * Automatic capacity enforcement through a database trigger.
  * Secure parameter binding for all SQL queries.
* **Interactive API Docs:** Swagger UI available out of the box.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React.js, Axios, Vite |
| **Backend** | Python, FastAPI, Uvicorn, PyJWT, Pydantic, psycopg2 |
| **Database** | PostgreSQL (raw SQL queries, custom triggers and constraints) |

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

### 3. Backend Setup

1. Navigate to the backend directory (or stay in the project root if the backend lives there).
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

4. Start the FastAPI server:

   ```bash
   uvicorn main:app --reload
   ```

   *The backend will run on `http://localhost:8000`.*

### 4. Frontend Setup

1. Navigate to the `frontend` directory (or the folder containing the React app).
2. Install Node modules:

   ```bash
   cd frontend
   npm install
   ```

3. Start the React development server:

   ```bash
   npm run dev
   ```

   *The frontend will be available at `http://localhost:5173`.*

> **Tip:** Keep the backend and frontend running in two separate terminal windows.

---

## 📖 API Documentation

Once the backend is running, interactive API documentation is generated automatically by FastAPI:

* **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

To test protected endpoints in Swagger UI, log in to obtain a JWT token, click **Authorize**, and paste the token.

---

## 🧪 Quality Assurance (DB Testing)

To verify the database constraints and architecture security, run the `qa_db_tests.sql` script in your DB client, or from the terminal:

```bash
psql -U postgres -d volunteer_db -f qa_db_tests.sql
```

The tests cover:

1. Prevention of duplicate email registrations.
2. Prevention of double-applying to the same project.
3. Capacity enforcement via the `check_project_capacity()` trigger.

---

## 🩺 Troubleshooting

* **Cannot connect to the database:** Make sure PostgreSQL is running, the `volunteer_db` database exists, and the connection credentials in the backend code match your local setup.
* **`ModuleNotFoundError` when starting the backend:** Check that your virtual environment is activated and dependencies are installed.
* **Frontend cannot reach the API:** Confirm the backend is running on port `8000` and that the frontend's Axios base URL points to it.
* **Port already in use:** Stop the process using the port, or start the server on a different one (e.g. `uvicorn main:app --reload --port 8001`).