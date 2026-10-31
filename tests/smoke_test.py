"""
Post-deployment smoke tests, run by CI against the live server.

Unauthenticated checks always run. Authenticated checks run only when
SMOKE_TEST_USER and SMOKE_TEST_PASS are provided (GitHub secrets); use a
dedicated low-privilege account, never a real officer's credentials.

    SMOKE_TEST_URL=https://pms.mcdtronix.co.zw python tests/smoke_test.py

Exit code 0 = healthy; non-zero = the pipeline rolls production back.
"""
import os
import re
import sys

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = os.getenv("SMOKE_TEST_URL", "https://pms.mcdtronix.co.zw").rstrip("/")
TEST_USER = os.getenv("SMOKE_TEST_USER", "")
TEST_PASS = os.getenv("SMOKE_TEST_PASS", "")
TIMEOUT = 15

session = requests.Session()
session.headers["User-Agent"] = "pms-smoke-test/1.0"
_retry = Retry(total=4, backoff_factor=2, status_forcelist=[502, 503, 504],
               allowed_methods=["GET", "HEAD", "OPTIONS"])
session.mount("https://", HTTPAdapter(max_retries=_retry))
session.mount("http://", HTTPAdapter(max_retries=_retry))

failures = []


def check(name, condition, detail=""):
    if condition:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}  {detail}")
        failures.append(name)
    return condition


def test_health():
    r = session.get(f"{BASE_URL}/api/ping/", timeout=TIMEOUT)
    check("API health returns 200", r.status_code == 200, f"got {r.status_code}")
    data = r.json() if "json" in r.headers.get("Content-Type", "") else {}
    check("API reports healthy", data.get("status") == "healthy", str(data)[:200])
    check("Database connected", data.get("database") == "connected", str(data)[:200])


def test_https_redirect():
    if not BASE_URL.startswith("https://"):
        return
    r = session.get(BASE_URL.replace("https://", "http://", 1) + "/",
                    timeout=TIMEOUT, allow_redirects=False)
    check("HTTP redirects to HTTPS", r.status_code in (301, 308)
          and r.headers.get("Location", "").startswith("https://"),
          f"got {r.status_code} -> {r.headers.get('Location')}")


def test_spa():
    r = session.get(f"{BASE_URL}/", timeout=TIMEOUT)
    check("SPA index returns 200", r.status_code == 200, f"got {r.status_code}")
    check("SPA index has root element", 'id="root"' in r.text)
    assets = re.findall(r'(?:src|href)="(/assets/[^"]+)"', r.text)
    check("SPA references built assets", bool(assets))
    for path in assets:
        a = session.get(f"{BASE_URL}{path}", timeout=TIMEOUT)
        check(f"Asset {path} loads", a.status_code == 200, f"got {a.status_code}")

    deep = session.get(f"{BASE_URL}/reception/dashboard", timeout=TIMEOUT)
    check("SPA deep link falls back to index", deep.status_code == 200 and 'id="root"' in deep.text,
          f"got {deep.status_code}")


def test_auth_rejects_bad_credentials():
    r = session.post(f"{BASE_URL}/api/auth/login/",
                     json={"username": "__smoke_probe__", "password": "invalid"},
                     timeout=TIMEOUT)
    check("Login rejects bad credentials", r.status_code in (400, 401, 403), f"got {r.status_code}")


def test_api_requires_auth():
    r = session.get(f"{BASE_URL}/api/reception/inmates/", timeout=TIMEOUT)
    check("Protected API rejects anonymous", r.status_code in (401, 403), f"got {r.status_code}")


def test_media_not_public():
    r = session.get(f"{BASE_URL}/media/", timeout=TIMEOUT)
    check("Media directory not publicly served", r.status_code in (403, 404), f"got {r.status_code}")


def test_authenticated_flow():
    if not (TEST_USER and TEST_PASS):
        print("  SKIP  authenticated checks (SMOKE_TEST_USER / SMOKE_TEST_PASS not set)")
        return
    r = session.post(f"{BASE_URL}/api/auth/login/",
                     json={"username": TEST_USER, "password": TEST_PASS}, timeout=TIMEOUT)
    if not check("Login with smoke account", r.status_code == 200, f"got {r.status_code}"):
        return
    data = r.json()
    token = data.get("access") or data.get("token")
    if not check("Login returns access token", bool(token)):
        return
    auth = {"Authorization": f"Bearer {token}"}
    r = session.get(f"{BASE_URL}/api/reception/inmates/", headers=auth, timeout=TIMEOUT)
    check("Inmate list returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code == 200:
        body = r.json()
        check("Inmate list is paginated/list", isinstance(body, list) or "results" in body)


def main():
    print(f"PMS smoke tests -> {BASE_URL}")
    for test in (test_health, test_https_redirect, test_spa,
                 test_auth_rejects_bad_credentials, test_api_requires_auth,
                 test_media_not_public, test_authenticated_flow):
        print(f"\n[{test.__name__}]")
        try:
            test()
        except requests.RequestException as exc:
            check(test.__name__, False, f"request error: {exc}")
    print()
    if failures:
        print(f"FAILED: {len(failures)} check(s): {', '.join(failures)}")
        sys.exit(1)
    print("ALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()
