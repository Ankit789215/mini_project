from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"URL: {url}")
print(f"Key preview: {key[:10]}...")

supabase = create_client(url, key)

try:
    # Try to list patients
    res = supabase.table("patients").select("*").limit(1).execute()
    print("Success: Connected to 'patients' table.")
    print(res.data)
except Exception as e:
    print(f"Error: {e}")
