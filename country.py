import os
from dotenv import load_dotenv
import uuid
load_dotenv()
# --------------------
# Environment / Clients
# --------------------
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
col_countries = db["countries"]
col_states = db["states"]

# Insert country (India)
col_countries = db["countries"]

col_countries.insert_one({
    "id": "in",
    "name": "India"
})


# List of Indian states
col_states = db["states"]

indian_states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi (National Capital Territory)", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
]

state_docs = [
    {
        "id": s.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("-", "_"),
        "country_id": "in",
        "name": s
    } for s in indian_states
]

col_states.insert_many(state_docs)


print("India country and all states added successfully!")


import uuid
from datetime import datetime
from pymongo import MongoClient

def upload_all_banks():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    col_banks = db["banks"]

    # (bank_name, short_name, ifsc_prefix)
    banks_data = [
        ("State Bank of India", "SBI", "SBIN"),
        ("Punjab National Bank", "PNB", "PUNB"),
        ("Bank of Baroda", "BOB", "BARB"),
        ("Canara Bank", "CNB", "CNRB"),
        ("Union Bank of India", "UBI", "UBIN"),
        ("Indian Bank", "IB", "IDIB"),
        ("Bank of Maharashtra", "BOM", "MAHB"),
        ("Indian Overseas Bank", "IOB", "IOBA"),
        ("UCO Bank", "UCO", "UCBA"),
        ("Central Bank of India", "CBI", "CBIN"),
        ("Punjab & Sind Bank", "PSB", "PSIB"),
        ("Bank of India", "BOI", "BKID"),
        ("HDFC Bank", "HDFC", "HDFC"),
        ("ICICI Bank", "ICICI", "ICIC"),
        ("Axis Bank", "AXIS", "UTIB"),
        ("IDBI Bank", "IDBI", "IBKL"),
        ("IndusInd Bank", "IIB", "INDB"),
        ("Kotak Mahindra Bank", "KMB", "KKBK"),
        ("Yes Bank", "YESB", "YESB"),
        ("Bandhan Bank", "BDBL", "BDBL"),
        ("RBL Bank", "RBL", "RATN"),
        ("IDFC First Bank", "IDFC", "IDFB"),
        ("Federal Bank", "FBL", "FDRL"),
        ("Karur Vysya Bank", "KVB", "KVBL"),
        ("Dhanlaxmi Bank", "DLB", "DLXB"),
        ("City Union Bank", "CUB", "CIUB"),
        ("South Indian Bank", "SIB", "SIBL"),
        ("Tamilnad Mercantile Bank", "TMB", "TMBL"),
        ("Karnataka Bank", "KBL", "KARB"),
        ("DCB Bank", "DCB", "DCBL"),
        ("SBM Bank (India)", "SBM", "STCB"),
        ("Jana Small Finance Bank", "JSFB", "JSFB"),
        ("Equitas Small Finance Bank", "ESFB", "ESFB"),
        ("AU Small Finance Bank", "AUBL", "AUBL"),
        ("Suryoday Small Finance Bank", "SSF", "SURY"),
        ("Utkarsh Small Finance Bank", "USF", "UTKS"),
        ("ESAF Small Finance Bank", "EAF", "ESMF"),
        ("Fino Payments Bank", "FIP", "FINO"),
        ("Airtel Payments Bank", "AIRP", "AIRP"),
        ("India Post Payments Bank", "IPB", "IPOS"),
        ("Paytm Payments Bank", "PYTM", "PYTM"),
        ("Andhra Pragathi Grameena Bank", "APGB", "APGB"),
        ("Andhra Pradesh Grameena Vikas Bank", "APGV", "APGV"),
        ("Aryavart Bank", "ARYA", "ARYA"),
        ("Assam Gramin Vikash Bank", "AGVB", "AGVB"),
        ("Baroda Gujarat Gramin Bank", "BGGB", "BARB"),
        ("Baroda Rajasthan Kshetriya Gramin Bank", "BRKGB", "BARB"),
        ("Bangiya Gramin Vikash Bank", "BGVB", "PUNB"),
        ("Baroda UP Bank", "BUB", "BARB"),
        ("Chaitanya Godavari Grameena Bank", "CGGB", "ANDB"),
        ("Chhattisgarh Rajya Gramin Bank", "CRGB", "SBIN"),
        ("Himachal Pradesh Gramin Bank", "HPGB", "PUNB"),
        ("J&K Grameen Bank", "JKGB", "JAKA"),
        ("Jharkhand Rajya Gramin Bank", "JRGB", "SBIN"),
        ("Karnataka Gramin Bank", "KGB", "PKGB"),
        ("Karnataka Vikas Grameena Bank", "KVGB", "KVGB"),
        ("Kerala Gramin Bank", "KGB", "KLGB"),
        ("Maharashtra Gramin Bank", "MGB", "MAHG"),
        ("Meghalaya Rural Bank", "MRB", "SBIN"),
        ("Mizoram Rural Bank", "MRB", "SBIN"),
        ("Nagaland Rural Bank", "NRB", "HDFC"),
        ("Odisha Gramya Bank", "OGB", "OSCB"),
        ("Paschim Banga Gramin Bank", "PBGB", "ABHY"),
        ("Puduvai Bharathiar Grama Bank", "PBGB", "IOBA"),
        ("Rajasthan Marudhara Gramin Bank", "RMGB", "RMGB"),
        ("Saurashtra Gramin Bank", "SGB", "SBIN"),
        ("Sarva Haryana Gramin Bank", "SHGB", "PUNB"),
        ("Telangana Grameena Bank", "TGB", "SBIN"),
        ("Tripura Gramin Bank", "TGB", "PUNB"),
        ("Uttarakhand Gramin Bank", "UGB", "SBIN"),
        ("Saraswat Co-operative Bank", "SRCB", "SRCB"),
        ("Cosmos Bank", "COSB", "COSB"),
        ("Abhyudaya Co-operative Bank", "ABHY", "ABHY"),
        ("TJSB Sahakari Bank", "TJSB", "TJSB"),
        ("The Shamrao Vithal Co-operative Bank", "SVCB", "SVCB"),
        ("Vasai Janata Sahakari Bank", "VJS", "VASJ"),
        ("Janata Sahakari Bank Pune", "JSBP", "JSBP"),
        ("Mehsana Urban Co-operative Bank", "MUCB", "MSNU"),
        ("The Ahmedabad District Co-operative Bank", "ADCBL", "GSCB"),
        ("The Baroda Central Co-operative Bank", "BCCB", "ICIC"),
        ("The Surat Peoples Co-operative Bank", "SPCB", "SPCB"),
        ("The Sangli Urban Co-operative Bank", "SUCB", "SUTB"),
        ("The Akola District Central Co-operative Bank", "ADCCB", "ADCC"),
        ("DBS Bank India", "DBS", "DBSS"),
        ("Deutsche Bank", "DEUT", "DEUT"),
        ("HSBC Bank", "HSBC", "HSBC"),
        ("Standard Chartered Bank", "SCBL", "SCBL"),
        ("Bank of America", "BOFA", "BOFA"),
        ("Citibank", "CITI", "CITI"),
        ("Royal Bank of Scotland", "RBS", "ABNA"),
        ("Bank of Ceylon", "BCEL", "BCEY"),
        ("The Jammu and Kashmir Bank", "JKB", "JAKA")
    ]

    docs = []
    now = datetime.utcnow().isoformat()

    for bank_name, short_name, ifsc_prefix in banks_data:
        uid = str(uuid.uuid4())
        doc = {
            "_id": uid,
            "id": uid,
            "bank_name": bank_name,
            "short_name": short_name,
            "ifsc_prefix": ifsc_prefix,
            "status": "active",
            "created_at": now,
            "updated_at": now,
            "is_deleted": False
        }
        docs.append(doc)

    if docs:
        col_banks.insert_many(docs)
        print(f"✅ Inserted {len(docs)} banks successfully!")

# Run it
upload_all_banks()
