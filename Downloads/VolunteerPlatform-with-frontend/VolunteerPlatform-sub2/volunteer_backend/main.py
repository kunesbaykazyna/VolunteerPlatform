from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
import html
import logging
from email.message import EmailMessage
import os
import secrets
import smtplib
import ssl
from urllib.parse import quote

security = HTTPBearer()
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
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
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # seed users in init.sql have plain placeholder hashes, not bcrypt
        return False


class ApplyRequest(BaseModel):
    motivation: str


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password_hash: str
    role: str = 'volunteer'
    lang: str = "en"


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
    avatar_url: str = None


# Схема для изменения статуса заявки
class StatusUpdateRequest(BaseModel):
    status: str
    rejection_reason: str = None


class DeleteAccountRequest(BaseModel):
    password: str


class EmailRequest(BaseModel):
    email: str
    lang: str = "en"


class AuthTokenRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


app = FastAPI(title="Volunteer Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DATABASE_URL")

AUTH_EMAIL_COPY = {
    "en": {
        "verify_subject": "Verify your Helping Hands email",
        "verify_heading": "Confirm your email",
        "verify_body": "Thanks for joining Helping Hands. Confirm your email address to apply for or create projects.",
        "verify_cta": "Verify email",
        "reset_subject": "Reset your Helping Hands password",
        "reset_heading": "Reset your password",
        "reset_body": "We received a request to reset the password for your Helping Hands account.",
        "reset_cta": "Choose a new password",
        "expiry": "This link expires in {hours} hour(s). If you did not request this, you can ignore this email.",
    },
    "ru": {
        "verify_subject": "Подтвердите адрес электронной почты Helping Hands",
        "verify_heading": "Подтвердите электронную почту",
        "verify_body": "Спасибо, что присоединились к Helping Hands. Подтвердите адрес, чтобы подавать заявки и создавать проекты.",
        "verify_cta": "Подтвердить адрес",
        "reset_subject": "Сброс пароля Helping Hands",
        "reset_heading": "Сброс пароля",
        "reset_body": "Мы получили запрос на сброс пароля вашей учётной записи Helping Hands.",
        "reset_cta": "Создать новый пароль",
        "expiry": "Ссылка истечёт через {hours} ч. Если вы не запрашивали сброс, просто проигнорируйте это письмо.",
    },
    "kz": {
        "verify_subject": "Helping Hands электрондық поштаңызды растаңыз",
        "verify_heading": "Электрондық поштаңызды растаңыз",
        "verify_body": "Helping Hands қызметіне қосылғаныңызға рақмет. Жобаға өтінім беру немесе жоба құру үшін мекенжайыңызды растаңыз.",
        "verify_cta": "Электрондық поштаны растау",
        "reset_subject": "Helping Hands құпиясөзін қалпына келтіру",
        "reset_heading": "Құпиясөзді қалпына келтіру",
        "reset_body": "Helping Hands тіркелгіңіздің құпиясөзін қалпына келтіру сұрауын алдық.",
        "reset_cta": "Жаңа құпиясөз орнату",
        "expiry": "Бұл сілтеменің мерзімі {hours} сағаттан кейін аяқталады. Сұрауды сіз жасамаған болсаңыз, бұл хатты елемеңіз.",
    },
}


def password_meets_requirements(password: str) -> bool:
    return (
        len(password) >= 8
        and any(character.isalpha() for character in password)
        and any(character.isdigit() for character in password)
    )


def validate_new_password(password: str):
    if not password_meets_requirements(password):
        raise HTTPException(status_code=400, detail="weak_password")


def require_verified_email(user):
    if not user["email_verified"]:
        raise HTTPException(status_code=403, detail="email_not_verified")


def auth_token_is_usable(token, now=None) -> bool:
    return bool(token and not token["used_at"] and token["expires_at"] > (now or datetime.utcnow()))


def hash_auth_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_auth_email_copy(lang: str):
    return AUTH_EMAIL_COPY.get(lang, AUTH_EMAIL_COPY["en"])


def send_auth_email(recipient: str, subject: str, heading: str, body: str, cta: str, link: str, expiry: str):
    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP_HOST is not configured")

    username = os.getenv("SMTP_USER", "")
    sender = os.getenv("SMTP_FROM") or username
    if not sender:
        raise RuntimeError("SMTP_FROM or SMTP_USER must be configured")

    safe_heading = html.escape(heading)
    safe_body = html.escape(body)
    safe_cta = html.escape(cta)
    safe_link = html.escape(link, quote=True)
    safe_expiry = html.escape(expiry)
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(f"{heading}\n\n{body}\n\n{link}\n\n{expiry}")
    message.add_alternative(
        f"""\
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:32px;color:#1f2a24">
          <div style="height:6px;background:#2e6b4e;border-radius:6px;margin-bottom:28px"></div>
          <h1 style="color:#2e6b4e">{safe_heading}</h1>
          <p>{safe_body}</p>
          <p><a href="{safe_link}" style="display:inline-block;background:#2e6b4e;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none">{safe_cta}</a></p>
          <p style="color:#6b756e;font-size:14px">{safe_expiry}</p>
        </div>
        """,
        subtype="html",
    )

    port = int(os.getenv("SMTP_PORT", "587"))
    timeout = 15
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=timeout, context=ssl.create_default_context()) as server:
            if username:
                server.login(username, os.getenv("SMTP_PASSWORD", ""))
            server.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=timeout) as server:
            server.starttls(context=ssl.create_default_context())
            if username:
                server.login(username, os.getenv("SMTP_PASSWORD", ""))
            server.send_message(message)


def create_auth_token(cursor, user_id: int, purpose: str, expiry: timedelta):
    token = secrets.token_urlsafe(32)
    cursor.execute(
        "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) "
        "VALUES (%s, %s, %s, %s);",
        (user_id, purpose, hash_auth_token(token), datetime.utcnow() + expiry),
    )
    return token


def auth_link(route: str, token: str, lang: str, email=None) -> str:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    email_param = f"&email={quote(email)}" if email else ""
    return f"{frontend_url}/#{route}?token={quote(token)}&lang={quote(lang)}{email_param}"


def get_db_connection():
    if not DB_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)


@app.on_event("startup")
def ensure_project_management_schema():
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured")
    conn = get_db_connection()
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "ALTER TABLE public.projects "
                    "ADD COLUMN IF NOT EXISTS applications_open boolean NOT NULL DEFAULT true;"
                )
                cursor.execute(
                    "ALTER TABLE public.projects "
                    "ADD COLUMN IF NOT EXISTS cancellation_reason text;"
                )
                cursor.execute(
                    "ALTER TABLE public.users "
                    "ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;"
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.auth_tokens (
                        token_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        user_id integer NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
                        purpose varchar(32) NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
                        token_hash char(64) NOT NULL UNIQUE,
                        created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at timestamp without time zone NOT NULL,
                        used_at timestamp without time zone
                    );
                    """
                )
    finally:
        conn.close()


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
            "INSERT INTO users (full_name, email, password_hash, role, email_verified) "
            "VALUES (%s, %s, %s, %s, false) RETURNING user_id, full_name, email, role;",
            (request.full_name, request.email, secure_password_hash, request.role)
        )
        new_user = cursor.fetchone()

        # Автоматически создаем пустую запись в таблице профилей в зависимости от роли
        if request.role == 'volunteer':
            cursor.execute("INSERT INTO volunteer_profiles (user_id) VALUES (%s);", (new_user['user_id'],))
        elif request.role == 'organizer':
            cursor.execute("INSERT INTO organization_profiles (user_id, company_name) VALUES (%s, %s);",
                           (new_user['user_id'], request.full_name + " Company"))

        token = create_auth_token(cursor, new_user["user_id"], "email_verification", timedelta(hours=24))
        lang = request.lang if request.lang in AUTH_EMAIL_COPY else "en"
        copy = get_auth_email_copy(lang)
        send_auth_email(
            request.email,
            copy["verify_subject"],
            copy["verify_heading"],
            copy["verify_body"],
            copy["verify_cta"],
            auth_link("/verify-email", token, lang, request.email),
            copy["expiry"].format(hours=24),
        )
        conn.commit()
        return {"message": "Registration successful!", "user": new_user, "email_verified": False}
    except (smtplib.SMTPException, RuntimeError, OSError, ValueError) as e:
        conn.rollback()
        logger.exception("Could not send the registration verification email")
        raise HTTPException(status_code=503, detail="email_delivery_failed") from e
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/auth/resend-verification")
def resend_verification(request: EmailRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT user_id, email_verified FROM users WHERE lower(email) = lower(%s);",
            (request.email.strip(),),
        )
        user = cursor.fetchone()
        if not user or user["email_verified"]:
            return {"message": "If this account needs verification, an email has been sent."}

        cursor.execute(
            """
            SELECT created_at FROM auth_tokens
            WHERE user_id = %s AND purpose = 'email_verification'
            ORDER BY created_at DESC LIMIT 1;
            """,
            (user["user_id"],),
        )
        latest = cursor.fetchone()
        if latest and datetime.utcnow() - latest["created_at"] < timedelta(seconds=60):
            return {"message": "If this account needs verification, an email has been sent."}

        token = create_auth_token(cursor, user["user_id"], "email_verification", timedelta(hours=24))
        lang = request.lang if request.lang in AUTH_EMAIL_COPY else "en"
        copy = get_auth_email_copy(lang)
        send_auth_email(
            request.email,
            copy["verify_subject"],
            copy["verify_heading"],
            copy["verify_body"],
            copy["verify_cta"],
            auth_link("/verify-email", token, lang, request.email),
            copy["expiry"].format(hours=24),
        )
        conn.commit()
        return {"message": "If this account needs verification, an email has been sent."}
    except (smtplib.SMTPException, RuntimeError, OSError, ValueError) as e:
        conn.rollback()
        logger.exception("Could not send a verification email")
        raise HTTPException(status_code=503, detail="email_delivery_failed") from e
    finally:
        cursor.close()
        conn.close()


@app.post("/api/auth/verify-email")
def verify_email(request: AuthTokenRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT t.token_id, t.user_id, t.expires_at, t.used_at, u.email_verified, u.email
            FROM auth_tokens t JOIN users u ON u.user_id = t.user_id
            WHERE t.token_hash = %s AND t.purpose = 'email_verification';
            """,
            (hash_auth_token(request.token),),
        )
        token = cursor.fetchone()
        if not token:
            raise HTTPException(status_code=400, detail="invalid_or_expired")
        if token["email_verified"]:
            return {"status": "already_verified", "email": token["email"]}
        if not auth_token_is_usable(token):
            raise HTTPException(status_code=400, detail="invalid_or_expired")

        cursor.execute("UPDATE users SET email_verified = true WHERE user_id = %s;", (token["user_id"],))
        cursor.execute(
            """
            UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND purpose = 'email_verification' AND used_at IS NULL;
            """,
            (token["user_id"],),
        )
        conn.commit()
        return {"status": "verified", "email": token["email"]}
    except HTTPException:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@app.post("/api/auth/request-password-reset")
def request_password_reset(request: EmailRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id FROM users WHERE lower(email) = lower(%s);", (request.email.strip(),))
        user = cursor.fetchone()
        if user:
            token = create_auth_token(cursor, user["user_id"], "password_reset", timedelta(hours=1))
            lang = request.lang if request.lang in AUTH_EMAIL_COPY else "en"
            copy = get_auth_email_copy(lang)
            send_auth_email(
                request.email,
                copy["reset_subject"],
                copy["reset_heading"],
                copy["reset_body"],
                copy["reset_cta"],
                auth_link("/reset-password", token, lang, request.email),
                copy["expiry"].format(hours=1),
            )
            conn.commit()
        return {"message": "If this email exists, we sent a link"}
    except (smtplib.SMTPException, RuntimeError, OSError, ValueError) as e:
        conn.rollback()
        logger.exception("Could not send a password reset email")
        return {"message": "If this email exists, we sent a link"}
    finally:
        cursor.close()
        conn.close()


@app.post("/api/auth/reset-password")
def reset_password(request: PasswordResetRequest):
    validate_new_password(request.new_password)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT token_id, user_id, expires_at, used_at FROM auth_tokens
            WHERE token_hash = %s AND purpose = 'password_reset' FOR UPDATE;
            """,
            (hash_auth_token(request.token),),
        )
        token = cursor.fetchone()
        if not auth_token_is_usable(token):
            raise HTTPException(status_code=400, detail="invalid_or_expired")

        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE user_id = %s;",
            (hash_password(request.new_password), token["user_id"]),
        )
        cursor.execute(
            """
            UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND purpose = 'password_reset' AND used_at IS NULL;
            """,
            (token["user_id"],),
        )
        conn.commit()
        return {"message": "Password reset successful"}
    except HTTPException:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@app.get("/api/organizers/{organizer_id}/public")
def get_public_organizer(organizer_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT u.user_id, u.full_name, u.avatar_url,
                   op.company_name, op.website, op.description, op.contact_phone,
                   (SELECT COUNT(*) FROM projects p
                    WHERE p.organizer_id = u.user_id AND p.status = 'open' AND p.deleted_at IS NULL) AS open_projects
            FROM users u
            LEFT JOIN organization_profiles op ON op.user_id = u.user_id
            WHERE u.user_id = %s AND u.role = 'organizer';
            """,
            (organizer_id,)
        )
        organizer = cursor.fetchone()
        if not organizer:
            raise HTTPException(status_code=404, detail="Organizer not found")
        return organizer
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/account")
def delete_account(request: DeleteAccountRequest, current_user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password_hash, role FROM users WHERE user_id = %s;", (current_user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect password")

        if user["role"] == "organizer":
            cursor.execute(
                "DELETE FROM registrations WHERE project_id IN (SELECT project_id FROM projects WHERE organizer_id = %s);",
                (current_user_id,)
            )
            cursor.execute("DELETE FROM projects WHERE organizer_id = %s;", (current_user_id,))
        cursor.execute("DELETE FROM registrations WHERE user_id = %s;", (current_user_id,))
        cursor.execute("DELETE FROM users WHERE user_id = %s;", (current_user_id,))
        conn.commit()
        return {"message": "Account deleted"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/auth/change-password")
def change_password(request: ChangePasswordRequest, current_user_id: int = Depends(get_current_user_id)):
    validate_new_password(request.new_password)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password_hash FROM users WHERE user_id = %s;", (current_user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="user_not_found")
        if not verify_password(request.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="current_password_wrong")
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE user_id = %s;",
            (hash_password(request.new_password), current_user_id),
        )
        conn.commit()
        return {"message": "Password changed"}
    except HTTPException:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@app.post("/api/login")
def login_user(request: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id, full_name, email, password_hash, role, avatar_url, email_verified FROM users WHERE email = %s;", (request.email,))
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
                "role": user["role"],
                "avatar_url": user["avatar_url"],
                "email_verified": user["email_verified"],
            }
        }
    finally:
        cursor.close()
        conn.close()


PROJECT_SELECT = """
    SELECT p.project_id, p.title, p.description, p.address, p.city,
           p.start_datetime, p.end_datetime, p.max_capacity, p.status, p.category, p.created_at,
           p.organizer_id, p.applications_open, p.cancellation_reason,
           u.full_name AS organizer_name,
           COALESCE((SELECT COUNT(*) FROM registrations r
                     WHERE r.project_id = p.project_id AND r.status IN ('confirmed', 'attended')), 0) AS confirmed_count
    FROM projects p
    JOIN users u ON p.organizer_id = u.user_id
"""


class ProjectCreateRequest(BaseModel):
    title: str
    description: str = None
    address: str = None
    city: str = None
    category: str = 'General'
    start_datetime: str
    end_datetime: str
    max_capacity: int


class ProjectCancellationRequest(BaseModel):
    reason: str = None


class ProjectApplicationsRequest(BaseModel):
    is_open: bool


@app.get("/api/projects")
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(PROJECT_SELECT + " WHERE p.status IN ('open', 'full') AND p.deleted_at IS NULL ORDER BY p.start_datetime;")
    projects = cursor.fetchall()
    cursor.close()
    conn.close()
    return projects


@app.get("/api/projects/{project_id}")
def get_project(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(PROJECT_SELECT + " WHERE p.project_id = %s AND p.deleted_at IS NULL;", (project_id,))
        project = cursor.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    finally:
        cursor.close()
        conn.close()


def get_owned_project(cursor, project_id: int, current_user_id: int):
    cursor.execute(
        "SELECT organizer_id FROM projects WHERE project_id = %s AND deleted_at IS NULL FOR UPDATE;",
        (project_id,)
    )
    project = cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["organizer_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="Only the project organizer can manage this project")
    return project


@app.post("/api/projects")
def create_project(request: ProjectCreateRequest, user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role, email_verified FROM users WHERE user_id = %s;", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        require_verified_email(user)
        if not user or user['role'] not in ('organizer', 'admin'):
            raise HTTPException(status_code=403, detail="Only organizers can create projects")
        cursor.execute(
            """
            INSERT INTO projects (organizer_id, title, description, address, city, category,
                                  start_datetime, end_datetime, max_capacity, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'open')
            RETURNING project_id;
            """,
            (user_id, request.title, request.description, request.address, request.city, request.category,
             request.start_datetime, request.end_datetime, request.max_capacity)
        )
        new_project = cursor.fetchone()
        conn.commit()
        return {"message": "Project created!", "project_id": new_project['project_id']}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.get("/api/organizers/{organizer_id}/projects")
def get_organizer_projects(organizer_id: int, current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != organizer_id:
        raise HTTPException(status_code=403, detail="You can only access your own projects")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(PROJECT_SELECT + " WHERE p.organizer_id = %s AND p.deleted_at IS NULL ORDER BY p.start_datetime;",
                       (organizer_id,))
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@app.put("/api/projects/{project_id}")
def update_project(project_id: int, request: ProjectCreateRequest,
                   current_user_id: int = Depends(get_current_user_id)):
    if request.max_capacity < 1:
        raise HTTPException(status_code=400, detail="At least one volunteer spot is required")
    try:
        start_datetime = datetime.fromisoformat(request.start_datetime.replace("Z", "+00:00"))
        end_datetime = datetime.fromisoformat(request.end_datetime.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project date")
    if start_datetime.replace(tzinfo=None) >= end_datetime.replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="The end must be after the start")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        get_owned_project(cursor, project_id, current_user_id)
        cursor.execute(
            """
            SELECT COUNT(*) AS approved_count
            FROM registrations
            WHERE project_id = %s AND status IN ('confirmed', 'attended');
            """,
            (project_id,)
        )
        approved_count = cursor.fetchone()["approved_count"]
        if request.max_capacity < approved_count:
            raise HTTPException(status_code=400, detail="Capacity cannot be lower than the number of approved volunteers")
        cursor.execute(
            """
            UPDATE projects
            SET title = %s, description = %s, address = %s, city = %s, category = %s,
                start_datetime = %s, end_datetime = %s, max_capacity = %s,
                status = CASE WHEN status = 'full' AND %s > %s THEN 'open' ELSE status END
            WHERE project_id = %s;
            """,
            (request.title, request.description, request.address, request.city, request.category,
             request.start_datetime, request.end_datetime, request.max_capacity,
             request.max_capacity, approved_count, project_id)
        )
        conn.commit()
        return {"message": "Project updated"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.put("/api/projects/{project_id}/applications")
def update_project_applications(project_id: int, request: ProjectApplicationsRequest,
                                current_user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        get_owned_project(cursor, project_id, current_user_id)
        cursor.execute(
            "UPDATE projects SET applications_open = %s WHERE project_id = %s;",
            (request.is_open, project_id)
        )
        conn.commit()
        return {"message": "Project application setting updated"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.put("/api/projects/{project_id}/cancel")
def cancel_project(project_id: int, request: ProjectCancellationRequest,
                   current_user_id: int = Depends(get_current_user_id)):
    reason = (request.reason or "").strip() or None
    if reason and len(reason) > 500:
        raise HTTPException(status_code=400, detail="Cancellation reason cannot exceed 500 characters")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        get_owned_project(cursor, project_id, current_user_id)
        cursor.execute(
            "UPDATE projects SET status = 'cancelled', cancellation_reason = %s WHERE project_id = %s;",
            (reason, project_id)
        )
        cursor.execute(
            """
            UPDATE registrations
            SET status = 'cancelled'
            WHERE project_id = %s AND status IN ('pending', 'confirmed');
            """,
            (project_id,)
        )
        conn.commit()
        return {"message": "Project cancelled"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, current_user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        get_owned_project(cursor, project_id, current_user_id)
        cursor.execute("DELETE FROM registrations WHERE project_id = %s;", (project_id,))
        cursor.execute("DELETE FROM projects WHERE project_id = %s;", (project_id,))
        conn.commit()
        return {"message": "Project deleted"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# Обновленный эндпоинт: user_id теперь берется безопасно из токена, а не из тела запроса!
@app.post("/api/projects/{project_id}/apply")
def apply_for_project(project_id: int, request: ApplyRequest, user_id: int = Depends(get_current_user_id)):
    motivation = request.motivation.strip()
    if len(motivation) < 20 or len(motivation) > 1000:
        raise HTTPException(status_code=400, detail="Motivation must be between 20 and 1000 characters")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role, email_verified FROM users WHERE user_id = %s;", (user_id,))
        applicant = cursor.fetchone()
        if not applicant:
            raise HTTPException(status_code=404, detail="User not found")
        require_verified_email(applicant)
        if applicant["role"] != "volunteer":
            raise HTTPException(status_code=403, detail="Only volunteers can apply")
        cursor.execute(
            "SELECT status, deleted_at, applications_open FROM projects WHERE project_id = %s FOR UPDATE;",
            (project_id,)
        )
        project = cursor.fetchone()
        if not project or project["deleted_at"]:
            raise HTTPException(status_code=404, detail="Project not found")
        if project["status"] != "open":
            raise HTTPException(status_code=400, detail="This project is not open")
        if not project["applications_open"]:
            raise HTTPException(status_code=400, detail="Applications for this project are closed")
        query = "INSERT INTO registrations (user_id, project_id, motivation) VALUES (%s, %s, %s) RETURNING registration_id;"
        cursor.execute(query, (user_id, project_id, motivation))
        conn.commit()
        return {"message": "Successfully applied for the project!", "project_id": project_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/users/{user_id}/applications")
def get_user_applications(user_id: int, current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own applications")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
                SELECT r.registration_id, \
                       r.status, r.motivation, r.rejection_reason, \
                       p.project_id, \
                       p.title, \
                       p.description, \
                       p.city, \
                       p.start_datetime, \
                       p.status AS project_status, \
                       p.cancellation_reason, \
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
def get_user_profile(user_id: int, current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own profile")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Узнаем роль пользователя
        cursor.execute("SELECT user_id, full_name, email, role, phone, avatar_url FROM users WHERE user_id = %s;", (user_id,))
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# 2. Обновление профиля пользователя
@app.put("/api/profile/{user_id}")
def update_user_profile(user_id: int, request: ProfileUpdateRequest,
                        current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own profile")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role FROM users WHERE user_id = %s;", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        supplied = request.dict(exclude_unset=True)
        if 'avatar_url' in supplied:
            avatar = supplied['avatar_url']
            if avatar is not None:
                allowed = ('data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')
                if not avatar.startswith(allowed) or len(avatar) > 300000:
                    raise HTTPException(status_code=400, detail="Avatar must be a valid JPEG, PNG or WebP image under 300 KB")
            cursor.execute("UPDATE users SET avatar_url = %s WHERE user_id = %s;", (avatar, user_id))

        profile_fields = {
            'volunteer': ('volunteer_profiles', ('skills', 'bio', 'phone')),
            'organizer': ('organization_profiles', ('company_name', 'website', 'description', 'contact_phone')),
        }
        if user['role'] in profile_fields:
            table, allowed_fields = profile_fields[user['role']]
            updates = [(field, supplied[field]) for field in allowed_fields
                       if field in supplied and supplied[field] is not None]
            if updates:
                assignments = ', '.join(f"{field} = %s" for field, _ in updates)
                values = [value for _, value in updates]
                cursor.execute(
                    f"UPDATE {table} SET {assignments} WHERE user_id = %s;",
                    (*values, user_id)
                )

        conn.commit()
        return {"message": "Profile updated successfully!"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# 3. Организатор: просмотр всех заявок на свои проекты
@app.get("/api/organizers/{organizer_id}/applications")
def get_organizer_applications(organizer_id: int, current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != organizer_id:
        raise HTTPException(status_code=403, detail="You can only access your own organizer applications")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            SELECT r.registration_id, r.status, r.registered_at, r.motivation, r.rejection_reason,
                   p.project_id, p.title as project_title,
                   u.user_id as volunteer_id, u.full_name as volunteer_name, u.email as volunteer_email,
                   u.avatar_url as volunteer_avatar_url, vp.skills, vp.phone as volunteer_phone
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
def update_application_status(registration_id: int, request: StatusUpdateRequest,
                              current_user_id: int = Depends(get_current_user_id)):
    if request.status not in ['confirmed', 'cancelled', 'pending']:
        raise HTTPException(status_code=400, detail="Invalid status value")
    if request.status == 'cancelled':
        reason = (request.rejection_reason or '').strip()
        if len(reason) < 5 or len(reason) > 500:
            raise HTTPException(status_code=400, detail="Rejection reason must be between 5 and 500 characters")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT p.organizer_id
            FROM registrations r
            JOIN projects p ON p.project_id = r.project_id
            WHERE r.registration_id = %s;
            """,
            (registration_id,)
        )
        application = cursor.fetchone()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        if application["organizer_id"] != current_user_id:
            raise HTTPException(status_code=403, detail="Only the project organizer can change this application")

        reason = (request.rejection_reason or '').strip() if request.status == 'cancelled' else None
        cursor.execute(
            "UPDATE registrations SET status = %s, rejection_reason = %s WHERE registration_id = %s RETURNING registration_id, status, rejection_reason;",
            (request.status, reason, registration_id)
        )
        updated = cursor.fetchone()

        conn.commit()
        return {"message": f"Application status updated to {request.status}", "application": updated}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/applications/{registration_id}")
def remove_volunteer_application(registration_id: int, current_user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id FROM registrations WHERE registration_id = %s;", (registration_id,))
        application = cursor.fetchone()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        if application["user_id"] != current_user_id:
            raise HTTPException(status_code=403, detail="You can only withdraw your own application")
        # Удаляем запись из таблицы регистраций/заявок по ID заявки
        cursor.execute("DELETE FROM registrations WHERE registration_id = %s;", (registration_id,))
        conn.commit()
        return {"message": "Volunteer application successfully deleted"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()