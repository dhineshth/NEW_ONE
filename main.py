from fastapi import FastAPI, HTTPException, Depends, Header, Query, UploadFile, File, Form, Request, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from datetime import datetime, date
import bcrypt
import os
from dotenv import load_dotenv
from typing import Optional, List, Any, Dict
import uuid
from datetime import datetime, timedelta
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
import tempfile
import aiofiles
from io import BytesIO

# Async imports
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


from llama.llama_utils import initialize_llama_parser
from parsing.parsing_utils import parse_resume
from gemini.gemini_utils import analyze_resume_comprehensive, initialize_gemini
from mongodb.mongodb_db import (
    initialize_mongodb,
    fetch_analysis_history,
    fetch_client_names,
    fetch_client_details_by_jd,
    fetch_jd_names_for_client,
    store_results_in_mongodb,
    update_job_description,
    count_pages,
    initialize_usage_tracking,
    increment_usage,
    get_current_month_usage,
    check_usage_limit,
    get_company_page_limit,
    get_usage_stats,
    log_audit_trail
)
from utils.common_utils import to_init_caps

import google.generativeai as genai
from llama_parse import LlamaParse

load_dotenv()
# JWT Token
from jose import jwt, JWTError
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

ACCESS_SECRET_KEY  = os.getenv("JWT_SECRET_KEY", "secret123")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", "refresh123")
ALGORITHM          = "HS256"
ACCESS_EXPIRE_MIN = 60 * 4     # Access token valid for 4 hours
REFRESH_EXPIRE_DAYS = 7      # Refresh token valid for 7 days

security = HTTPBearer()

# Rate limiter
DEFAULT_LIMIT = os.getenv("RATE_LIMIT_DEFAULT", "100/minute")
AUTH_LIMIT = os.getenv("RATE_LIMIT_AUTH", "100/minute")
UPLOAD_LIMIT = os.getenv("RATE_LIMIT_UPLOAD", "50/minute")
ADMIN_LIMIT = os.getenv("RATE_LIMIT_ADMIN", "100/minute")
HIGH_TRAFFIC_LIMIT = os.getenv("RATE_LIMIT_HIGH_TRAFFIC", "200/minute")
limiter = Limiter(key_func=get_remote_address)


# --------------------
# Environment / Clients
# --------------------
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

# Async MongoDB client
client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]

# Collections
col_super_admins = db["super_admins"]
col_companies = db["companies"]
col_company_users = db["company_users"]
col_password_resets = db["password_resets"]
col_banks = db["banks"]
audit_collection = db["audit_logs"]

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT")) if os.getenv("SMTP_PORT") else None
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI()

# Add SlowAPI middleware
app.add_middleware(SlowAPIMiddleware)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
def get_rate_limit(limit_type: str = "default") -> str:
    """
    Get rate limit from environment variables based on type
    """
    limits = {
        "default": DEFAULT_LIMIT,
        "auth": AUTH_LIMIT,
        "upload": UPLOAD_LIMIT,
        "admin": ADMIN_LIMIT,
        "high_traffic": HIGH_TRAFFIC_LIMIT
    }
    return limits.get(limit_type, DEFAULT_LIMIT)
# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# --------------------
# Models
# --------------------
class LoginRequest(BaseModel):
    email: str
    password: str

class CompanyCreate(BaseModel):
    name: str
    admin_email: str
    admin_password: str
    gemini_api_key: Optional[str] = None
    llama_api_key: Optional[str] = None
    gemini_model: Optional[str] = "gemini-2.0-flash"
    monthly_page_limit: Optional[int] = Field(default=1000, description="Monthly page limit for analysis")
    # New fields
    logo_url: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    legal_name: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    quotation_prefix: Optional[str] = None
    registered_address: Optional[str] = None
    
    # Compliance details
    gst: Optional[str] = None
    
    # Bank details
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_address: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # 'active' or 'inactive'
    gemini_api_key: Optional[str] = None
    llama_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    monthly_page_limit: Optional[int] = None
    # New fields
    logo_url: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    legal_name: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    quotation_prefix: Optional[str] = None
    registered_address: Optional[str] = None
    
    # Compliance details
    gst: Optional[str] = None
    
    # Bank details
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_address: Optional[str] = None

class CompanyStatusUpdate(BaseModel):
    status: str
    reason: str

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None       # 'male' | 'female' | 'other'
    dob: Optional[date] = None
    age: Optional[int] = None
    mobile: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None
    role: Optional[str] = None         # ignored; always 'user'
    company_id: str
    status: Optional[str] = 'active'
    profile_photo_url: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    age: Optional[int] = None
    mobile: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None
    role: Optional[str] = None
    company_id: Optional[str] = None
    status: Optional[str] = None
    profile_photo_url: Optional[str] = None

class UserStatusUpdate(BaseModel):
    status: str
    reason: str

class CompanyResponse(BaseModel):
    id: str
    name: str
    status: str
    monthly_page_limit: int
    current_month_usage: int
    created_at: str
    # New fields
    logo_url: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    legal_name: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    quotation_prefix: Optional[str] = None
    registered_address: Optional[str] = None
    
    # Compliance details
    gst: Optional[str] = None
    
    # Bank details
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_address: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    company_id: str
    status: str
    created_at: str

class PasswordResetRequest(BaseModel):
    email: str
    new_password: str

class PasswordResetConfirm(BaseModel):
    token: str

class JDData(BaseModel):
    client_name: str = Field(..., description="Client name")
    jd_title: str = Field(..., description="Job description title")
    required_experience: Optional[str] = Field(None, description="e.g., '3-5', '4+'")
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None
    primary_skills: List[str] = Field(default_factory=list)
    secondary_skills: List[str] = Field(default_factory=list)
    # New fields (not sent to Gemini)
    location: Optional[str] = None
    budget: Optional[str] = None
    number_of_positions: Optional[int] = None
    work_mode: Optional[str] = Field(None, description="in-office, remote, hybrid")

class UpdateJD(BaseModel):
    required_experience: str
    primary_skills: List[str]
    secondary_skills: List[str] = []
    # New fields
    location: Optional[str] = None
    budget: Optional[str] = None
    number_of_positions: Optional[int] = None
    work_mode: Optional[str] = None

class BulkStatusUpdate(BaseModel):
    ids: List[str]
    status: str

# Update your BankCreate and BankUpdate models
class BankCreate(BaseModel):
    bank_name: str
    short_name: str
    ifsc_prefix: str
    status: str = "active"

class BankUpdate(BaseModel):
    bank_name: Optional[str] = None
    short_name: Optional[str] = None
    ifsc_prefix: Optional[str] = None
    status: Optional[str] = None

class BankResponse(BaseModel):
    id: str
    bank_name: str
    short_name: str
    ifsc_prefix: str
    status: str
    created_at: str
    updated_at: Optional[str] = None

# --------------------
# Helper Functions 
# --------------------

def create_token(data: dict, expires_delta: timedelta, secret: str):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + expires_delta})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)

def create_access_token(data: dict):
    return create_token(data, timedelta(minutes=ACCESS_EXPIRE_MIN), ACCESS_SECRET_KEY)

def create_refresh_token(data: dict):
    return create_token(data, timedelta(days=REFRESH_EXPIRE_DAYS), REFRESH_SECRET_KEY)

def verify_access_token(token: str):
    try:
        return jwt.decode(token, ACCESS_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

def verify_refresh_token(token: str):
    try:
        return jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

def _ensure_env_loaded():
    # Load .env from current working directory (project root)
    load_dotenv()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_access_token(token)
    return payload

@app.get("/me")
@limiter.limit(get_rate_limit("admin"))
def read_me(request : Request, user: dict = Depends(get_current_user)):
    return {"message": "Protected content", "user": user}

async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    ✅ Allow only Super Admins
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin privilege required")
    return current_user  # Returns entire user payload (user_id, role, company_id, etc.)

async def require_company_admin_or_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    ✅ Allow Company Admin OR Super Admin
    """
    if current_user.get("role") not in ["super_admin", "company_admin"]:
        raise HTTPException(status_code=403, detail="Admin privilege required")
    return current_user  # Returns entire user payload

async def send_reset_email(to_email: str, token: str):
    if not (SMTP_HOST and SMTP_PORT and SMTP_FROM):
        raise RuntimeError("SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER/SMTP_FROM, SMTP_PASS")

    confirm_link = f"{APP_BASE_URL}/password-reset/confirm/{token}"
    subject = "Password Reset Request"
    html = f"""
    <div style='font-family:Arial,sans-serif;font-size:14px;color:#333;'>
      <p>You requested to reset your password.</p>
      <p>This link expires in <strong>1 minute</strong>. Click the button below to confirm your password change:</p>
      <p style='margin:16px 0;'>
        <a href="{confirm_link}" style='background:#667eea;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;'>Confirm Password Reset</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p><a href="{confirm_link}">{confirm_link}</a></p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message.attach(MIMEText(html, "html"))

    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    context.minimum_version = ssl.TLSVersion.TLSv1_2

    try:
        if SMTP_PORT == 587:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                if server.has_extn('STARTTLS'):
                    server.starttls(context=context)
                    server.ehlo()
                if SMTP_USER and SMTP_PASS:
                    server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, to_email, message.as_string())
        elif SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=10) as server:
                if SMTP_USER and SMTP_PASS:
                    server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, to_email, message.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                if server.has_extn('STARTTLS'):
                    server.starttls(context=context)
                    server.ehlo()
                if SMTP_USER and SMTP_PASS:
                    server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, to_email, message.as_string())
    except Exception as e:
        raise RuntimeError(f"Failed to send email: {str(e)}")

async def _find_user_by_email(email: str):
    sa = await col_super_admins.find_one({"email": email})
    if sa:
        return ("super_admins", sa)
    cu = await col_company_users.find_one({"email": email, "is_deleted": False})
    if cu:
        return ("company_users", cu)
    return (None, None)

async def soft_delete_company(company_id: str, deleted_by: str) -> bool:
    """
    Soft delete a company and all its associated users
    """
    try:
        # Soft delete the company
        company_result = await col_companies.update_one(
            {"id": company_id},
            {
                "$set": {
                    "is_deleted": True,
                    "status": "inactive",  # Set status to inactive when deleting
                    "deleted_at": datetime.now().isoformat(),
                    "deleted_by": deleted_by
                }
            }
        )
        
        if company_result.modified_count == 0:
            return False
            
        # Soft delete all users for this company
        await col_company_users.update_many(
            {"company_id": company_id},
            {
                "$set": {
                    "is_deleted": True,
                    "status": "inactive",  # Set status to inactive when deleting
                    "deleted_at": datetime.now().isoformat(),
                    "deleted_by": deleted_by
                }
            }
        )
        
        return True
    except Exception as e:
        print(f"Failed to soft delete company: {e}")
        return False

async def soft_delete_company_user(user_id: str, deleted_by: str) -> bool:
    """
    Soft delete a company user
    """
    try:
        result = await col_company_users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "is_deleted": True,
                    "status": "inactive",  # Set status to inactive when deleting
                    "deleted_at": datetime.now().isoformat(),
                    "deleted_by": deleted_by
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Failed to soft delete user: {e}")
        return False

async def restore_company_user(user_id: str, restored_by: str) -> bool:
    """
    Restore a soft-deleted company user
    """
    try:
        result = await col_company_users.update_one(
            {"id": user_id, "is_deleted": True},
            {
                "$set": {
                    "is_deleted": False,
                    "status": "active",  # Set status to active when restoring
                    "restored_at": datetime.now().isoformat(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Failed to restore user: {e}")
        return False
async def restore_company_and_users(company_id: str, restored_by: str) -> bool:
    """
    Restore a soft-deleted company and all its soft-deleted users.
    """
    try:
        # Restore the company
        company_result = await col_companies.update_one(
            {"id": company_id, "is_deleted": True},
            {
                "$set": {
                    "is_deleted": False,
                    "status": "active",
                    "restored_at": datetime.now().isoformat(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )

        # Restore all users of this company
        await col_company_users.update_many(
            {"company_id": company_id, "is_deleted": True},
            {
                "$set": {
                    "is_deleted": False,
                    "status": "active",
                    "restored_at": datetime.now().isoformat(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )

        return company_result.modified_count > 0
    except Exception as e:
        print(f"Failed to restore company or users: {e}")
        return False


async def restore_analysis(analysis_id: str, company_id: str, restored_by: str) -> bool:
    """
    Restore a soft-deleted analysis
    """
    try:
        result = await db.analysis_history.update_one(
            {
                "analysis_id": analysis_id,
                "company_id": company_id,
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": datetime.now(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Failed to restore analysis: {e}")
        return False

async def restore_client(client_name: str, company_id: str, restored_by: str) -> bool:
    """
    Restore a soft-deleted client and its associated JDs and analyses
    """
    try:
        # Restore the client
        client_result = await db.clients.update_one(
            {
                "client_name": await to_init_caps(client_name),
                "company_id": company_id,
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": datetime.now(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        
        if client_result.modified_count == 0:
            return False
            
        # Get client ID
        client_doc = await db.clients.find_one({
            "client_name": await to_init_caps(client_name),
            "company_id": company_id
        })
        
        if not client_doc:
            return False
            
        client_id = client_doc["_id"]
        
        # Restore all JDs for this client
        await db.job_descriptions.update_many(
            {
                "client_id": client_id,
                "company_id": company_id,
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": datetime.now(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        
        # Restore all analyses for this client
        await db.analysis_history.update_many(
            {
                "client_id": client_id,
                "company_id": company_id,
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": datetime.now(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        
        return True
    except Exception as e:
        print(f"Failed to restore client: {e}")
        return False

async def restore_jd(client_name: str, jd_title: str, company_id: str, restored_by: str) -> bool:
    """
    Restore a soft-deleted job description and its associated analyses
    """
    try:
        # Get client ID
        client_doc = await db.clients.find_one({
            "client_name": await to_init_caps(client_name),
            "company_id": company_id
        })
        
        if not client_doc:
            return False
            
        client_id = client_doc["_id"]
        
        # Restore the JD
        jd_result = await db.job_descriptions.update_one(
            {
                "client_id": client_id,
                "jd_title": await to_init_caps(jd_title),
                "company_id": company_id,
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": datetime.now(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        
        if jd_result.modified_count == 0:
            return False
            
        # Restore all analyses for this JD
        await db.analysis_history.update_many(
            {
                "jd_id": client_id,
                "company_id": company_id,
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": datetime.now(),
                    "restored_by": restored_by
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": ""
                }
            }
        )
        
        return True
    except Exception as e:
        print(f"Failed to restore JD: {e}")
        return False

from datetime import datetime
from pymongo import UpdateOne

async def auto_reset_monthly_usage():
    """Create new usage records for the new month without overwriting old ones."""
    current_month = datetime.now().strftime("%Y-%m")

    # Check if reset already done for this month
    last_reset = await db.system_settings.find_one({"key": "last_usage_reset"})
    if last_reset and last_reset.get("value") == current_month:
        return  # Already reset this month

    # Get all active companies
    companies = await db.companies.find({}, {"_id": 1})

    # Prepare bulk operations
    operations = []
    for company in companies:
        company_id = str(company["_id"])
        # Check if this month's usage record already exists
        exists = await db.company_usage.find_one({"company_id": company_id, "month": current_month})
        if not exists:
            operations.append(
                UpdateOne(
                    {"company_id": company_id, "month": current_month},
                    {
                        "$setOnInsert": {
                            "page_count": 0,
                            "last_updated": datetime.now()
                        }
                    },
                    upsert=True
                )
            )

    # Execute all new-month inserts
    if operations:
        await db.company_usage.bulk_write(operations)

    # Update last reset marker
    await db.system_settings.update_one(
        {"key": "last_usage_reset"},
        {"$set": {"value": current_month, "updated_at": datetime.now()}},
        upsert=True
    )


async def send_usage_notification_email(company_id: str, usage_percentage: float):
    """Send email notification for high usage"""
    company = await col_companies.find_one({"id": company_id}, {"name": 1, "admin_email": 1})
    if not company:
        return
    
    subject = f"Usage Alert: {company['name']} - {usage_percentage:.1f}% Page Limit Used"
    message = f"""
    Dear Administrator,
    
    Your company {company['name']} has used {usage_percentage:.1f}% of its monthly page limit.
    
    Please contact support if you need to increase your limit.
    
    Best regards,
    TalentHive Team
    """
    
    # Implement email sending logic here
    print(f"Would send email to {company.get('admin_email')}: {subject}")
#-----------
#logs
#-----------

@app.get("/companies/list", response_class=JSONResponse)
@limiter.limit(get_rate_limit("admin"))
async def get_companies_list(request : Request, current_user: dict = Depends(require_super_admin)):
    companies = await col_companies.find({}, {"_id": 1, "name": 1}).to_list(None)
    result = [{"company_id": None, "company_name": "Super Admin"}]  # include Super Admin
    for c in companies:
        result.append({
            "company_id": str(c["_id"]),
            "company_name": c.get("name", "Unnamed Company")
        })
    return {"companies": result}


# Endpoint to fetch all audit logs (for super admin dashboard)
from fastapi import Query

from fastapi import Query

@app.get("/audit-logs", response_class=JSONResponse)
@limiter.limit(get_rate_limit("high_traffic"))
async def get_audit_logs(request : Request,
    current_user: dict = Depends(require_super_admin),
    company_id: str = Query(None)
):
    # 🔹 Actions to exclude
    exclude_actions = [
        "upload_company_logo",
        "create_company",
        "update_company_limit",
        "upload_user_profile_photo",
        "create_user",
        "restore_user",
        "restore_company_with_user",
        "analyze_resume",
        "restore_analysis",
        "restore_client",
        "restore_jd",
        "update_client",
        "update_client_status",
        "reset_company_usage",
        "create_bank",
        "update_bank",
        "update_bank_status",
        "delete_bank"
    ]

    # 🔹 Base query
    query = {}

    # 🔹 Filter by company
    if company_id:
        if company_id.lower() == "none":
            query["company_id"] = None
        else:
            query["company_id"] = company_id

    # 🔹 Exclude unwanted actions
    query["action"] = {"$nin": exclude_actions}

    logs = await audit_collection.find(query, {"_id": 0}).sort("timestamp", -1).to_list(None)
    
    # 🔹 Convert timestamp to ISO
    for log in logs:
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {"logs": logs}

@app.get("/audit-logs/company", response_class=JSONResponse)
@limiter.limit(get_rate_limit("high_traffic"))
async def get_company_audit_logs(request : Request,
    current_user: dict = Depends(require_company_admin_or_super_admin)  # 👈 Your role-based dependency
):
    company_id = current_user.get("company_id")
    if not company_id:
        return {"logs": [], "message": "No company ID found for this user."}

    # 🔹 Actions to exclude (same list as before)
    exclude_actions = [
        "upload_company_logo",
        "create_company",
        "update_company_limit",
        "upload_user_profile_photo",
        "create_user",
        "restore_user",
        "restore_company_with_user",
        "analyze_resume",
        "restore_analysis",
        "restore_client",
        "restore_jd",
        "update_client",
        "update_client_status",
        "reset_company_usage",
        "create_bank",
        "update_bank",
        "update_bank_status",
        "delete_bank"
    ]

    # 🔹 Build query for this company
    query = {
        "company_id": company_id,
        "action": {"$nin": exclude_actions}
    }

    logs = await audit_collection.find(query, {"_id": 0}).sort("timestamp", -1).to_list(None)
    
    # 🔹 Convert timestamp → ISO
    for log in logs:
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {"logs": logs}



# --------------------
# Auth Routes
# --------------------

@app.post("/login")
@limiter.limit(get_rate_limit("auth"))
async def login(data: LoginRequest, request: Request):
    # Super admin
    sa = await col_super_admins.find_one({"email": data.email})
    if sa and bcrypt.checkpw(data.password.encode(), sa["password"].encode()):
        payload = {
            "user_id": str(sa.get("id", uuid.uuid4())), 
            "role": "super_admin",
            "name": sa.get("name"),  # ✅ Add name to JWT payload
            "email": sa.get("email")
        }
        return {
            "message": "Login successful",
            "role": "super_admin",
            "name": sa.get("name"),
            "user_id": payload["user_id"],
            "email": sa.get("email"),
            "access_token": create_access_token(payload),
            "refresh_token": create_refresh_token(payload)
        }

    # Company user
    cu = await col_company_users.find_one({"email": data.email, "is_deleted": False, "status": "active"})
    if cu and bcrypt.checkpw(data.password.encode(), cu["password"].encode()):
        payload = {
            "user_id": str(cu.get("id", uuid.uuid4())),
            "role": cu.get("role"),
            "company_id": cu.get("company_id"),
            "name": cu.get("name"),  # ✅ Add name to JWT payload
            "email": cu.get("email")
        }
        return {
            "message": "Login successful",
            "role": cu.get("role"),
            "name": cu.get("name"),
            "user_id": payload["user_id"],
            "email": cu.get("email"),
            "company_id": cu.get("company_id"),
            "access_token": create_access_token(payload),
            "refresh_token": create_refresh_token(payload)
        }
    raise HTTPException(status_code=401, detail="Invalid email or password or account is inactive")

@app.post("/refresh")
@limiter.limit(get_rate_limit("auth"))
async def refresh_token(request: Request,credentials: HTTPAuthorizationCredentials = Depends(security)):
    refresh_token = credentials.credentials
    payload = verify_refresh_token(refresh_token)

    # Issue a new access token (don't extend refresh)
    new_access = create_access_token({
        "user_id": payload["user_id"],
        "role": payload["role"],
        "company_id": payload.get("company_id"),
        "name": payload.get("name")
    })
    return {"access_token": new_access}

@app.post("/password-reset/request")
@limiter.limit(get_rate_limit("auth"))
async def password_reset_request(request: Request,data: PasswordResetRequest):
    if not data.email or not data.new_password:
        raise HTTPException(status_code=400, detail="Email and new password are required")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    table, user = await _find_user_by_email(data.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")

    token = str(uuid.uuid4())
    expires_at = (datetime.utcnow() + timedelta(minutes=1)).isoformat() + "Z"
    hashed_new_password = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    row_id = str(uuid.uuid4())
    reset_row = {
        "_id": row_id,
        "id": row_id,
        "email": data.email,
        "token": token,
        "new_password_hash": hashed_new_password,
        "user_table": table,
        "expires_at": expires_at,
        "created_at": datetime.utcnow().isoformat()
    }

    await col_password_resets.insert_one(reset_row)

    try:
        await send_reset_email(data.email, token)
    except Exception as e:
        print("Failed to send email:", str(e))
        msg = "Failed to send reset email"
        if DEBUG:
            msg += f": {str(e)}"
        raise HTTPException(status_code=500, detail=msg)

    return {"message": "Password reset email sent"}

@app.post("/password-reset/confirm/{token}", response_model=dict)
@limiter.limit(get_rate_limit("auth"))
async def password_reset_confirm(request: Request,token: str):
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    row = await col_password_resets.find_one({"token": token})
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    try:
        if datetime.utcnow() > datetime.fromisoformat(row["expires_at"].replace("Z", "")):
            await col_password_resets.delete_one({"id": row["id"]})
            raise HTTPException(status_code=400, detail="Token expired")
    except Exception:
        await col_password_resets.delete_one({"id": row.get("id")})
        raise HTTPException(status_code=400, detail="Invalid token")

    target = row.get("user_table")
    if target == "super_admins":
        upd = await col_super_admins.update_one({"email": row["email"]}, {"$set": {"password": row["new_password_hash"]}})
    elif target == "company_users":
        upd = await col_company_users.update_one({"email": row["email"]}, {"$set": {"password": row["new_password_hash"]}})
    else:
        await col_password_resets.delete_one({"id": row.get("id")})
        raise HTTPException(status_code=400, detail="Invalid token context")

    if upd.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update password")

    await col_password_resets.delete_one({"id": row.get("id")})
    return {"message": "Password reset successful"}

@app.get("/password-reset/confirm/{token}", response_class=HTMLResponse)
@limiter.limit(get_rate_limit("auth"))
async def password_reset_confirm_get(request: Request,token: str):
    row = await col_password_resets.find_one({"token": token})
    if not row:
        return HTMLResponse("<h3>Invalid or expired token</h3>", status_code=400)

    try:
        if datetime.utcnow() > datetime.fromisoformat(row["expires_at"].replace("Z", "")):
            await col_password_resets.delete_one({"id": row["id"]})
            return HTMLResponse("<h3>Token expired</h3>", status_code=400)
    except Exception:
        await col_password_resets.delete_one({"id": row.get("id")})
        return HTMLResponse("<h3>Invalid token</h3>", status_code=400)

    target = row.get("user_table")
    if target == "super_admins":
        upd = await col_super_admins.update_one({"email": row["email"]}, {"$set": {"password": row["new_password_hash"]}})
    elif target == "company_users":
        upd = await col_company_users.update_one({"email": row["email"]}, {"$set": {"password": row["new_password_hash"]}})
    else:
        await col_password_resets.delete_one({"id": row.get("id")})
        return HTMLResponse("<h3>Invalid token</h3>", status_code=400)

    if upd.modified_count == 0:
        return HTMLResponse("<h3>Failed to update password</h3>", status_code=500)

    await col_password_resets.delete_one({"id": row.get("id")})
    return HTMLResponse("<h3>Password reset successful. You may close this window and log in.</h3>")

# --------------------
# Company Routes
# --------------------
app.mount("/logos", StaticFiles(directory="logos"), name="logos")

@app.post("/companies/{company_id}/logo")
@limiter.limit(get_rate_limit("upload"))
@limiter.limit("10/minute")
async def upload_company_logo(
    request: Request,
    company_id: str,
    logo: UploadFile = File(...),
    user: dict = Depends(require_company_admin_or_super_admin)
):
    # Validate file type
    if logo.content_type not in ["image/jpeg", "image/png", "image/gif"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and GIF images are allowed")

    # Check file size (1MB max)
    contents = await logo.read()
    if len(contents) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 1MB")

    # Generate unique filename
    file_extension = logo.filename.split(".")[-1] if "." in logo.filename else ""
    unique_filename = f"{company_id}_{uuid.uuid4().hex}.{file_extension}"
    logo_path = f"logos/{unique_filename}"

    # Save file asynchronously
    async with aiofiles.open(logo_path, "wb") as buffer:
        await buffer.write(contents)

    # Fetch old company data for audit
    old_company = await col_companies.find_one({"id": company_id})

    # Update company record with logo path
    result = await col_companies.update_one(
        {"id": company_id},
        {"$set": {"logo_url": f"/logos/{unique_filename}"}}
    )

    if result.modified_count == 0:
        # Clean up file if company not found
        try:
            os.remove(logo_path)
        except:
            pass
        raise HTTPException(status_code=404, detail="Company not found")

    # Fetch new company data for audit
    new_company = await col_companies.find_one({"id": company_id})

    # Log audit trail
    await log_audit_trail(
        user_id=user.get("user_id"),
        name=user.get("name"),
        role=user.get("role"),
        company_id=user.get("company_id"),
        action="upload_company_logo",
        target_table="companies",
        target_id=company_id,
        old_data={"logo_url": old_company.get("logo_url") if old_company else None},
        new_data={"logo_url": new_company.get("logo_url")},
        screen="company"  
    )

    return {"message": "Logo uploaded successfully", "logo_url": f"/logos/{unique_filename}"}

@app.post("/companies", response_model=CompanyResponse)
@limiter.limit(get_rate_limit("admin"))
async def create_company(
    company: CompanyCreate,request : Request,
    user: dict = Depends(require_super_admin)
):
    # Duplicate checks (include is_deleted: False to check for non-deleted companies)
    if await col_companies.find_one({"name": company.name, "is_deleted": False}):
        raise HTTPException(status_code=400, detail="Company name already exists")
    if await col_company_users.find_one({"email": company.admin_email, "is_deleted": False}):
        raise HTTPException(status_code=400, detail="Admin email already exists")

    now_iso = datetime.now().isoformat()
    company_id = str(uuid.uuid4())
    
    # Initialize usage tracking first
    await initialize_usage_tracking(company_id)
    
    company_doc = {
        "_id": company_id,
        "id": company_id,
        "name": company.name,
        "status": "active",  # Default status is active
        "gemini_api_key": company.gemini_api_key,
        "llama_api_key": company.llama_api_key,
        "gemini_model": company.gemini_model or "gemini-2.0-flash",
        "monthly_page_limit": company.monthly_page_limit or 1000,
        "current_month_usage": 0,  # Set to 0 for new company
        "created_at": now_iso,
        "is_deleted": False,  # Add this field
        # New fields
        "logo_url": company.logo_url,
        "email": company.email,
        "mobile": company.mobile,
        "website": company.website,
        "domain": company.domain,
        "legal_name": company.legal_name,
        "country": company.country,
        "state": company.state,
        "city": company.city,
        "pincode": company.pincode,
        "quotation_prefix": company.quotation_prefix,
        "registered_address": company.registered_address,
        
        # Compliance details
        "gst": company.gst,
        
        # Bank details
        "account_number": company.account_number,
        "account_holder_name": company.account_holder_name,
        "bank_name": company.bank_name,
        "ifsc_code": company.ifsc_code,
        "bank_branch": company.bank_branch,
        "bank_address": company.bank_address
    }
    await col_companies.insert_one(company_doc)

    # Initial company admin
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "_id": admin_id,
        "id": admin_id,
        "email": company.admin_email,
        "password": bcrypt.hashpw(company.admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        "name": company.name,
        "role": "company_admin",
        "status": "active",  # Default status is active
        "company_id": company_id,
        "created_at": now_iso,
        "is_deleted": False  # Add this field
    }
    try:
        await col_company_users.insert_one(admin_doc)
    except Exception as e:
        # Keep company, but surface in logs
        print("Failed to create company admin:", str(e))
    await log_audit_trail(
        user_id=user.get("user_id"),
        name=user.get("name"),
        role=user.get("role"),
        company_id=user.get("company_id"),
        action="create_company",
        target_table="companies",
        target_id=company_id,
        old_data=None,
        new_data={
            "company": company_doc,
            "initial_admin": admin_doc
        },
        screen="company"  
    )

    return CompanyResponse(**company_doc)

@app.get("/companies")
@limiter.limit(get_rate_limit("admin"))
async def get_companies(
    request: Request,
    status: Optional[str] = None,
    _: str = Depends(get_current_user)
):
    items = []
    query = {"is_deleted": False}
    if status:
        query["status"] = status

    # Sort by _id descending → latest first
    cursor = col_companies.find(query, {"_id": 0}).sort("created_at", -1)

    async for doc in cursor:
        # Add current usage to response
        usage_info = {
            "current_month_usage": await get_current_month_usage(doc["id"]),
            "monthly_page_limit": doc.get("monthly_page_limit", 1000)
        }
        items.append({**doc, **usage_info})

    return items

@app.patch("/companies/{company_id}", response_model=CompanyResponse)
@limiter.limit(get_rate_limit("admin"))
async def update_company(
    request: Request,
    company_id: str,
    company: CompanyUpdate,
    user: dict = Depends(require_company_admin_or_super_admin),
):
    update_data = {k: v for k, v in company.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Fetch old company
    old_company = await col_companies.find_one({"id": company_id, "is_deleted": False})
    if not old_company:
        raise HTTPException(status_code=404, detail="Company not found")

    # ✅ Duplicate checks (include is_deleted: False)
    if "name" in update_data:
        existing_name = await col_companies.find_one({
            "name": update_data["name"],
            "is_deleted": False,
            "id": {"$ne": company_id}  # Exclude current company
        })
        if existing_name:
            raise HTTPException(status_code=400, detail="Company name already exists")

    if "email" in update_data:
        existing_email = await col_company_users.find_one({
            "email": update_data["email"],
            "is_deleted": False,
            "company_id": {"$ne": company_id}  # Exclude current company’s admin
        })
        if existing_email:
            raise HTTPException(status_code=400, detail="Admin email already exists")

    # Filter only changed fields
    changed_fields = {
        k: v for k, v in update_data.items()
        if str(v) != str(old_company.get(k))
    }

    if not changed_fields:
        raise HTTPException(status_code=400, detail="No actual changes detected")

    # Perform update
    updated = await col_companies.find_one_and_update(
        {"id": company_id, "is_deleted": False},
        {"$set": changed_fields},
        return_document=True
    )

    # Prepare audit data (only truly modified fields)
    modified_old_data = {k: old_company.get(k) for k in changed_fields.keys()}
    modified_new_data = {k: updated.get(k) for k in changed_fields.keys()}

    # Log audit trail
    await log_audit_trail(
        user_id=user.get("user_id"),
        name=user.get("name"),
        role=user.get("role"),
        company_id=user.get("company_id"),
        action="update_company",
        target_table="companies",
        target_id=company_id,
        old_data=modified_old_data,
        new_data=modified_new_data,
        screen="company"
    )

    return CompanyResponse(**updated)



@app.delete("/companies/{company_id}")
@limiter.limit(get_rate_limit("admin"))
async def delete_company(
    request : Request,
    company_id: str,
    x_user_id: Optional[str] = Header(default=None),
    user: dict = Depends(require_super_admin)
):
    # Fetch company for audit
    old_company = await col_companies.find_one({"id": company_id, "is_deleted": False})
    if not old_company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Check if company still has users
    user_count = await col_company_users.count_documents({"company_id": company_id, "is_deleted": False})
    if user_count > 0:
        raise HTTPException(status_code=400, detail="First remove this company's users, then delete the company.")

    # Soft delete: mark is_deleted=True
    update_fields = {
        "is_deleted": True,
        "deleted_by": x_user_id or user.get("user_id"),
        "deleted_at": datetime.utcnow()
    }

    result = await col_companies.update_one(
        {"id": company_id, "is_deleted": False},
        {"$set": update_fields}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")

    # Fetch new company data for audit
    new_company = await col_companies.find_one({"id": company_id})

    # Prepare audit log (only modified fields)
    modified_old_data = {k: old_company.get(k) for k in update_fields.keys()}
    modified_new_data = {k: new_company.get(k) for k in update_fields.keys()}

    # Log audit trail — no extra_info
    await log_audit_trail(
        user_id=user.get("user_id"),
        name=user.get("name"),
        role=user.get("role"),
        company_id=user.get("company_id"),
        action="delete_company",
        target_table="companies",
        target_id=company_id,
        old_data=modified_old_data,
        new_data=modified_new_data,
        screen="company"  
    )

    return {"message": "Company deleted successfully"}


@app.get("/companies/{company_id}/api-keys")
@limiter.limit(get_rate_limit("admin"))
async def get_company_api_keys(
    request: Request,
    company_id: str, 
    _: str = Depends(require_super_admin)
):
    """Get API keys for a company (masked for security)"""
    company = await col_companies.find_one(
        {"id": company_id, "is_deleted": False},
        {"gemini_api_key": 1, "llama_api_key": 1, "gemini_model": 1, "name": 1}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Mask API keys for security
    response = {
        "company_name": company["name"],
        "gemini_model": company.get("gemini_model", "gemini-2.0-flash"),
        "has_gemini_key": bool(company.get("gemini_api_key")),
        "has_llama_key": bool(company.get("llama_api_key"))
    }
    
    return response

@app.patch("/companies/{company_id}/api-keys")
@limiter.limit(get_rate_limit("admin"))
async def update_company_api_keys(
    request: Request,
    company_id: str, 
    gemini_api_key: Optional[str] = Form(None),
    llama_api_key: Optional[str] = Form(None),
    gemini_model: Optional[str] = Form("gemini-2.0-flash"),
    user: dict = Depends(require_super_admin)
):
    """Update API keys for a company"""

    update_data = {}

    if gemini_api_key is not None:
        update_data["gemini_api_key"] = gemini_api_key

    if llama_api_key is not None:
        update_data["llama_api_key"] = llama_api_key

    if gemini_model is not None:
        update_data["gemini_model"] = gemini_model

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Fetch old data for audit
    old_company = await col_companies.find_one({"id": company_id, "is_deleted": False})
    if not old_company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Filter only actually changed fields (avoid logging unchanged values)
    changed_fields = {
        k: v for k, v in update_data.items()
        if str(v) != str(old_company.get(k))
    }

    if not changed_fields:
        raise HTTPException(status_code=400, detail="No actual changes detected")

    # Update the company
    updated = await col_companies.find_one_and_update(
        {"id": company_id, "is_deleted": False},
        {"$set": changed_fields},
        return_document=True,
        projection={"_id": 0, "gemini_api_key": 0, "llama_api_key": 0}  # hide sensitive keys
    )

    # Prepare audit data (only modified fields)
    modified_old_data = {k: old_company.get(k) for k in changed_fields.keys()}
    modified_new_data = {k: update_data.get(k) for k in changed_fields.keys()}

    # Log audit trail — no extra_info
    await log_audit_trail(
        user_id=user.get("user_id"),
        name=user.get("name"),
        role=user.get("role"),
        company_id=user.get("company_id"),
        action="update_company_api_keys",
        target_table="companies",
        target_id=company_id,
        old_data=modified_old_data,
        new_data=modified_new_data,
        screen="company"  
    )

    return {
        "message": "API keys updated successfully",
        "company": updated
    }

@app.get("/companies/{company_id}/usage")
@limiter.limit(get_rate_limit("admin"))
async def get_company_usage(
    request: Request,
    company_id: str, 
    _: str = Depends(require_super_admin)
):
    """Get company usage statistics"""
    company = await col_companies.find_one(
        {"id": company_id, "is_deleted": False},
        {"name": 1, "monthly_page_limit": 1}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    usage_stats = await get_usage_stats(company_id)
    
    return {
        "company_name": company["name"],
        "monthly_page_limit": company.get("monthly_page_limit", 1000),
        "current_usage": usage_stats["current_usage"],
        "usage_percentage": usage_stats["usage_percentage"]
    }

@app.patch("/companies/{company_id}/limit")
@limiter.limit(get_rate_limit("admin"))
async def update_company_limit(
    request: Request,
    company_id: str,
    monthly_page_limit: int = Query(..., description="Additional pages to add to this month's limit"),
    amount_paid: float = Query(..., description="Amount paid in ₹ for this page limit update"),
    current_user: dict = Depends(require_super_admin)
):
    """Add additional page limit for the current month and log paid amount in history."""

    if monthly_page_limit <= 0:
        raise HTTPException(status_code=400, detail="Page limit must be positive")
    if amount_paid <= 0:
        raise HTTPException(status_code=400, detail="Amount paid must be positive")

    current_month = datetime.now().strftime("%Y-%m")

    # Fetch old usage doc for audit
    old_usage = await db.company_usage.find_one({"company_id": company_id, "month": current_month})
    previous_limit = old_usage.get("page_limit", 0) if old_usage else 0  # Fixed: removed await from dict.get()
    new_limit = previous_limit + monthly_page_limit

    if not old_usage:
        # New month entry
        usage_doc = {
            "company_id": company_id,
            "month": current_month,
            "page_limit": monthly_page_limit,
            "page_count": 0,
            "history": [
                {
                    "updated_at": datetime.now(),
                    "previous_limit": 0,
                    "added_limit": monthly_page_limit,
                    "new_limit": monthly_page_limit,
                    "amount_paid": amount_paid,
                    "updated_by": {
                        "user_id": current_user.get("user_id"),
                        "role": current_user.get("role")
                    }
                }
            ]
        }
        await db.company_usage.insert_one(usage_doc)
    else:
        # Existing month, update limit
        await db.company_usage.update_one(
            {"_id": old_usage["_id"]},
            {
                "$set": {
                    "page_limit": new_limit,
                    "last_updated": datetime.now()
                },
                "$push": {
                    "history": {
                        "updated_at": datetime.now(),
                        "previous_limit": previous_limit,
                        "added_limit": monthly_page_limit,
                        "new_limit": new_limit,
                        "amount_paid": amount_paid,
                        "updated_by": {
                            "user_id": current_user.get("user_id"),
                            "role": current_user.get("role")
                        }
                    }
                }
            }
        )

    # Update main company record
    await col_companies.update_one(
        {"id": company_id, "is_deleted": False},
        {"$set": {"monthly_page_limit": new_limit}}
    )

    # Prepare audit log — include context fields
    modified_old_data = {"monthly_page_limit": previous_limit}
    modified_new_data = {
        "monthly_page_limit": new_limit,
        "added_limit": monthly_page_limit,
        "amount_paid": amount_paid,
        "month": current_month
    }

    # Log audit trail — no extra_info
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="update_company_limit",
        target_table="companies",
        target_id=company_id,
        old_data=modified_old_data,
        new_data=modified_new_data,
        screen="company"  
    )

    updated_stats = await get_usage_stats(company_id)
    return {
        "message": f"Page limit increased by {monthly_page_limit}. New total: {new_limit}. Paid ₹{amount_paid}",
        "usage_stats": updated_stats
    }

@app.get("/companies/usage-report")
@limiter.limit(get_rate_limit("admin"))
async def get_companies_usage_report(
    request: Request,
    month: str = Query(None, description="Month in YYYY-MM format"),
    _: dict = Depends(require_super_admin)
):
    """
    Returns a report of all active companies with usage, page limit, pages remaining, and total paid for the given month.
    If no month is provided, defaults to the current month.
    """
    current_month = month or datetime.now().strftime("%Y-%m")
    report = []

    # Fixed: Use async cursor iteration
    companies_cursor = col_companies.find(
        {"is_deleted": False, "status": "active"}, 
        {"id": 1, "name": 1, "monthly_page_limit": 1}
    )
    
    async for company in companies_cursor:
        company_id = company["id"]
        usage_doc = await db.company_usage.find_one({"company_id": company_id, "month": current_month})

        if usage_doc:
            current_usage = usage_doc.get("page_count", 0)
            monthly_limit = usage_doc.get("page_limit", 0)
            history = usage_doc.get("history", [])
        else:
            current_usage = 0
            monthly_limit = 0
            history = []

        remaining_pages = max(monthly_limit - current_usage, 0)
        total_paid = sum(h.get("amount_paid", 0) for h in history) if history else 0
        usage_percentage = (current_usage / monthly_limit * 100) if monthly_limit > 0 else 0

        report.append({
            "company_id": company_id,
            "company_name": company["name"],
            "current_usage": current_usage,
            "monthly_limit": monthly_limit,
            "remaining_pages": remaining_pages,
            "usage_percentage": round(usage_percentage, 1),
            "total_paid": total_paid,
            "history": history
        })
    
    return {"report": report, "month": current_month}


@app.patch("/companies/{company_id}/status")
@limiter.limit(get_rate_limit("admin"))
async def update_company_status(
    request: Request,
    company_id: str,
    body: CompanyStatusUpdate,
    current_user: dict = Depends(require_super_admin)
):
    if body.status not in ["active", "inactive"]:
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")

    # Fetch old company status for audit
    old_company = await col_companies.find_one({"id": company_id, "is_deleted": False})
    if not old_company:
        raise HTTPException(status_code=404, detail="Company not found")
    old_status = old_company.get("status")

    # Create status log entry
    status_entry = {
        "status": body.status,
        "reason": body.reason,
        "updated_at": datetime.utcnow(),
        "updated_by": current_user["user_id"]
    }

    # Update company document
    result = await col_companies.update_one(
        {"id": company_id, "is_deleted": False},
        {
            "$set": {"status": body.status},
            "$push": {"status_history": status_entry}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Company not updated")

    # Update company users based on company status
    if body.status == "inactive":
        # Deactivate all company users
        old_users_cursor = col_company_users.find({"company_id": company_id, "is_deleted": False})
        old_users = await old_users_cursor.to_list(length=None)
        
        await col_company_users.update_many(
            {"company_id": company_id, "is_deleted": False},
            {"$set": {"status": "inactive"}}
        )
        # Audit log for users
        for u in old_users:
            await log_audit_trail(
                user_id=current_user.get("user_id"),
                name=current_user.get("name"),
                role=current_user.get("role"),
                company_id=current_user.get("company_id"),
                action="update_user_status_due_to_company_deactivation",
                target_table="company_users",
                target_id=u.get("id"),
                old_data={"status": u.get("status")},
                new_data={"status": "inactive"},
                screen="company"  
            )

    elif body.status == "active":
        # Reactivate only company_admin users 
        admin_users_cursor = col_company_users.find({
            "company_id": company_id,
            "is_deleted": False,
            "role": "company_admin"
        })
        admin_users = await admin_users_cursor.to_list(length=None)
        
        await col_company_users.update_many(
            {"company_id": company_id, "is_deleted": False, "role": "company_admin"},
            {"$set": {"status": "active"}}
        )
        # Audit log for reactivated admins
        for u in admin_users:
            await log_audit_trail(
                user_id=current_user.get("user_id"),
                name=current_user.get("name"),
                role=current_user.get("role"),
                company_id=current_user.get("company_id"),
                action="reactivate_company_admin",
                target_table="company_users",
                target_id=u.get("id"),
                old_data={"status": "inactive"},
                new_data={"status": "active"},
                screen="users"  
            )

    # Log audit for company status change
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="update_company_status",
        target_table="companies",
        target_id=company_id,
        old_data={"status": old_status},
        new_data={"status": body.status, "status_reason": body.reason},
        screen="company"  
    )

    return {
        "message": f"Company status updated to {body.status}",
        "history_entry": status_entry
    }

@app.post("/companies/{company_id}/restore")
@limiter.limit(get_rate_limit("admin"))
async def restore_company_endpoint(
    request: Request,
    company_id: str, 
    current_user: dict = Depends(require_super_admin)
):
    # Fetch deleted company for audit
    old_company = await col_companies.find_one({"id": company_id, "is_deleted": True})
    if not old_company:
        raise HTTPException(status_code=404, detail="Company not found or not deleted")

    # Fetch deleted users
    old_users_cursor = col_company_users.find({"company_id": company_id, "is_deleted": True})
    old_users = await old_users_cursor.to_list(length=None)

    # Restore company and its users
    success = await restore_company_and_users(company_id, current_user.get("user_id"))
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore company or users")

    # Fetch restored company and users
    new_company = await col_companies.find_one({"id": company_id, "is_deleted": False})
    new_users_cursor = col_company_users.find({"company_id": company_id, "is_deleted": False})
    new_users = await new_users_cursor.to_list(length=None)

    # Prepare audit data — only changed fields
    modified_old_data = {"is_deleted": True, "restored_user_count": len(old_users)}
    modified_new_data = {"is_deleted": False, "restored_user_count": len(new_users)}

    # Log audit trail
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="restore_company_with_users",
        target_table="companies",
        target_id=company_id,
        old_data=modified_old_data,
        new_data=modified_new_data,
        screen="company"  
    )

    return {"message": f"Company and {len(new_users)} users restored successfully"}


# --------------------
# User Routes
# --------------------


# Mount for serving user profile images
app.mount("/logos/users", StaticFiles(directory="logos/users"), name="user_logos")

@app.post("/users/{user_id}/profile-photo")
@limiter.limit(get_rate_limit("upload"))
async def upload_user_photo(
    request: Request,
    user_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/gif"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and GIF images are allowed")

    # Check file size (1MB max)
    contents = await file.read()
    if len(contents) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 1MB")

    # Ensure directory exists
    os.makedirs("logos/users", exist_ok=True)

    # Generate unique filename
    file_extension = file.filename.split(".")[-1] if "." in file.filename else ""
    unique_filename = f"{user_id}_{uuid.uuid4().hex}.{file_extension}"
    logo_path = f"logos/users/{unique_filename}"

    # Save file asynchronously
    async with aiofiles.open(logo_path, "wb") as buffer:
        await buffer.write(contents)

    # Fetch old user data for audit
    old_user = await col_company_users.find_one({"id": user_id})
    old_photo = old_user.get("profile_photo_url") if old_user else None

    # Update user record with new photo URL
    result = await col_company_users.update_one(
        {"id": user_id, "is_deleted": False},
        {"$set": {"profile_photo_url": f"/logos/users/{unique_filename}"}}
    )

    if result.modified_count == 0:
        # Rollback file if update fails
        try:
            os.remove(logo_path)
        except:
            pass
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch new user data for audit
    new_user = await col_company_users.find_one({"id": user_id})
    new_photo = new_user.get("profile_photo_url")

    # Log audit trail — only modified field
    await log_audit_trail(
        user_id=user.get("user_id"),
        name=user.get("name"),
        role=user.get("role"),
        company_id=user.get("company_id"),
        action="upload_user_profile_photo",
        target_table="company_users",
        target_id=user_id,
        old_data={"profile_photo_url": old_photo},
        new_data={"profile_photo_url": new_photo},
        screen="users"  
    )

    return {
        "message": "Profile photo uploaded successfully",
        "profile_photo_url": f"/logos/users/{unique_filename}"
    }

@app.post("/users", response_model=UserResponse)
@limiter.limit(get_rate_limit("admin"))
async def create_user(
    request: Request,
    user: UserCreate, 
    current_user: dict = Depends(require_super_admin)
):
    try:
        now_iso = datetime.now().isoformat()
        user_id = str(uuid.uuid4())
        existing_user = await col_company_users.find_one({
            "email": user.email,
            "is_deleted": False
        })
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")
        # Auto-calc age if dob is given
        calculated_age = None
        if user.dob:
            today = date.today()
            calculated_age = today.year - user.dob.year - (
                (today.month, today.day) < (user.dob.month, user.dob.day)
            )

        user_doc = {
            "_id": user_id,
            "id": user_id,
            "email": user.email,
            "password": bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
            "name": user.name,
            "middle_name": user.middle_name,
            "last_name": user.last_name,
            "gender": user.gender,
            "dob": user.dob.isoformat() if user.dob else None,
            "age": user.age if user.age is not None else calculated_age,
            "mobile": user.mobile,
            "department": user.department,
            "designation": user.designation,
            "date_of_joining": user.date_of_joining.isoformat() if user.date_of_joining else None,
            "role": "user",
            "status": user.status or "active",
            "company_id": user.company_id,
            "profile_photo_url": user.profile_photo_url,
            "created_at": now_iso,
            "is_deleted": False
        }

        # Insert user record
        await col_company_users.insert_one(user_doc)

        # Audit trail for user creation
        await log_audit_trail(
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="create_user",
            target_table="company_users",
            target_id=user_id,
            old_data=None,
            new_data={k: v for k, v in user_doc.items() if k != "password"},
            screen="users"  
        )

        return UserResponse(**{k: v for k, v in user_doc.items() if k != "_id"})
    
    except Exception as e:
        print("Error in create_user:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users")
@limiter.limit(get_rate_limit("admin"))
async def get_users(
    request: Request,
    company_id: Optional[str] = None, 
    status: Optional[str] = None, 
    _: str = Depends(get_current_user)
):
    query = {"is_deleted": False}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
        
    items = []
    async for doc in col_company_users.find(query, {"_id": 0}).sort("created_at", -1):  # 👈 newest first
        items.append(doc)
    return items


@app.get("/users/{user_id}")
@limiter.limit(get_rate_limit("admin"))
async def get_user(
    request: Request,
    user_id: str, 
    current_user: dict = Depends(get_current_user)
):
    # Users can only access their own data
    if current_user["role"] == "user" and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")
    
    # Add company_id check for company admins
    if current_user["role"] == "company_admin":
        user = await col_company_users.find_one({"id": user_id, "company_id": current_user["company_id"], "is_deleted": False}, {"_id": 0})
    else:
        user = await col_company_users.find_one({"id": user_id, "is_deleted": False}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@app.patch("/users/{user_id}", response_model=UserResponse)
@limiter.limit(get_rate_limit("admin"))
async def update_user(
    request: Request,
    user_id: str, 
    user: UserUpdate, 
    current_user: dict = Depends(require_super_admin)
):
    # Prepare update data
    update_data = {k: v for k, v in user.dict(exclude_unset=True).items() if v is not None}
    
    if "password" in update_data:
        update_data["password"] = bcrypt.hashpw(update_data["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    if "email" in update_data:
        existing_user = await col_company_users.find_one({
            "email": update_data["email"],
            "is_deleted": False,
            "id": {"$ne": user_id}
        })
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")

    # Fetch old user record for audit
    old_user = await col_company_users.find_one({"id": user_id, "is_deleted": False})
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update the user
    updated = await col_company_users.find_one_and_update(
        {"id": user_id, "is_deleted": False},
        {"$set": update_data},
        return_document=True
    )
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update user")

    updated.pop("_id", None)

    # Prepare audit log — only include fields where value actually changed and exclude password
    old_data_for_audit = {}
    new_data_for_audit = {}
    for key in update_data.keys():
        if key != "password" and old_user.get(key) != updated.get(key):
            old_data_for_audit[key] = old_user.get(key)
            new_data_for_audit[key] = updated.get(key)

    # Log audit trail only if something actually changed
    if old_data_for_audit:
        await log_audit_trail(
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="update_user",
            target_table="company_users",
            target_id=user_id,
            old_data=old_data_for_audit,
            new_data=new_data_for_audit,
            screen="users"  
        )

    return UserResponse(**updated)

@app.delete("/users/{user_id}")
@limiter.limit(get_rate_limit("admin"))
async def delete_user(
    request: Request,
    user_id: str, 
    current_user: dict = Depends(require_super_admin)
):
    # Fetch old user record for audit
    old_user = await col_company_users.find_one({"id": user_id, "is_deleted": False})
    
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Perform soft delete
    success = await soft_delete_company_user(user_id, current_user.get("user_id"))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user")

    # Fetch new user record after soft delete
    new_user = await col_company_users.find_one({"id": user_id})

    # Determine which fields changed
    audit_fields = ["is_deleted", "deleted_by", "deleted_at"]
    old_data_for_audit = {k: old_user.get(k) for k in audit_fields if k in old_user}
    new_data_for_audit = {k: new_user.get(k) for k in audit_fields if new_user and k in new_user}

    # Log audit trail only for changed fields
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="delete_user",
        target_table="company_users",
        target_id=user_id,
        old_data=old_data_for_audit,
        new_data=new_data_for_audit,
        screen="users"  
    )

    return {"message": "User deleted"}

@app.patch("/users/{user_id}/status")
@limiter.limit(get_rate_limit("admin"))
async def update_user_status(
    request: Request,
    user_id: str, 
    body: UserStatusUpdate,
    admin_info: dict = Depends(require_company_admin_or_super_admin)
):
    if body.status not in ["active", "inactive"]:
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")

    # Build query based on role
    query = {"id": user_id, "is_deleted": False}
    if admin_info["role"] == "company_admin":
        query["company_id"] = admin_info["company_id"]

    # Fetch old user record for audit
    old_user = await col_company_users.find_one(query)
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found or not authorized")

    # Create status log entry
    status_entry = {
        "status": body.status,
        "reason": body.reason,
        "updated_at": datetime.utcnow(),
        "updated_by": admin_info["user_id"]
    }

    # Update user document
    result = await col_company_users.update_one(
        query,
        {
            "$set": {"status": body.status},
            "$push": {"status_history": status_entry}
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not updated")

    # Fetch new user record for audit
    new_user = await col_company_users.find_one({"id": user_id})

    # Determine changed fields for audit
    audit_old_data = {"status": old_user.get("status")}
    audit_new_data = {"status": new_user.get("status"), "status_reason": body.reason}

    # Log audit trail only if something changed
    await log_audit_trail(
        user_id=admin_info.get("user_id"),
        name=admin_info.get("name"),
        role=admin_info.get("role"),
        company_id=admin_info.get("company_id"),
        action="update_user_status",
        target_table="company_users",
        target_id=user_id,
        old_data=audit_old_data,
        new_data=audit_new_data,
        screen="users"  
    )

    return {
        "message": f"User status updated to {body.status}",
        "history_entry": status_entry
    }

@app.post("/users/{user_id}/restore")
@limiter.limit(get_rate_limit("admin"))
async def restore_user_endpoint(
    request: Request,
    user_id: str, 
    current_user: dict = Depends(require_super_admin)
):
    # Fetch old user record for audit
    old_user = await col_company_users.find_one({"id": user_id, "is_deleted": True})
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found or not deleted")

    restored_by = current_user.get("user_id", "system")
    success = await restore_company_user(user_id, restored_by)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore user")

    # Fetch new user record for audit
    new_user = await col_company_users.find_one({"id": user_id})

    # Determine changed fields only (here mainly is_deleted and maybe status)
    changed_fields = {}
    for field in ["is_deleted", "status", "status_reason"]:
        old_value = old_user.get(field)
        new_value = new_user.get(field)
        if old_value != new_value:
            changed_fields[field] = {"old": old_value, "new": new_value}

    # Prepare old_data and new_data for audit (only changed fields)
    old_data_for_audit = {k: v["old"] for k, v in changed_fields.items()}
    new_data_for_audit = {k: v["new"] for k, v in changed_fields.items()}

    # Log audit trail
    if changed_fields:
        await log_audit_trail(
            user_id=restored_by,
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="restore_user",
            target_table="company_users",
            target_id=user_id,
            old_data=old_data_for_audit,
            new_data=new_data_for_audit,
            screen="users"  
        )

    return {"message": "User restored successfully"}


# --------------------
# Resume Analysis Routes
# --------------------
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.post("/analyze")
@limiter.limit(get_rate_limit("high_traffic"))
async def analyze_resume_endpoint(
    request: Request,
    resume: UploadFile = File(..., description="Resume file (.pdf or .docx)"),
    jd_data: str = Form(..., description="JSON string for JDData"),
    current_user: dict = Depends(get_current_user)
) -> JSONResponse:
    
    try:
        jd: JDData = JDData(**json.loads(jd_data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid jd_data JSON: {e}")

    content = await resume.read()
    page_count = count_pages(content, resume.filename)

    if not await check_usage_limit(current_user["company_id"], page_count):
        current_usage = await get_current_month_usage(current_user["company_id"])
        page_limit = await get_company_page_limit(current_user["company_id"])
        raise HTTPException(
            status_code=429, 
            detail=f"Monthly page limit exceeded. Current usage: {current_usage}/{page_limit}"
        )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(resume.filename)[1]) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        company = await col_companies.find_one(
            {"id": current_user["company_id"], "is_deleted": False},
            {"gemini_api_key": 1, "llama_api_key": 1, "gemini_model": 1}
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Note: These parsing functions might need to be wrapped in asyncio.to_thread if they're synchronous
        # parser_json = await initialize_llama_parser("json", company.get("llama_api_key"))
        # resume_text = await parse_resume(tmp_path, parser_json)
        # if not resume_text:
        #     parser_text = await initialize_llama_parser("text", company.get("llama_api_key"))
        #     resume_text = await parse_resume(tmp_path, parser_text)
        # resume_text = ""
        # try:
        #     parser_json = await initialize_llama_parser("json")
        #     resume_text = await parse_resume(tmp_path, parser_json)
        # except Exception:
        #     parser_text = await initialize_llama_parser("text")
        #     resume_text = await parse_resume(tmp_path, parser_text)
        parser_json = await initialize_llama_parser("json", company.get("llama_api_key"))
        resume_text = await parse_resume(tmp_path, parser_json)

        # ✅ Explicitly check for empty or whitespace-only result
        if not resume_text or not resume_text.strip():
            parser_text = await initialize_llama_parser("text", company.get("llama_api_key"))
            resume_text = await parse_resume(tmp_path, parser_text)

        if not resume_text or not resume_text.strip():
            raise HTTPException(status_code=422, detail="❌ Failed to parse resume text")

        # if not resume_text:
        #     raise HTTPException(status_code=422, detail="Failed to parse resume text")

        # parser_text = await initialize_llama_parser("text", company.get("llama_api_key"))
        # resume_text = await parse_resume(tmp_path, parser_text)
        # if not resume_text:
        #     parser_text = await initialize_llama_parser("json", company.get("llama_api_key"))
        #     resume_text = await parse_resume(tmp_path, parser_text)

        # if not resume_text:
        #     raise HTTPException(status_code=422, detail="❌ Failed to parse resume")
        # parser_json = await initialize_llama_parser("json", company.get("llama_api_key"))
        # resume_text = await parse_resume(tmp_path, parser_json)
        # if not resume_text:
        #     parser_text = await initialize_llama_parser("text", company.get("llama_api_key"))
        #     resume_text = await parse_resume(tmp_path, parser_text)
        # if not resume_text:
        #     raise HTTPException(status_code=422, detail="❌ Failed to parse resume")
        
        gemini_model = await initialize_gemini(
            company.get("gemini_api_key"), 
            company.get("gemini_model", "gemini-2.5-flash")
        )
        

        jd_for_gemini = jd.dict()
        for key in ["location", "budget", "number_of_positions", "work_mode"]:
            jd_for_gemini.pop(key, None)

        analysis = await analyze_resume_comprehensive(
            resume_text, jd_for_gemini, gemini_model, company.get("gemini_api_key")
        )

        store_key = await store_results_in_mongodb(
            analysis,
            jd.dict(),
            resume.filename,
            resume_text,
            content,
            jd.client_name,
            jd.jd_title,
            current_user["user_id"],
            current_user["company_id"],
            current_user.get("name"),
            current_user.get("role")
        )
        await increment_usage(current_user["company_id"], page_count)

        # ------------------ AUDIT LOG ------------------
        # new_data_for_audit = {
        #     k: v for k, v in analysis.items() if k != "file_content"
        # }
        # await log_audit_trail(
        #     user_id=current_user.get("user_id"),
        #     name=current_user.get("name"),
        #     role=current_user.get("role"),
        #     company_id=current_user.get("company_id"),
        #     action="analyze_resume",
        #     target_table="analysis_history",
        #     target_id=store_key,
        #     old_data=None,
        #     new_data=new_data_for_audit,
        #     screen="users"  
        # )
        # ------------------------------------------------

        return JSONResponse(
            status_code=200,
            content={
                "analysis_id": store_key,
                "analysis": analysis,
                "page_count": page_count,
            },
        )
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

@app.get("/history")
@limiter.limit(get_rate_limit("admin"))
async def list_history(
    request: Request,
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    return await fetch_analysis_history(current_user)

@app.get("/download/{analysis_id}")
@limiter.limit(get_rate_limit("admin"))
async def download_resume(
    request: Request,
    analysis_id: str, 
    current_user: dict = Depends(get_current_user)
):
    try:
        # Get analysis record
        analysis = await db.analysis_history.find_one({
            "analysis_id": analysis_id,
            "company_id": current_user["company_id"]
        })
        
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
            
        # If user is not admin, check if they created this analysis
        if current_user["role"] != "company_admin" and analysis["created_by"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this resource")
        
        # Get file content from BSON Binary
        file_content = analysis["file_content"]
        
        # Return file as download
        return StreamingResponse(
            BytesIO(file_content),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={analysis['filename']}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")
    
@app.get("/clients")
@limiter.limit(get_rate_limit("admin"))
async def list_clients(
    request: Request,
    current_user: dict = Depends(get_current_user)
) -> List[str]:
    return await fetch_client_names(current_user["company_id"])

@app.get("/clients/{client_name}/jds")
@limiter.limit(get_rate_limit("admin"))
async def list_jd_names(
    request: Request,
    client_name: str, 
    current_user: dict = Depends(get_current_user)
) -> List[str]:
    jd_names = await fetch_jd_names_for_client(client_name, current_user["company_id"])
    return jd_names or []

@app.get("/clients/{client_name}/jds/{jd_title}")
@limiter.limit(get_rate_limit("admin"))
async def get_jd_details(
    request: Request,
    client_name: str, 
    jd_title: str, 
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    jd = await fetch_client_details_by_jd(client_name, jd_title, current_user["company_id"])
    if not jd:
        raise HTTPException(status_code=404, detail="JD not found")
    return jd

@app.put("/clients/{client_name}/jds/{jd_title}")
@limiter.limit(get_rate_limit("admin"))
async def put_update_jd(
    request: Request,
    client_name: str, 
    jd_title: str, 
    body: UpdateJD, 
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:

    # Fetch existing JD document
    client_doc = await db.clients.find_one({
        "client_name": await to_init_caps(client_name),
        "company_id": current_user["company_id"],
        "is_deleted": False
    })
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    jd_doc = await db.job_descriptions.find_one({
        "client_id": client_doc["_id"],
        "jd_title": await to_init_caps(jd_title),
        "company_id": current_user["company_id"],
        "is_deleted": False
    })
    if not jd_doc:
        raise HTTPException(status_code=404, detail="Job description not found")

    # Determine changed fields
    changed_fields = {}
    for field in ["required_experience", "primary_skills", "secondary_skills"]:
        old_value = jd_doc.get(field)
        new_value = getattr(body, field)
        if old_value != new_value:
            changed_fields[field] = {"old": old_value, "new": new_value}

    if not changed_fields:
        raise HTTPException(status_code=400, detail="No changes detected")

    # Update JD document
    update_success = await update_job_description(
        client_name,
        jd_title,
        body.required_experience,
        body.primary_skills,
        body.secondary_skills,
        current_user["company_id"]
    )
    if not update_success:
        raise HTTPException(status_code=400, detail="Failed to update job description")

    # Prepare old_data and new_data for audit
    old_data_for_audit = {k: v["old"] for k, v in changed_fields.items()}
    new_data_for_audit = {k: v["new"] for k, v in changed_fields.items()}

    # Log audit trail
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="update_job_description",
        target_table="job_descriptions",
        target_id=str(jd_doc["_id"]),
        old_data=old_data_for_audit,
        new_data=new_data_for_audit,
        screen="users"  
    )

    return {"ok": True}

@app.post("/analysis/{analysis_id}/restore")
@limiter.limit(get_rate_limit("admin"))
async def restore_analysis_endpoint(
    request: Request,
    analysis_id: str, 
    current_user: dict = Depends(get_current_user)
):
    # Fetch old data for audit
    old_data = await db.analysis_history.find_one({"analysis_id": analysis_id})
    if not old_data or not old_data.get("is_deleted", True):
        raise HTTPException(status_code=404, detail="Analysis not found or not deleted")
    
    success = await restore_analysis(analysis_id, current_user["company_id"], current_user["user_id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore analysis")

    # Fetch new data for audit
    new_data = await db.analysis_history.find_one({"analysis_id": analysis_id})

    # Log audit
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="restore_analysis",
        target_table="analysis_history",
        target_id=analysis_id,
        old_data={"is_deleted": old_data.get("is_deleted")},
        new_data={"is_deleted": new_data.get("is_deleted")},
        screen="users"  
    )

    return {"message": "Analysis restored"}

@app.post("/clients/{client_name}/restore")
@limiter.limit(get_rate_limit("admin"))
async def restore_client_endpoint(
    request: Request,
    client_name: str, 
    current_user: dict = Depends(get_current_user)
):
    # Fetch old client for audit
    old_client = await db.clients.find_one({
        "client_name": await to_init_caps(client_name),
        "company_id": current_user["company_id"],
        "is_deleted": True
    })
    if not old_client:
        raise HTTPException(status_code=404, detail="Client not found or not deleted")

    success = await restore_client(client_name, current_user["company_id"], current_user["user_id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore client")

    # Fetch new client for audit
    new_client = await db.clients.find_one({"_id": old_client["_id"]})

    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="restore_client",
        target_table="clients",
        target_id=str(old_client["_id"]),
        old_data={"is_deleted": old_client.get("is_deleted")},
        new_data={"is_deleted": new_client.get("is_deleted")},
        screen="users"  
    )

    return {"message": "Client restored"}

@app.post("/clients/{client_name}/jds/{jd_title}/restore")
@limiter.limit(get_rate_limit("admin"))
async def restore_jd_endpoint(
    request: Request,
    client_name: str, 
    jd_title: str, 
    current_user: dict = Depends(get_current_user)
):
    # Fetch old JD for audit
    old_jd = await db.job_descriptions.find_one({
        "jd_title": await to_init_caps(jd_title),
        "company_id": current_user["company_id"],
        "is_deleted": True
    })
    if not old_jd:
        raise HTTPException(status_code=404, detail="Job description not found or not deleted")

    success = await restore_jd(client_name, jd_title, current_user["company_id"], current_user["user_id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore job description")

    # Fetch new JD for audit
    new_jd = await db.job_descriptions.find_one({"_id": old_jd["_id"]})

    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="restore_jd",
        target_table="job_descriptions",
        target_id=str(old_jd["_id"]),
        old_data={"is_deleted": old_jd.get("is_deleted")},
        new_data={"is_deleted": new_jd.get("is_deleted")},
        screen="users"  
    )

    return {"message": "Job description restored"}

# --------------------
# Client Management Endpoints
# --------------------

@app.get("/clients/table-data")
@limiter.limit(get_rate_limit("admin"))
async def get_clients_table_data(
    request: Request,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get clients data in tabular format"""
    try:
        # Build query for clients
        client_query = {
            "company_id": current_user["company_id"],
            "is_deleted": False
        }
        
        if status:
            client_query["status"] = status
            
        clients_cursor = db.clients.find(client_query).sort("client_name", 1)
        clients = await clients_cursor.to_list(length=None)
        
        result = []
        for client in clients:
            # Get active JDs count for active clients
            jd_count = 0
            if client.get("status") == "active":
                jd_count = await db.job_descriptions.count_documents({
                    "client_id": client["_id"],
                    "company_id": current_user["company_id"],
                    "is_deleted": False,
                    "status": "active"
                })
            
            result.append({
                "id": str(client["_id"]),
                "name": client["client_name"],
                "status": client.get("status", "active"),
                "jd_count": jd_count,
                "created_at": client.get("created_at", "")
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch clients: {str(e)}")

@app.get("/job-descriptions/{client_id}")
@limiter.limit(get_rate_limit("admin"))
async def get_job_descriptions_for_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all job descriptions for a specific client"""
    try:
        from bson import ObjectId
        client_oid = ObjectId(client_id)
        
        # Check if client exists and is active
        client = await db.clients.find_one({
            "_id": client_oid,
            "company_id": current_user["company_id"],
            "is_deleted": False,
            "status": "active"
        })
        
        if not client:
            raise HTTPException(status_code=404, detail="Active client not found")
        
        # Get all active JDs for this client
        jds_cursor = db.job_descriptions.find({
            "client_id": client_oid,
            "company_id": current_user["company_id"],
            "is_deleted": False,
            "status": "active"
        }).sort("jd_title", 1)
        
        jds = await jds_cursor.to_list(length=None)
        
        jd_list = []
        for jd in jds:
            jd_list.append({
                "id": str(jd["_id"]),
                "title": jd.get("jd_title", ""),
                "required_experience": jd.get("required_experience", ""),
                "primary_skills": jd.get("primary_skills", []),
                "secondary_skills": jd.get("secondary_skills", []),
                "location": jd.get("location", ""),
                "budget": jd.get("budget", ""),
                "number_of_positions": jd.get("number_of_positions", ""),
                "work_mode": jd.get("work_mode", ""),
                "created_at": jd.get("created_at", "")
            })
        
        return {
            "client_name": client["client_name"],
            "job_descriptions": jd_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch job descriptions: {str(e)}")

@app.put("/clients/{client_id}")
@limiter.limit(get_rate_limit("admin"))
async def update_client(
    request: Request,
    client_id: str,
    client_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update client name with audit logging"""
    try:
        from bson import ObjectId
        client_oid = ObjectId(client_id)

        # Fetch old client for audit
        old_client = await db.clients.find_one({
            "_id": client_oid,
            "company_id": current_user["company_id"],
            "is_deleted": False
        })
        if not old_client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Prepare update values
        new_name = client_data.get("name", old_client["client_name"])

        # Update client name
        result = await db.clients.update_one(
            {"_id": client_oid},
            {"$set": {"client_name": new_name, "updated_at": datetime.now()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update client")

        # Fetch new client data for audit
        new_client = await db.clients.find_one({"_id": client_oid})

        # Log audit trail (only changed data)
        await log_audit_trail(
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="update_client",
            target_table="clients",
            target_id=str(client_oid),
            old_data={"client_name": old_client.get("client_name")},
            new_data={"client_name": new_client.get("client_name")},
            screen="company"  
        )

        return {"message": "Client updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update client: {str(e)}")

@app.patch("/clients/{client_id}/status")
@limiter.limit(get_rate_limit("admin"))
async def update_client_status(
    request: Request,
    client_id: str, 
    status: str = Query(..., description="Status to set"), 
    current_user: dict = Depends(get_current_user)
):
    """Update client status with audit logging"""
    if status not in ["active", "inactive"]:
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")
    
    try:
        from bson import ObjectId
        client_oid = ObjectId(client_id)
        
        # Fetch old client for audit
        old_client = await db.clients.find_one({
            "_id": client_oid,
            "company_id": current_user["company_id"],
            "is_deleted": False
        })
        
        if not old_client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        old_status = old_client.get("status")
        
        # Update client status
        result = await db.clients.update_one(
            {"_id": client_oid},
            {"$set": {"status": status}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update client status")
        
        # Fetch new client data for audit
        new_client = await db.clients.find_one({"_id": client_oid})
        new_status = new_client.get("status")

        # Log audit trail (only changed field)
        await log_audit_trail(
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="update_client_status",
            target_table="clients",
            target_id=str(client_oid),
            old_data={"status": old_status},
            new_data={"status": new_status},
            screen="company"  
        )
        
        return {"message": f"Client status updated to {status}"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update client status: {str(e)}")

@app.put("/job-descriptions/{jd_id}")
@limiter.limit(get_rate_limit("admin"))
async def update_job_description_endpoint(
    request: Request,
    jd_id: str,
    jd_data: dict = Body(...),  # Incoming update fields
    current_user: dict = Depends(get_current_user)
):
    from bson import ObjectId
    jd_oid = ObjectId(jd_id)

    # Fetch old JD for audit
    old_jd = await db.job_descriptions.find_one(
        {"_id": jd_oid, "company_id": current_user["company_id"], "is_deleted": False}
    )
    if not old_jd:
        raise HTTPException(status_code=404, detail="Job description not found")

    # Update JD
    result = await db.job_descriptions.update_one(
        {"_id": jd_oid, "company_id": current_user["company_id"]},
        {"$set": jd_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Nothing updated")

    # Fetch new JD after update
    new_jd = await db.job_descriptions.find_one({"_id": jd_oid})

    # Determine only changed fields
    changed_fields = {}
    for k, new_value in jd_data.items():
        old_value = old_jd.get(k)
        if old_value != new_value:
            changed_fields[k] = {"old": old_value, "new": new_value}

    # If no actual field differences, skip audit
    if not changed_fields:
        return {"message": "No actual changes detected"}

    # Log only changed fields
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="update_job_description",
        target_table="job_descriptions",
        target_id=str(jd_oid),
        old_data={k: v["old"] for k, v in changed_fields.items()},
        new_data={k: v["new"] for k, v in changed_fields.items()},
        screen="company"  
    )

    return {
        "message": "Job description updated successfully",
        "changed_fields": changed_fields
    }

# --------------------
# Dashboard & Usage Routes
# --------------------
@app.get("/dashboard")
@limiter.limit(get_rate_limit("admin"))
async def get_dashboard_data(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    companies_count = await col_companies.count_documents({"is_deleted": False, "status": "active"})
    users_count = await col_company_users.count_documents({"is_deleted": False, "status": "active"})
    inactive_companies_count = await col_companies.count_documents({"is_deleted": False, "status": "inactive"})
    inactive_users_count = await col_company_users.count_documents({"is_deleted": False, "status": "inactive"})
    
    # Get total usage statistics
    total_limit = 0
    total_usage = 0
    companies_cursor = col_companies.find({"is_deleted": False, "status": "active"}, {"id": 1, "monthly_page_limit": 1})
    
    async for company in companies_cursor:
        total_limit += company.get("monthly_page_limit", 1000)
        total_usage += await get_current_month_usage(company["id"])
    
    return {
        "companies_count": companies_count,
        "users_count": users_count,
        "inactive_companies_count": inactive_companies_count,
        "inactive_users_count": inactive_users_count,
        "total_page_limit": total_limit,
        "total_current_usage": total_usage,
        "total_usage_percentage": (total_usage / total_limit * 100) if total_limit > 0 else 0
    }

@app.get("/usage/stats")
@limiter.limit(get_rate_limit("admin"))
async def get_my_usage_stats(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get usage statistics for the current user's company"""
    return await get_usage_stats(current_user["company_id"])

@app.get("/usage/notifications")
@limiter.limit(get_rate_limit("admin"))
async def get_usage_notifications(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get usage notifications for the company"""
    usage_stats = await get_usage_stats(current_user["company_id"])
    notifications = []
    
    if usage_stats["usage_percentage"] >= 90:
        notifications.append({
            "type": "warning",
            "message": f"High usage alert: {usage_stats['current_usage']}/{usage_stats['page_limit']} pages used ({usage_stats['usage_percentage']:.1f}%)"
        })
    elif usage_stats["usage_percentage"] >= 75:
        notifications.append({
            "type": "info",
            "message": f"Usage alert: {usage_stats['current_usage']}/{usage_stats['page_limit']} pages used ({usage_stats['usage_percentage']:.1f}%)"
        })
    
    return notifications

@app.post("/usage/reset/{company_id}")
@limiter.limit(get_rate_limit("admin"))
async def reset_company_usage(
    request: Request,
    company_id: str, 
    current_user: dict = Depends(require_super_admin)
):
    """Reset company's usage for testing (admin only)"""
    current_month = datetime.now().strftime("%Y-%m")

    # Fetch old usage for audit
    old_usage = await db.company_usage.find_one({"company_id": company_id, "month": current_month})
    if not old_usage:
        raise HTTPException(status_code=404, detail="Usage record not found")

    # Perform reset
    new_usage_data = {"page_count": 0, "last_updated": datetime.now()}
    result = await db.company_usage.update_one(
        {"company_id": company_id, "month": current_month},
        {"$set": new_usage_data}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to reset usage")

    # Fetch new usage for audit
    new_usage = await db.company_usage.find_one({"company_id": company_id, "month": current_month})

    # Detect changed fields only
    changed_fields = {}
    for k, new_value in new_usage_data.items():
        old_value = old_usage.get(k)
        if old_value != new_value:
            changed_fields[k] = {"old": old_value, "new": new_value}

    # Skip audit if no change detected
    if not changed_fields:
        return {"message": "No changes detected"}

    # Log only modified fields
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="reset_company_usage",
        target_table="company_usage",
        target_id=f"{company_id}-{current_month}",
        old_data={k: v["old"] for k, v in changed_fields.items()},
        new_data={k: v["new"] for k, v in changed_fields.items()},
        screen="company"  
    )

    return {
        "message": "Usage reset successfully",
        "changed_fields": changed_fields
    }


# --------------------
# Deleted Items Routes
# --------------------
@app.get("/deleted/companies")
@limiter.limit(get_rate_limit("admin"))
async def get_deleted_companies_endpoint(
    request: Request,
    _: str = Depends(require_super_admin)
):
    companies_cursor = col_companies.find({"is_deleted": True}, {"_id": 0})
    return await companies_cursor.to_list(length=None)

@app.get("/deleted/users")
@limiter.limit(get_rate_limit("admin"))
async def get_deleted_users_endpoint(
    request: Request,
    company_id: Optional[str] = None, 
    _: str = Depends(require_super_admin)
):
    query = {"is_deleted": True}
    if company_id:
        query["company_id"] = company_id
    users_cursor = col_company_users.find(query, {"_id": 0})
    return await users_cursor.to_list(length=None)

@app.get("/deleted/analysis")
@limiter.limit(get_rate_limit("admin"))
async def get_deleted_analyses_endpoint(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "company_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    analyses_cursor = db.analysis_history.find({
        "company_id": current_user["company_id"],
        "is_deleted": True
    }, {"file_content": 0})
    return await analyses_cursor.to_list(length=None)

# --------------------
# Health & Root Routes
# --------------------

@app.get("/")
@limiter.limit("120/minute")
async def root(request: Request) -> Dict[str, Any]:
    return {"message": "API is running"}

@app.get("/ui")
@limiter.limit("120/minute")
async def render_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/super-admin-dashboard", response_class=HTMLResponse)
@limiter.limit("120/minute")
async def super_admin_dashboard(request: Request):
    return templates.TemplateResponse("super-admin-dashboard.html", {"request": request})

@app.get("/company-dashboard", response_class=HTMLResponse)
@limiter.limit("120/minute")
async def company_dashboard(request: Request):
    return templates.TemplateResponse("company-dashboard.html", {"request": request})

@app.get("/user-dashboard", response_class=HTMLResponse)
@limiter.limit("120/minute")
async def user_dashboard(request: Request):
    return templates.TemplateResponse("user-dashboard.html", {"request": request})

# --------------------
# Startup Event
# --------------------
@app.on_event("startup")
async def on_startup():
    _ensure_env_loaded()
    os.makedirs("logos", exist_ok=True)
    os.makedirs("logos/users", exist_ok=True)
    try:
        await initialize_mongodb()
        await auto_reset_monthly_usage()
    except Exception as e:
        print(f"Startup error: {e}")
        # Defer errors to first DB call
    # Initialize Gemini model once
    try:
        app.state.gemini_model = await initialize_gemini()
    except Exception as e:
        app.state.gemini_model = None
        print(f"Gemini not initialized: {e}")

#-----country and state ----
@app.get("/countries")
@limiter.limit(get_rate_limit("admin"))
async def get_countries(
    request: Request,
    _: str = Depends(get_current_user)
):
    """
    ✅ Returns all countries
    Accessible by any authenticated user
    """
    countries_cursor = db.countries.find({}, {"_id": 0})
    return await countries_cursor.to_list(length=None)

@app.get("/countries/{country_id}/states")
@limiter.limit(get_rate_limit("admin"))
async def get_states(
    request: Request,
    country_id: str, 
    _: str = Depends(get_current_user)
):
    """
    ✅ Returns all states for a country
    Accessible by any authenticated user
    """
    states_cursor = db.states.find({"country_id": country_id}, {"_id": 0})
    return await states_cursor.to_list(length=None)

# --------------------
# Bank Management Routes
# --------------------
@app.post("/banks", response_model=BankResponse)
@limiter.limit(get_rate_limit("admin"))
async def create_bank(
    request: Request,
    bank: BankCreate, 
    current_user: dict = Depends(get_current_user)
):
    # Check if bank already exists
    existing_bank = await col_banks.find_one({"bank_name": bank.bank_name, "is_deleted": False})
    if existing_bank:
        raise HTTPException(status_code=400, detail="Bank name already exists")
    
    now_iso = datetime.now().isoformat()
    bank_id = str(uuid.uuid4())
    
    bank_doc = {
        "_id": bank_id,
        "id": bank_id,
        "bank_name": bank.bank_name,
        "short_name": bank.short_name,
        "ifsc_prefix": bank.ifsc_prefix,
        "status": bank.status or "active",
        "created_at": now_iso,
        "updated_at": now_iso,
        "is_deleted": False
    }

    # Insert bank
    await col_banks.insert_one(bank_doc)

    # ✅ Audit trail for creation
    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="create_bank",
        target_table="banks",
        target_id=bank_id,
        old_data=None,
        new_data=bank_doc,
        screen="super admin"  
    )

    return BankResponse(**bank_doc)

@app.get("/banks")
@limiter.limit(get_rate_limit("admin"))
async def get_banks(
    request: Request,
    status: Optional[str] = None, 
    _: str = Depends(get_current_user)
):
    query = {"is_deleted": False}
    if status:
        query["status"] = status
        
    items = []
    async for doc in col_banks.find(query, {"_id": 0}).sort("bank_name", 1):
        items.append(doc)
    return items

@app.patch("/banks/{bank_id}", response_model=BankResponse)
@limiter.limit(get_rate_limit("admin"))
async def update_bank(
    request: Request,
    bank_id: str, 
    bank: BankUpdate, 
    current_user: dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in bank.dict(exclude_unset=True).items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Add updated timestamp
    update_data["updated_at"] = datetime.now().isoformat()
    
    # Fetch old data for audit
    old_bank = await col_banks.find_one({"id": bank_id, "is_deleted": False}, {"_id": 0})
    if not old_bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    # Update bank
    updated = await col_banks.find_one_and_update(
        {"id": bank_id, "is_deleted": False},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0}
    )
    
    # Determine changed fields only
    changed_fields_old = {}
    changed_fields_new = {}
    for k in update_data.keys():
        old_value = old_bank.get(k)
        new_value = updated.get(k)
        if old_value != new_value:
            changed_fields_old[k] = old_value
            changed_fields_new[k] = new_value
    
    # Log audit only if something changed
    if changed_fields_old:
        await log_audit_trail(
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="update_bank",
            target_table="banks",
            target_id=bank_id,
            old_data=changed_fields_old,
            new_data=changed_fields_new,
            screen="super admin"  
        )
    
    return BankResponse(**updated)

@app.patch("/banks/{bank_id}/status")
@limiter.limit(get_rate_limit("admin"))
async def update_bank_status(
    request: Request,
    bank_id: str, 
    status: str = Query(..., description="Status to set"), 
    current_user: dict = Depends(get_current_user)
):
    if status not in ["active", "inactive"]:
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")

    # Fetch old bank for audit
    old_bank = await col_banks.find_one({"id": bank_id, "is_deleted": False}, {"_id": 0})
    if not old_bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    old_status = old_bank.get("status")

    # Update status
    result = await col_banks.update_one(
        {"id": bank_id, "is_deleted": False},
        {"$set": {"status": status, "updated_at": datetime.now().isoformat()}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bank not updated")

    # Fetch new bank for audit
    new_bank = await col_banks.find_one({"id": bank_id, "is_deleted": False}, {"_id": 0})
    new_status = new_bank.get("status")

    # Log audit only if changed
    if old_status != new_status:
        await log_audit_trail(
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            company_id=current_user.get("company_id"),
            action="update_bank_status",
            target_table="banks",
            target_id=bank_id,
            old_data={"status": old_status},
            new_data={"status": new_status},
            screen="super admin"  
        )

    return {"message": f"Bank status updated to {status}"}

@app.delete("/banks/{bank_id}")
@limiter.limit(get_rate_limit("admin"))
async def delete_bank(
    request: Request,
    bank_id: str, 
    current_user: dict = Depends(get_current_user)
):
    # Fetch old bank for audit
    old_bank = await col_banks.find_one({"id": bank_id, "is_deleted": False}, {"_id": 0})
    if not old_bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    # Prepare updated fields
    updated_fields = {
        "is_deleted": True,
        "status": "inactive",
        "deleted_at": datetime.now().isoformat(),
        "deleted_by": current_user.get("user_id")
    }

    # Soft delete the bank
    result = await col_banks.update_one(
        {"id": bank_id, "is_deleted": False},
        {"$set": updated_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bank not deleted")

    # Fetch new bank for audit
    new_bank = await col_banks.find_one({"id": bank_id}, {"_id": 0})

    # Log only changed fields
    changed_old_data = {k: old_bank.get(k) for k in updated_fields.keys()}
    changed_new_data = {k: new_bank.get(k) for k in updated_fields.keys()}

    await log_audit_trail(
        user_id=current_user.get("user_id"),
        name=current_user.get("name"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        action="delete_bank",
        target_table="banks",
        target_id=bank_id,
        old_data=changed_old_data,
        new_data=changed_new_data,
        screen="super admin"  
    )

    return {"message": "Bank deleted"}

#rate limit exception handler
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    retry_after = getattr(exc, "retry_after", 60)  # default 60 seconds if missing
    return JSONResponse(
        status_code=429,
        content={
            "error_code": 429,
            "message": "Too many requests. Please slow down.",
            "detail": f"Rate limit exceeded. Try again in {retry_after} seconds",
        },
        headers={"Retry-After": str(retry_after)},
    )


# --------------------
# Main
# --------------------
if __name__ == "__main__":
    import uvicorn
    #uvicorn.run(app, host="192.168.1.140", port=8000)
    uvicorn.run(app, host="127.0.0.1", port=8000)

