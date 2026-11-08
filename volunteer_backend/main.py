from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor

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