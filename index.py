from pymongo import MongoClient

client = MongoClient("mongodb+srv://DhineshMongoDBTest:Dhinesh@2507@cluster0.grsibcj.mongodb.net/")
db = client["tlrecruitdb"]

# Example indexes
db.super_admins.create_index("email", unique=True)
db.companies.create_index("id", unique=True)
db.company_users.create_index("email")
db.password_resets.create_index("email")
db.banks.create_index("bank_name")
db.audit_logs.create_index("company_id")
db.clients.create_index([("company_id", 1), ("client_name", 1)], unique=True)
db.job_descriptions.create_index([("client_id", 1), ("jd_title", 1)], unique=True)
db.analysis_history.create_index("analysis_id", unique=True)
db.company_usage.create_index([("company_id", 1), ("month", 1)], unique=True)
db.states.create_index("country_id")



