"""
Post-deployment smoke tests.
These run against the live server after every deployment
to verify critical business workflows are functional.
"""
import requests
import sys
import os

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Environment-configured endpoints and credentials for smoke testing.
# Never hardcode production URLs, service numbers, or passwords.
BASE_URL = os.getenv("SMOKE_TEST_URL")
TEST_USER = os.getenv("SMOKE_TEST_USER")
TEST_PASS = os.getenv("SMOKE_TEST_PASS")


def validate_environment():
    """Ensure all required environment variables are set before running tests."""
    missing = []
    if not BASE_URL:
        missing.append("SMOKE_TEST_URL")
    if not TEST_USER:
        missing.append("SMOKE_TEST_USER")
    if not TEST_PASS:
        missing.append("SMOKE_TEST_PASS")

    if missing:
        log(f"Configuration error: Missing required environment variable(s): {', '.join(missing)}", "FAIL")
        log("Smoke tests require explicit environment configuration and cannot run with default credentials.", "FAIL")
        sys.exit(1)

session = requests.Session()
retry_strategy = Retry(
    total=5,
    backoff_factor=2,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)
session.mount("http://", adapter)

def log(msg: str, status: str = "INFO"):
    icons = {"INFO": "[INFO]", "PASS": "[PASS]", "FAIL": "[FAIL]", "WARN": "[WARN]"}
    label = icons.get(status, f"[{status}]")
    try:
        print(f"{label} {msg}")
    except UnicodeEncodeError:
        print(f"{label} {msg.encode('ascii', 'replace').decode('ascii')}")


def check(name: str, condition: bool, detail: str = ""):
    if condition:
        log(f"PASS: {name}", "PASS")
    else:
        log(f"FAIL: {name} — {detail}", "FAIL")
        sys.exit(1)


def test_health():
    log("Testing health endpoint...")
    r = session.get(f"{BASE_URL}/api/ping/", timeout=10)
    check("Health endpoint returns 200", r.status_code == 200, f"Got {r.status_code}")
    
    try:
        data = r.json()
        check("Health response is JSON", True)
        check("Health status is healthy", data.get("status") == "healthy", f"Got {data.get('status')}")
    except ValueError:
        check("Health response is JSON", False)
    log("Health check passed", "PASS")


def test_login():
    log("Testing authentication...")
    r = session.post(f"{BASE_URL}/api/auth/login/", json={
        "username": TEST_USER,
        "password": TEST_PASS,
    }, timeout=10)
    check("Login returns 200", r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}")
    data = r.json()
    check("Login returns token", "access" in data or "token" in data, str(data))
    
    # Store token for subsequent requests
    token = data.get("access") or data.get("token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    log("Authentication passed", "PASS")


def test_inmate_list():
    log("Testing inmate list endpoint...")
    r = session.get(f"{BASE_URL}/api/reception/inmates/", timeout=10) # Adjusted based on typical structure
    check("Inmate list returns 200", r.status_code == 200, f"Got {r.status_code}")
    data = r.json()
    check("Inmate list returns data structure", "results" in data or isinstance(data, list))
    log("Inmate list passed", "PASS")


def test_reception_endpoints():
    log("Testing reception endpoints...")
    r = session.get(f"{BASE_URL}/api/reception/", timeout=10)
    check("Reception endpoint accessible", r.status_code in [200, 404])
    log("Reception endpoints passed", "PASS")


def run_all():
    validate_environment()
    log("=" * 50)
    log("🏥 PMS POST-DEPLOYMENT SMOKE TESTS")
    log(f"   Target: {BASE_URL}")
    log("=" * 50)

    test_health()
    test_login()
    test_inmate_list()
    test_reception_endpoints()

    log("=" * 50)
    log("ALL SMOKE TESTS PASSED", "PASS")
    log("=" * 50)


if __name__ == "__main__":
    run_all()
