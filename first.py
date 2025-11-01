import uuid, bcrypt
from datetime import datetime
from pymongo import MongoClient

# Connect with proper DB
#client = MongoClient("mongodb://tladmin:TlAdminDh@103.146.234.83:27017/?authSource=admin")
client = MongoClient("mongodb+srv://DhineshMongoDBTest:Dhinesh@2507@cluster0.grsibcj.mongodb.net/")
# Select database
db = client["tlrecruitdb"]

# Create unique index on email
db.super_admins.create_index("email", unique=True)

# Hash password
password_hash = bcrypt.hashpw(b"123456", bcrypt.gensalt()).decode("utf-8")

# Super admin document
admin = {
    "_id": str(uuid.uuid4()),   # internal unique ID
    "id": str(uuid.uuid4()),    # your own app ID
    "name": "Super Admin",
    "email": "cdhinesh2001@gmail.com",
    "password": password_hash,
    "role": "super_admin",
    "created_at": datetime.now()
}

# Insert document
result = db.super_admins.insert_one(admin)
print("✅ Seeded super admin with _id:", result.inserted_id)
