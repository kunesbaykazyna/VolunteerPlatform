# 🌿 Helping Hands - Volunteer Platform MVP

A full-stack web application designed to connect volunteers with local social, environmental, and community projects.

## 🚀 Features

* **User Authentication:** Secure registration and login system with role-based access control.
* **Project Catalog:** Browse available volunteer projects with category filtering.
* **Application System:** One-click application to projects.
* **My Applications Dashboard:** Track successfully joined projects.
* **Data Integrity & Security:** Database-level constraints, unique application checks, and capacity enforcement.

## 🛠️ Tech Stack

* **Frontend:** React.js, Axios
* **Backend:** Python, FastAPI, Uvicorn
* **Database:** PostgreSQL (with raw SQL querying and DB-level triggers)

## 👥 Team & Roles

* **System Analyst:** Frontend development, UI/UX, requirements gathering.
* **Developer:** Backend logic, REST API endpoints, client-server integration.
* **QA (Quality Assurance):** Database integrity testing, negative/positive constraint testing.
* **Architecture and Security:** Role management, error handling, secure parameter binding.
* **Data and DB (Lead):** Database architecture, ER-diagram, table creation, triggers.

---

## ⚙️ Local Setup Instructions

Follow these steps to run the project on your local machine.

### 1. Database Setup

1. Ensure [PostgreSQL](https://www.postgresql.org/download/) is installed.
2. Open your terminal or a database client (like DataGrip / pgAdmin).
3. Create a new database named `volunteer_db`:

   ```sql
   CREATE DATABASE volunteer_db;
   ```

4. Restore the database structure and test data using the provided initialization script:

   ```bash
   psql -U postgres -d volunteer_db -f init.sql
   ```

### 2. Backend Setup

1. Navigate to the backend directory (or root if backend is in root).
2. Install the required Python dependencies:

   ```bash
   pip install fastapi uvicorn psycopg2-binary pydantic
   ```

3. Start the FastAPI server:

   ```bash
   uvicorn main:app --reload
   ```

   *The backend will run on `http://localhost:8000`*

### 3. Frontend Setup

1. Navigate to the `frontend` (or root) directory.
2. Install Node modules:

   ```bash
   npm install
   ```

3. Start the React development server:

   ```bash
   npm run dev
   ```

   *The frontend will be available at `http://localhost:5173`*

---

## 🧪 Quality Assurance (DB Testing)

To verify the database constraints and architecture security, run the `qa_db_tests.sql` script in your DB client.

The tests cover:

1. Prevention of duplicate email registrations.
2. Prevention of double-applying to the same project.
3. Capacity enforcement via the `check_project_capacity()` trigger.