from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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
ACCESS_TOKEN_EXPIRE_MINUTES = 30


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
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


class ApplyRequest(BaseModel):
    motivation: str


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password_hash: str
    role: str = 'volunteer'
    lang: str = "en"
    org_mode: str = "create"  # "create" | "join"
    company_name: Optional[str] = None
    invite_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password_hash: str


class ProfileUpdateRequest(BaseModel):
    skills: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    contact_phone: Optional[str] = None
    avatar_url: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    status: str
    rejection_reason: Optional[str] = None
    expected_status: Optional[str] = None


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


class OrganizationMemberAction(BaseModel):
    action: str  # "approve" | "remove" | "make_super"


class ProjectCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    category: str = 'General'
    start_datetime: str
    end_datetime: str
    max_capacity: int
    version: Optional[int] = None


class ProjectCancellationRequest(BaseModel):
    reason: Optional[str] = None


class ProjectApplicationsRequest(BaseModel):
    is_open: bool


app = FastAPI(title="Volunteer Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DATABASE_URL")

PROJECT_SELECT = """
    SELECT p.project_id, p.title, p.description, p.address, p.city,
           p.start_datetime, p.end_datetime, p.max_capacity, p.status, p.category, p.created_at,
           p.organizer_id, p.organization_id, p.applications_open, p.cancellation_reason, p.version,
           u.full_name AS organizer_name,
           o.company_name AS company_name,
           COALESCE((SELECT COUNT(*) FROM registrations r
                     WHERE r.project_id = p.project_id AND r.status IN ('confirmed', 'attended')), 0) AS confirmed_count
    FROM projects p
    JOIN users u ON p.organizer_id = u.user_id
    LEFT JOIN organizations o ON p.organization_id = o.organization_id
"""

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


def generate_invite_code() -> str:
    return secrets.token_hex(4).upper()


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


def get_user_org_membership(cursor, user_id: int):
    cursor.execute(
        """
        SELECT om.organization_id, om.org_role, om.status AS org_status,
               o.company_name, o.website, o.description, o.contact_phone,
               CASE WHEN om.org_role = 'super_organizer' THEN o.invite_code ELSE NULL END AS invite_code
        FROM organization_members om
        JOIN organizations o ON o.organization_id = om.organization_id
        WHERE om.user_id = %s;
        """,
        (user_id,),
    )
    return cursor.fetchone()


def serialize_user_payload(cursor, user_row):
    payload = {
        "user_id": user_row["user_id"],
        "full_name": user_row["full_name"],
        "email": user_row["email"],
        "role": user_row["role"],
        "avatar_url": user_row["avatar_url"],
        "email_verified": user_row["email_verified"],
    }
    if user_row["role"] in ("organizer", "admin"):
        member = get_user_org_membership(cursor, user_row["user_id"])
        if member:
            payload.update({
                "organization_id": member["organization_id"],
                "org_role": member["org_role"],
                "org_status": member["org_status"],
                "company_name": member["company_name"],
            })
    return payload


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
                    "ALTER TABLE public.projects "
                    "ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;"
                )
                cursor.execute(
                    "ALTER TABLE public.users "
                    "ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;"
                )
                cursor.execute(
                    "ALTER TABLE public.users "
                    "ADD COLUMN IF NOT EXISTS avatar_url text;"
                )
                cursor.execute(
                    "ALTER TABLE public.registrations "
                    "ADD COLUMN IF NOT EXISTS motivation text;"
                )
                cursor.execute(
                    "ALTER TABLE public.registrations "
                    "ADD COLUMN IF NOT EXISTS rejection_reason text;"
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
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.organizations (
                        organization_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        company_name varchar(150) NOT NULL,
                        website varchar(255),
                        description text,
                        contact_phone varchar(20),
                        invite_code varchar(32) NOT NULL UNIQUE,
                        created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.organization_members (
                        member_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        organization_id integer NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
                        user_id integer NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
                        org_role varchar(20) NOT NULL CHECK (org_role IN ('super_organizer', 'organizer')),
                        status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
                        joined_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_one_super_organizer_per_org
                    ON public.organization_members (organization_id)
                    WHERE org_role = 'super_organizer' AND status = 'active';
                    """
                )
                cursor.execute(
                    "ALTER TABLE public.projects "
                    "ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES public.organizations(organization_id) ON DELETE CASCADE;"
                )
                cursor.execute(
                    "ALTER TABLE public.organization_profiles "
                    "ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES public.organizations(organization_id) ON DELETE SET NULL;"
                )
    finally:
        conn.close()


@app.get("/")
def read_root():
    return {"message": "Backend is running!"}


@app.post("/api/register")
def register_user(request: RegisterRequest):
    if request.role not in ("volunteer", "organizer"):
        raise HTTPException(status_code=400, detail="Invalid role")

    secure_password_hash = hash_password(request.password_hash)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        join_org_id = None
        if request.role == 'organizer' and request.org_mode == "join":
            code = (request.invite_code or "").strip().upper()
            if not code:
                raise HTTPException(status_code=400, detail="invalid_invite_code")
            cursor.execute("SELECT organization_id FROM organizations WHERE invite_code = %s;", (code,))
            org = cursor.fetchone()
            if not org:
                raise HTTPException(status_code=400, detail="invalid_invite_code")
            join_org_id = org["organization_id"]

        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash, role, email_verified) "
            "VALUES (%s, %s, %s, %s, false) RETURNING user_id, full_name, email, role;",
            (request.full_name, request.email.strip(), secure_password_hash, request.role),
        )
        new_user = cursor.fetchone()

        if request.role == 'volunteer':
            cursor.execute("INSERT INTO volunteer_profiles (user_id) VALUES (%s);", (new_user['user_id'],))
        elif request.role == 'organizer':
            if request.org_mode == "join":
                cursor.execute(
                    """
                    INSERT INTO organization_members (organization_id, user_id, org_role, status)
                    VALUES (%s, %s, 'organizer', 'pending');
                    """,
                    (join_org_id, new_user["user_id"]),
                )
            else:
                company = (request.company_name or "").strip() or (request.full_name + " Company")
                cursor.execute(
                    """
                    INSERT INTO organizations (company_name, invite_code)
                    VALUES (%s, %s) RETURNING organization_id;
                    """,
                    (company, generate_invite_code()),
                )
                org_id = cursor.fetchone()["organization_id"]
                cursor.execute(
                    """
                    INSERT INTO organization_members (organization_id, user_id, org_role, status)
                    VALUES (%s, %s, 'super_organizer', 'active');
                    """,
                    (org_id, new_user["user_id"]),
                )
                cursor.execute(
                    "INSERT INTO organization_profiles (user_id, company_name, organization_id) VALUES (%s, %s, %s);",
                    (new_user["user_id"], company, org_id),
                )

        token = create_auth_token(cursor, new_user["user_id"], "email_verification", timedelta(hours=24))
        lang = request.lang if request.lang in AUTH_EMAIL_COPY else "en"
        copy = get_auth_email_copy(lang)
        send_auth_email(
            request.email.strip(),
            copy["verify_subject"],
            copy["verify_heading"],
            copy["verify_body"],
            copy["verify_cta"],
            auth_link("/verify-email", token, lang, request.email.strip()),
            copy["expiry"].format(hours=24),
        )
        conn.commit()
        return {"message": "Registration successful!", "user": new_user, "email_verified": False}
    except HTTPException:
        conn.rollback()
        raise
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
            request.email.strip(),
            copy["verify_subject"],
            copy["verify_heading"],
            copy["verify_body"],
            copy["verify_cta"],
            auth_link("/verify-email", token, lang, request.email.strip()),
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
                request.email.strip(),
                copy["reset_subject"],
                copy["reset_heading"],
                copy["reset_body"],
                copy["reset_cta"],
                auth_link("/reset-password", token, lang, request.email.strip()),
                copy["expiry"].format(hours=1),
            )
            conn.commit()
        return {"message": "If this email exists, we sent a link"}
    except (smtplib.SMTPException, RuntimeError, OSError, ValueError):
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


@app.get("/api/auth/me")
def get_current_session_user(current_user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT user_id, full_name, email, role, avatar_url, email_verified FROM users WHERE user_id = %s;",
            (current_user_id,),
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_user_payload(cursor, user)
    finally:
        cursor.close()
        conn.close()


@app.post("/api/login")
def login_user(request: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT user_id, full_name, email, password_hash, role, avatar_url, email_verified FROM users WHERE lower(email) = lower(%s);",
            (request.email.strip(),),
        )
        user = cursor.fetchone()

        if not user or not verify_password(request.password_hash, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"], "role": user["role"], "user_id": user["user_id"]},
            expires_delta=access_token_expires,
        )

        return {
            "message": "Login successful!",
            "access_token": access_token,
            "token_type": "bearer",
            "user": serialize_user_payload(cursor, user),
        }
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
                   COALESCE(o.company_name, op.company_name) AS company_name,
                   COALESCE(o.website, op.website) AS website,
                   COALESCE(o.description, op.description) AS description,
                   COALESCE(o.contact_phone, op.contact_phone) AS contact_phone,
                   om.organization_id,
                   (SELECT COUNT(*) FROM projects p
                    WHERE (p.organizer_id = u.user_id OR (om.organization_id IS NOT NULL AND p.organization_id = om.organization_id))
                      AND p.status = 'open' AND p.deleted_at IS NULL) AS open_projects
            FROM users u
            LEFT JOIN organization_members om ON om.user_id = u.user_id AND om.status = 'active'
            LEFT JOIN organizations o ON o.organization_id = om.organization_id
            LEFT JOIN organization_profiles op ON op.user_id = u.user_id
            WHERE u.user_id = %s AND u.role IN ('organizer', 'admin');
            """,
            (organizer_id,),
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


@app.get("/api/organizers/{organizer_id}/public/projects")
def get_public_organizer_projects(organizer_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            PROJECT_SELECT + """
            WHERE p.deleted_at IS NULL AND p.status = 'open'
              AND (
                p.organizer_id = %s
                OR p.organization_id = (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = %s AND status = 'active' LIMIT 1
                )
              )
            ORDER BY p.start_datetime;
            """,
            (organizer_id, organizer_id),
        )
        return cursor.fetchall()
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

        if user["role"] in ("organizer", "admin"):
            member = get_user_org_membership(cursor, current_user_id)
            if member:
                org_id = member["organization_id"]
                cursor.execute(
                    "SELECT user_id FROM organization_members WHERE organization_id = %s AND user_id != %s AND status = 'active';",
                    (org_id, current_user_id),
                )
                other_active = cursor.fetchall()
                if member["org_role"] == "super_organizer":
                    if other_active:
                        raise HTTPException(
                            status_code=400,
                            detail="Transfer the super organizer role to a colleague before deleting your account",
                        )
                    cursor.execute(
                        "DELETE FROM registrations WHERE project_id IN (SELECT project_id FROM projects WHERE organization_id = %s);",
                        (org_id,),
                    )
                    cursor.execute("DELETE FROM projects WHERE organization_id = %s;", (org_id,))
                    cursor.execute("DELETE FROM organizations WHERE organization_id = %s;", (org_id,))
                else:
                    cursor.execute(
                        "SELECT user_id FROM organization_members WHERE organization_id = %s AND org_role = 'super_organizer' AND status = 'active' LIMIT 1;",
                        (org_id,),
                    )
                    super_row = cursor.fetchone()
                    if super_row:
                        cursor.execute(
                            "UPDATE projects SET organizer_id = %s WHERE organization_id = %s AND organizer_id = %s;",
                            (super_row["user_id"], org_id, current_user_id),
                        )
                    cursor.execute("DELETE FROM organization_members WHERE user_id = %s;", (current_user_id,))
            else:
                cursor.execute(
                    "DELETE FROM registrations WHERE project_id IN (SELECT project_id FROM projects WHERE organizer_id = %s);",
                    (current_user_id,),
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


def get_company_project(cursor, project_id: int, current_user_id: int, require_author_or_super: bool = True):
    cursor.execute(
        """
        SELECT p.project_id, p.organizer_id, p.organization_id, p.status, p.deleted_at, p.version,
               om.org_role, om.status AS member_status
        FROM projects p
        LEFT JOIN organization_members om
          ON om.organization_id = p.organization_id AND om.user_id = %s
        WHERE p.project_id = %s AND p.deleted_at IS NULL
        FOR UPDATE OF p;
        """,
        (current_user_id, project_id),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    if row["organization_id"] is not None:
        if not row["org_role"] or row["member_status"] != "active":
            raise HTTPException(status_code=403, detail="Only active members of this company can manage its projects")
        if require_author_or_super and row["org_role"] != "super_organizer" and row["organizer_id"] != current_user_id:
            raise HTTPException(status_code=403, detail="Only the project author or super organizer can modify this project")
    elif row["organizer_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="Only the project organizer can manage this project")
    return row


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
        if user['role'] not in ('organizer', 'admin'):
            raise HTTPException(status_code=403, detail="Only organizers can create projects")

        member = get_user_org_membership(cursor, user_id)
        if user['role'] == 'organizer':
            if not member or member["org_status"] != "active":
                raise HTTPException(status_code=403, detail="Your organization membership is pending approval")
        org_id = member["organization_id"] if member else None

        cursor.execute(
            """
            INSERT INTO projects (organizer_id, organization_id, title, description, address, city, category,
                                  start_datetime, end_datetime, max_capacity, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'open')
            RETURNING project_id;
            """,
            (user_id, org_id, request.title, request.description, request.address, request.city, request.category,
             request.start_datetime, request.end_datetime, request.max_capacity),
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
        member = get_user_org_membership(cursor, current_user_id)
        if member:
            if member["org_status"] != "active":
                return []
            cursor.execute(
                PROJECT_SELECT + " WHERE p.organization_id = %s AND p.deleted_at IS NULL ORDER BY p.start_datetime;",
                (member["organization_id"],),
            )
            return cursor.fetchall()
        cursor.execute(
            PROJECT_SELECT + " WHERE p.organizer_id = %s AND p.deleted_at IS NULL ORDER BY p.start_datetime;",
            (organizer_id,),
        )
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
        project = get_company_project(cursor, project_id, current_user_id, require_author_or_super=True)
        if request.version is not None and project["version"] != request.version:
            raise HTTPException(status_code=409, detail="Project was updated by another organizer. Please refresh.")
        cursor.execute(
            """
            SELECT COUNT(*) AS approved_count
            FROM registrations
            WHERE project_id = %s AND status IN ('confirmed', 'attended');
            """,
            (project_id,),
        )
        approved_count = cursor.fetchone()["approved_count"]
        if request.max_capacity < approved_count:
            raise HTTPException(status_code=400, detail="Capacity cannot be lower than the number of approved volunteers")
        cursor.execute(
            """
            UPDATE projects
            SET title = %s, description = %s, address = %s, city = %s, category = %s,
                start_datetime = %s, end_datetime = %s, max_capacity = %s,
                status = CASE WHEN status = 'full' AND %s > %s THEN 'open' ELSE status END,
                version = version + 1
            WHERE project_id = %s;
            """,
            (request.title, request.description, request.address, request.city, request.category,
             request.start_datetime, request.end_datetime, request.max_capacity,
             request.max_capacity, approved_count, project_id),
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
        get_company_project(cursor, project_id, current_user_id, require_author_or_super=True)
        cursor.execute(
            "UPDATE projects SET applications_open = %s, version = version + 1 WHERE project_id = %s;",
            (request.is_open, project_id),
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
        get_company_project(cursor, project_id, current_user_id, require_author_or_super=True)
        cursor.execute(
            "UPDATE projects SET status = 'cancelled', cancellation_reason = %s, version = version + 1 WHERE project_id = %s;",
            (reason, project_id),
        )
        cursor.execute(
            """
            UPDATE registrations
            SET status = 'cancelled'
            WHERE project_id = %s AND status IN ('pending', 'confirmed');
            """,
            (project_id,),
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
        get_company_project(cursor, project_id, current_user_id, require_author_or_super=True)
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
            (project_id,),
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
                SELECT r.registration_id,
                       r.status, r.motivation, r.rejection_reason,
                       p.project_id,
                       p.title,
                       p.description,
                       p.city,
                       p.start_datetime,
                       p.status AS project_status,
                       p.cancellation_reason,
                       p.category,
                       u.full_name as organizer_name
                FROM registrations r
                         JOIN projects p ON r.project_id = p.project_id
                         JOIN users u ON p.organizer_id = u.user_id
                WHERE r.user_id = %s;
                """
        cursor.execute(query, (user_id,))
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.get("/api/profile/{user_id}")
def get_user_profile(user_id: int, current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own profile")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id, full_name, email, role, phone, avatar_url FROM users WHERE user_id = %s;", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        profile_data = dict(user)

        if user['role'] == 'volunteer':
            cursor.execute("SELECT skills, bio, phone FROM volunteer_profiles WHERE user_id = %s;", (user_id,))
            vol_profile = cursor.fetchone()
            if vol_profile:
                profile_data.update(vol_profile)
        elif user['role'] in ('organizer', 'admin'):
            member = get_user_org_membership(cursor, user_id)
            if member:
                profile_data.update(member)
            else:
                cursor.execute(
                    "SELECT company_name, website, description, contact_phone FROM organization_profiles WHERE user_id = %s;",
                    (user_id,),
                )
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

        if user['role'] == 'volunteer':
            allowed_fields = ('skills', 'bio', 'phone')
            updates = [(field, supplied[field]) for field in allowed_fields
                       if field in supplied and supplied[field] is not None]
            if updates:
                assignments = ', '.join(f"{field} = %s" for field, _ in updates)
                values = [value for _, value in updates]
                cursor.execute(f"UPDATE volunteer_profiles SET {assignments} WHERE user_id = %s;", (*values, user_id))
        elif user['role'] in ('organizer', 'admin'):
            org_fields = ('company_name', 'website', 'description', 'contact_phone')
            updates = [(field, supplied[field]) for field in org_fields
                       if field in supplied and supplied[field] is not None]
            if updates:
                member = get_user_org_membership(cursor, user_id)
                if member:
                    if member["org_status"] != "active" or member["org_role"] != "super_organizer":
                        raise HTTPException(status_code=403, detail="Only the super organizer can edit company details")
                    assignments = ', '.join(f"{field} = %s" for field, _ in updates)
                    values = [value for _, value in updates]
                    cursor.execute(
                        f"UPDATE organizations SET {assignments} WHERE organization_id = %s;",
                        (*values, member["organization_id"]),
                    )
                    cursor.execute(
                        f"UPDATE organization_profiles SET {assignments} WHERE organization_id = %s;",
                        (*values, member["organization_id"]),
                    )
                else:
                    assignments = ', '.join(f"{field} = %s" for field, _ in updates)
                    values = [value for _, value in updates]
                    cursor.execute(
                        f"UPDATE organization_profiles SET {assignments} WHERE user_id = %s;",
                        (*values, user_id),
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


@app.get("/api/organization/members")
def list_org_members(current_user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        me = get_user_org_membership(cursor, current_user_id)
        if not me:
            return {"organization": None, "members": []}
        if me["org_status"] != "active":
            return {"organization": {"company_name": me["company_name"], "org_role": me["org_role"], "org_status": me["org_status"]}, "members": []}
        cursor.execute(
            """
            SELECT u.user_id, u.full_name, u.email, u.avatar_url,
                   om.org_role, om.status, om.joined_at
            FROM organization_members om
            JOIN users u ON u.user_id = om.user_id
            WHERE om.organization_id = %s
            ORDER BY (om.org_role = 'super_organizer') DESC, (om.status = 'pending') DESC, om.joined_at ASC;
            """,
            (me["organization_id"],),
        )
        return {"organization": me, "members": cursor.fetchall()}
    finally:
        cursor.close()
        conn.close()


@app.post("/api/organization/members/{target_user_id}")
def manage_org_member(
    target_user_id: int,
    body: OrganizationMemberAction,
    current_user_id: int = Depends(get_current_user_id),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        me = get_user_org_membership(cursor, current_user_id)
        if not me or me["org_status"] != "active" or me["org_role"] != "super_organizer":
            raise HTTPException(status_code=403, detail="Only super organizer can manage company team")
        if target_user_id == current_user_id:
            raise HTTPException(status_code=400, detail="Cannot apply this action to yourself")

        org_id = me["organization_id"]
        cursor.execute(
            "SELECT member_id, status FROM organization_members WHERE organization_id = %s AND user_id = %s FOR UPDATE;",
            (org_id, target_user_id),
        )
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Member not found")

        if body.action == "approve":
            cursor.execute("UPDATE organization_members SET status = 'active' WHERE member_id = %s;", (target["member_id"],))
            cursor.execute(
                """
                INSERT INTO organization_profiles (user_id, company_name, website, description, contact_phone, organization_id)
                SELECT %s, company_name, website, description, contact_phone, organization_id
                FROM organizations WHERE organization_id = %s
                ON CONFLICT (user_id) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    website = EXCLUDED.website,
                    description = EXCLUDED.description,
                    contact_phone = EXCLUDED.contact_phone,
                    organization_id = EXCLUDED.organization_id;
                """,
                (target_user_id, org_id),
            )
        elif body.action == "remove":
            cursor.execute(
                "UPDATE projects SET organizer_id = %s WHERE organization_id = %s AND organizer_id = %s;",
                (current_user_id, org_id, target_user_id),
            )
            cursor.execute("DELETE FROM organization_members WHERE member_id = %s;", (target["member_id"],))
        elif body.action == "make_super":
            if target["status"] != "active":
                raise HTTPException(status_code=400, detail="Approve this organizer before transferring super role")
            cursor.execute(
                "UPDATE organization_members SET org_role = 'organizer' WHERE organization_id = %s AND user_id = %s;",
                (org_id, current_user_id),
            )
            cursor.execute(
                "UPDATE organization_members SET org_role = 'super_organizer' WHERE member_id = %s;",
                (target["member_id"],),
            )
        else:
            raise HTTPException(status_code=400, detail="Unknown action")

        conn.commit()
        return {"message": "Member updated"}
    except HTTPException:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@app.get("/api/organizers/{organizer_id}/applications")
def get_organizer_applications(organizer_id: int, current_user_id: int = Depends(get_current_user_id)):
    if current_user_id != organizer_id:
        raise HTTPException(status_code=403, detail="You can only access your own organizer applications")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        member = get_user_org_membership(cursor, current_user_id)
        if member:
            if member["org_status"] != "active":
                return []
            cursor.execute(
                """
                SELECT r.registration_id, r.status, r.registered_at, r.motivation, r.rejection_reason,
                       p.project_id, p.title as project_title,
                       u.user_id as volunteer_id, u.full_name as volunteer_name, u.email as volunteer_email,
                       u.avatar_url as volunteer_avatar_url, vp.skills, vp.phone as volunteer_phone
                FROM registrations r
                JOIN projects p ON r.project_id = p.project_id
                JOIN users u ON r.user_id = u.user_id
                LEFT JOIN volunteer_profiles vp ON u.user_id = vp.user_id
                WHERE p.organization_id = %s AND p.deleted_at IS NULL;
                """,
                (member["organization_id"],),
            )
            return cursor.fetchall()

        cursor.execute(
            """
            SELECT r.registration_id, r.status, r.registered_at, r.motivation, r.rejection_reason,
                   p.project_id, p.title as project_title,
                   u.user_id as volunteer_id, u.full_name as volunteer_name, u.email as volunteer_email,
                   u.avatar_url as volunteer_avatar_url, vp.skills, vp.phone as volunteer_phone
            FROM registrations r
            JOIN projects p ON r.project_id = p.project_id
            JOIN users u ON r.user_id = u.user_id
            LEFT JOIN volunteer_profiles vp ON u.user_id = vp.user_id
            WHERE p.organizer_id = %s AND p.deleted_at IS NULL;
            """,
            (organizer_id,),
        )
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


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
            SELECT r.registration_id, r.status AS current_status, r.project_id,
                   p.organizer_id, p.organization_id, p.status AS project_status, p.max_capacity,
                   om.status AS member_status
            FROM registrations r
            JOIN projects p ON p.project_id = r.project_id
            LEFT JOIN organization_members om
              ON om.organization_id = p.organization_id AND om.user_id = %s
            WHERE r.registration_id = %s AND p.deleted_at IS NULL
            FOR UPDATE OF r, p;
            """,
            (current_user_id, registration_id),
        )
        application = cursor.fetchone()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        if application["organization_id"] is not None:
            if application["member_status"] != "active":
                raise HTTPException(status_code=403, detail="Only active company organizers can change this application")
        elif application["organizer_id"] != current_user_id:
            raise HTTPException(status_code=403, detail="Only the project organizer can change this application")

        if application["project_status"] == "cancelled":
            raise HTTPException(status_code=400, detail="Cannot change applications of a cancelled project")

        if request.expected_status and application["current_status"] != request.expected_status:
            raise HTTPException(status_code=409, detail="Application was already processed by another organizer. Please refresh.")

        if request.status == 'confirmed' and application["current_status"] != 'confirmed':
            cursor.execute(
                "SELECT COUNT(*) AS cnt FROM registrations WHERE project_id = %s AND status IN ('confirmed', 'attended');",
                (application["project_id"],),
            )
            if cursor.fetchone()["cnt"] >= application["max_capacity"]:
                raise HTTPException(status_code=409, detail="Project is already full")

        reason = (request.rejection_reason or '').strip() if request.status == 'cancelled' else None
        cursor.execute(
            "UPDATE registrations SET status = %s, rejection_reason = %s WHERE registration_id = %s RETURNING registration_id, status, rejection_reason;",
            (request.status, reason, registration_id),
        )
        updated = cursor.fetchone()

        if request.status != 'confirmed':
            cursor.execute(
                """
                UPDATE projects SET status = 'open'
                WHERE project_id = %s AND status = 'full'
                  AND (SELECT COUNT(*) FROM registrations WHERE project_id = %s AND status IN ('confirmed', 'attended')) < max_capacity;
                """,
                (application["project_id"], application["project_id"]),
            )

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