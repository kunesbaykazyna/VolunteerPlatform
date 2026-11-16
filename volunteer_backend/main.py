from datetime import datetime
from typing import Optional

import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg2 import errors
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ApplyRequest(BaseModel):
    user_id: int
    note: Optional[str] = None  # short message from the volunteer


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password_hash: str
    role: str = "volunteer"  # volunteer or organizer


class LoginRequest(BaseModel):
    email: str
    password_hash: str


class ProjectCreate(BaseModel):
    organizer_id: int
    title: str
    description: Optional[str] = None
    category: str = "General"
    city: str
    address: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    max_capacity: int


class StatusUpdate(BaseModel):
    organizer_id: int
    status: str  # confirmed (approve) or cancelled (decline)


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Volunteer Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = "postgresql://postgres@localhost:5432/volunteer_db"


def get_db_connection():
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)


def clean_error(e: Exception) -> str:
    """Return only the first line of a database error (no CONTEXT/PL/pgSQL noise)."""
    return str(e).strip().split("\n")[0]


@app.on_event("startup")
def ensure_schema():
    """Small migration: the new UI lets volunteers leave a note when registering."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN IF NOT EXISTS note TEXT;")
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("Schema check failed:", e)
    finally:
        cur.close()
        conn.close()


@app.get("/")
def read_root():
    return {"message": "Backend is running!"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@app.post("/api/register")
def register_user(request: RegisterRequest):
    if request.role not in ("volunteer", "organizer"):
        raise HTTPException(status_code=400, detail="Role must be volunteer or organizer")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO users (full_name, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id, full_name, email, role;
            """,
            (request.full_name, request.email, request.password_hash, request.role),
        )
        new_user = cursor.fetchone()
        conn.commit()
        return {"message": "Registration successful!", "user": new_user}
    except errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=clean_error(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/login")
def login_user(request: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT user_id, full_name, email, role
            FROM users
            WHERE email = %s AND password_hash = %s;
            """,
            (request.email, request.password_hash),
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        return {"message": "Login successful!", "user": user}
    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@app.get("/api/projects")
def get_projects():
    """Public list of open projects, with the number of taken places."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT p.project_id,
                   p.title,
                   p.description,
                   p.city,
                   p.address,
                   p.start_datetime,
                   p.end_datetime,
                   p.max_capacity,
                   p.status,
                   p.category,
                   u.full_name AS organizer_name,
                   (SELECT COUNT(*) FROM registrations r
                     WHERE r.project_id = p.project_id
                       AND r.status IN ('pending', 'confirmed')) AS taken
            FROM projects p
                     JOIN users u ON p.organizer_id = u.user_id
            WHERE p.status = 'open' AND p.deleted_at IS NULL
            ORDER BY p.start_datetime;
            """
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@app.post("/api/projects")
def create_project(request: ProjectCreate):
    """Organizers can publish a new project."""
    if request.max_capacity <= 0:
        raise HTTPException(status_code=400, detail="Capacity must be greater than 0")
    if request.end_datetime <= request.start_datetime:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role FROM users WHERE user_id = %s;", (request.organizer_id,))
        row = cursor.fetchone()
        if not row or row["role"] not in ("organizer", "admin"):
            raise HTTPException(status_code=403, detail="Only organizers can create projects")

        cursor.execute(
            """
            INSERT INTO projects (organizer_id, title, description, address, city,
                                  start_datetime, end_datetime, max_capacity, status, category)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'open', %s)
            RETURNING project_id;
            """,
            (
                request.organizer_id,
                request.title,
                request.description,
                request.address,
                request.city,
                request.start_datetime,
                request.end_datetime,
                request.max_capacity,
                request.category,
            ),
        )
        new_id = cursor.fetchone()["project_id"]
        conn.commit()
        return {"message": "Project created!", "project_id": new_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=clean_error(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/projects/{project_id}/apply")
def apply_for_project(project_id: int, request: ApplyRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Status 'pending' is set by default. The DB trigger checks capacity.
        cursor.execute(
            """
            INSERT INTO registrations (user_id, project_id, note)
            VALUES (%s, %s, %s) RETURNING registration_id;
            """,
            (request.user_id, project_id, (request.note or "").strip() or None),
        )
        conn.commit()
        return {"message": "Your registration was sent! The organizer will review it.", "project_id": project_id}
    except errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="You have already registered for this project")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=clean_error(e))
    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Volunteer dashboard
# ---------------------------------------------------------------------------


@app.get("/api/users/{user_id}/applications")
def get_user_applications(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT r.registration_id,
                   r.status,
                   r.note,
                   r.registered_at,
                   p.project_id,
                   p.title,
                   p.description,
                   p.city,
                   p.start_datetime,
                   p.category,
                   u.full_name AS organizer_name
            FROM registrations r
                     JOIN projects p ON r.project_id = p.project_id
                     JOIN users u ON p.organizer_id = u.user_id
            WHERE r.user_id = %s
            ORDER BY r.registered_at DESC;
            """,
            (user_id,),
        )
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=400, detail=clean_error(e))
    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Organizer dashboard
# ---------------------------------------------------------------------------


@app.get("/api/organizers/{organizer_id}/registrations")
def get_organizer_registrations(organizer_id: int):
    """All registrations for projects created by this organizer."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT r.registration_id,
                   r.status,
                   r.note,
                   r.registered_at,
                   p.project_id,
                   p.title AS project_title,
                   p.max_capacity,
                   v.full_name AS volunteer_name,
                   v.email AS volunteer_email
            FROM registrations r
                     JOIN projects p ON r.project_id = p.project_id
                     JOIN users v ON r.user_id = v.user_id
            WHERE p.organizer_id = %s
            ORDER BY (r.status = 'pending') DESC, r.registered_at DESC;
            """,
            (organizer_id,),
        )
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=400, detail=clean_error(e))
    finally:
        cursor.close()
        conn.close()


@app.patch("/api/registrations/{registration_id}/status")
def update_registration_status(registration_id: int, request: StatusUpdate):
    """Organizer approves (confirmed) or declines (cancelled) a registration."""
    if request.status not in ("confirmed", "cancelled"):
        raise HTTPException(status_code=400, detail="Status must be confirmed or cancelled")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT p.organizer_id
            FROM registrations r
                     JOIN projects p ON r.project_id = p.project_id
            WHERE r.registration_id = %s;
            """,
            (registration_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Registration not found")
        if row["organizer_id"] != request.organizer_id:
            raise HTTPException(status_code=403, detail="This is not your project")

        cursor.execute(
            "UPDATE registrations SET status = %s WHERE registration_id = %s;",
            (request.status, registration_id),
        )
        conn.commit()
        return {"message": "Status updated", "status": request.status}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=clean_error(e))
    finally:
        cursor.close()
        conn.close()
