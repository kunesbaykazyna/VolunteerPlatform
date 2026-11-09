from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

class ApplyRequest(BaseModel):
    user_id: int

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password_hash: str
    role: str = 'volunteer' # по умолчанию волонтер

class LoginRequest(BaseModel):
    email: str
    password_hash: str

app = FastAPI(title="Volunteer Platform API")

# CORS configuration for React frontend
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

# Base endpoint to check if server is alive
@app.get("/")
def read_root():
    return {"message": "Backend is running!"}


# Регистрация нового пользователя
@app.post("/api/register")
def register_user(request: RegisterRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES (%s, %s, %s, %s) RETURNING user_id, full_name, email, role; \
                """
        cursor.execute(query, (request.full_name, request.email, request.password_hash, request.role))
        new_user = cursor.fetchone()
        conn.commit()
        return {"message": "Registration successful!", "user": new_user}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# Вход в систему (логин)
@app.post("/api/login")
def login_user(request: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
                SELECT user_id, full_name, email, role
                FROM users
                WHERE email = %s \
                  AND password_hash = %s; \
                """
        cursor.execute(query, (request.email, request.password_hash))
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return {"message": "Login successful!", "user": user}
    finally:
        cursor.close()
        conn.close()


# Endpoint to fetch available projects
@app.get("/api/projects")
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
            SELECT p.project_id, \
                   p.title, \
                   p.description, \
                   p.city,
                   p.start_datetime, \
                   p.max_capacity, \
                   p.status,
                   p.category, -- Добавили категорию
                   u.full_name as organizer_name
            FROM projects p
                     JOIN users u ON p.organizer_id = u.user_id
            WHERE p.status = 'open'; \
            """
    cursor.execute(query)
    projects = cursor.fetchall()

    cursor.close()
    conn.close()

    return projects


@app.post("/api/projects/{project_id}/apply")
def apply_for_project(project_id: int, request: ApplyRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Пытаемся записать волонтера. Статус 'pending' подставится сам по умолчанию.
        query = """
            INSERT INTO registrations (user_id, project_id) 
            VALUES (%s, %s) RETURNING registration_id;
        """
        cursor.execute(query, (request.user_id, project_id))
        conn.commit() # Обязательно подтверждаем транзакцию
        return {"message": "Successfully applied for the project!", "project_id": project_id}
    except Exception as e:
        conn.rollback() # Если ошибка (например, сработал твой триггер на лимит мест) - откатываем
        # Возвращаем ошибку на фронтенд
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()