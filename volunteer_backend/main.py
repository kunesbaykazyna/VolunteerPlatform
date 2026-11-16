from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

# Секретный ключ для подписи токенов (HMAC-SHA256, о котором мы говорили в самом начале!)
SECRET_KEY = "your-super-secret-key-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # Время жизни сессии (Session Timeout)

# Функция, которая проверяет JWT-токен из заголовка и достает из него user_id
# Теперь токен считывается через стандартный механизм безопасности FastAPI
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token payload missing user_id")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token signature")

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


class ApplyRequest(BaseModel):
    user_id: int


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password_hash: str
    role: str = 'volunteer'


class LoginRequest(BaseModel):
    email: str
    password_hash: str


# Схема для обновления профиля
class ProfileUpdateRequest(BaseModel):
    # Поля волонтера
    skills: str = None
    bio: str = None
    phone: str = None
    # Поля организатора
    company_name: str = None
    website: str = None
    description: str = None
    contact_phone: str = None


# Схема для изменения статуса заявки
class StatusUpdateRequest(BaseModel):
    status: str  # 'accepted' или 'rejected'


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


@app.get("/")
def read_root():
    return {"message": "Backend is running!"}


@app.post("/api/register")
def register_user(request: RegisterRequest):
    secure_password_hash = hash_password(request.password_hash)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES (%s, %s, %s, %s) RETURNING user_id, full_name, email, role;",
            (request.full_name, request.email, secure_password_hash, request.role)
        )
        new_user = cursor.fetchone()

        # Автоматически создаем пустую запись в таблице профилей в зависимости от роли
        if request.role == 'volunteer':
            cursor.execute("INSERT INTO volunteer_profiles (user_id) VALUES (%s);", (new_user['user_id'],))
        elif request.role == 'organizer':
            cursor.execute("INSERT INTO organization_profiles (user_id, company_name) VALUES (%s, %s);",
                           (new_user['user_id'], request.full_name + " Company"))

        conn.commit()
        return {"message": "Registration successful!", "user": new_user}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/login")
def login_user(request: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id, full_name, email, password_hash, role FROM users WHERE email = %s;", (request.email,))
        user = cursor.fetchone()

        if not user or not verify_password(request.password_hash, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Создаем JWT токен с заданным временем жизни (Session Timeout)
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"], "role": user["role"], "user_id": user["user_id"]},
            expires_delta=access_token_expires
        )

        return {
            "message": "Login successful!",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "user_id": user["user_id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user["role"]
            }
        }
    finally:
        cursor.close()
        conn.close()


@app.get("/api/projects")
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
            SELECT p.project_id, \
                   p.title, \
                   p.description, \
                   p.city, \
                   p.start_datetime, \
                   p.max_capacity, \
                   p.status, \
                   p.category, \
                   u.full_name as organizer_name
            FROM projects p
                     JOIN users u ON p.organizer_id = u.user_id
            WHERE p.status = 'open';
            """
    cursor.execute(query)
    projects = cursor.fetchall()
    cursor.close()
    conn.close()
    return projects


# Обновленный эндпоинт: user_id теперь берется безопасно из токена, а не из тела запроса!
@app.post("/api/projects/{project_id}/apply")
def apply_for_project(project_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = "INSERT INTO registrations (user_id, project_id) VALUES (%s, %s) RETURNING registration_id;"
        cursor.execute(query, (user_id, project_id))
        conn.commit()
        return {"message": "Successfully applied for the project!", "project_id": project_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/users/{user_id}/applications")
def get_user_applications(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
                SELECT r.registration_id, \
                       r.status, \
                       p.project_id, \
                       p.title, \
                       p.description, \
                       p.city, \
                       p.start_datetime, \
                       p.category, \
                       u.full_name as organizer_name
                FROM registrations r
                         JOIN projects p ON r.project_id = p.project_id
                         JOIN users u ON p.organizer_id = u.user_id
                WHERE r.user_id = %s; \
                """
        cursor.execute(query, (user_id,))
        applications = cursor.fetchall()
        return applications
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# ==========================================
# НОВЫЕ ЭНДПОИНТЫ ДЛЯ ШАГА 2
# ==========================================

# 1. Получение профиля пользователя (и базовых данных, и расширенных из таблиц профилей)
@app.get("/api/profile/{user_id}")
def get_user_profile(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Узнаем роль пользователя
        cursor.execute("SELECT user_id, full_name, email, role FROM users WHERE user_id = %s;", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        profile_data = dict(user)

        # Подтягиваем данные из профиля в зависимости от роли
        if user['role'] == 'volunteer':
            cursor.execute("SELECT skills, bio, phone FROM volunteer_profiles WHERE user_id = %s;", (user_id,))
            vol_profile = cursor.fetchone()
            if vol_profile:
                profile_data.update(vol_profile)
        elif user['role'] == 'organizer':
            cursor.execute(
                "SELECT company_name, website, description, contact_phone FROM organization_profiles WHERE user_id = %s;",
                (user_id,))
            org_profile = cursor.fetchone()
            if org_profile:
                profile_data.update(org_profile)

        return profile_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# 2. Обновление профиля пользователя
@app.put("/api/profile/{user_id}")
def update_user_profile(user_id: int, request: ProfileUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role FROM users WHERE user_id = %s;", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user['role'] == 'volunteer':
            cursor.execute(
                """
                UPDATE volunteer_profiles
                SET skills = COALESCE(%s, skills),
                    bio    = COALESCE(%s, bio),
                    phone  = COALESCE(%s, phone)
                WHERE user_id = %s;
                """,
                (request.skills, request.bio, request.phone, user_id)
            )
        elif user['role'] == 'organizer':
            cursor.execute(
                """
                UPDATE organization_profiles
                SET company_name  = COALESCE(%s, company_name),
                    website       = COALESCE(%s, website),
                    description   = COALESCE(%s, description),
                    contact_phone = COALESCE(%s, contact_phone)
                WHERE user_id = %s;
                """,
                (request.company_name, request.website, request.description, request.contact_phone, user_id)
            )

        conn.commit()
        return {"message": "Profile updated successfully!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# 3. Организатор: просмотр всех заявок на свои проекты
@app.get("/api/organizers/{organizer_id}/applications")
def get_organizer_applications(organizer_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            SELECT r.registration_id, r.status, r.registered_at,
                   p.project_id, p.title as project_title,
                   u.user_id as volunteer_id, u.full_name as volunteer_name, u.email as volunteer_email,
                   vp.skills, vp.phone as volunteer_phone
            FROM registrations r
            JOIN projects p ON r.project_id = p.project_id
            JOIN users u ON r.user_id = u.user_id
            LEFT JOIN volunteer_profiles vp ON u.user_id = vp.user_id
            WHERE p.organizer_id = %s;
        """
        cursor.execute(query, (organizer_id,))
        applications = cursor.fetchall()
        return applications
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# 4. Организатор: управление заявкой (принять / отклонить)
@app.put("/api/applications/{registration_id}/status")
def update_application_status(registration_id: int, request: StatusUpdateRequest):
    if request.status not in ['confirmed', 'rejected', 'pending']:
        raise HTTPException(status_code=400, detail="Invalid status value")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE registrations SET status = %s WHERE registration_id = %s RETURNING registration_id, status;",
            (request.status, registration_id)
        )
        updated = cursor.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Application not found")

        conn.commit()
        return {"message": f"Application status updated to {request.status}", "application": updated}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/applications/{registration_id}")
def remove_volunteer_application(registration_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Удаляем запись из таблицы регистраций/заявок по ID заявки
        cursor.execute("DELETE FROM registrations WHERE registration_id = %s;", (registration_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"message": "Volunteer application successfully deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()