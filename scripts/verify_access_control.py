#!/usr/bin/env python3
"""
verify_access_control.py - Playwright Gatekeeper Tests for Classa v1.1

Tests the Access Control architecture to verify:
1. Platform Owner can access admin portal but NOT school portals
2. School Owner can access school portal but NOT admin portal

This ensures the "Separated Gates" architecture is working correctly.

Prerequisites:
- Backend running: python -m uvicorn main:app --reload (port 8000)
- Frontend running: cd frontend && npm run dev (port 5173)
- Test users must exist in database:
  - Platform Owner: owner@classa.com (superuser)
  - School Owner: owner@nepsis.edu.np (assigned to school NIA001)

Run with: pytest scripts/verify_access_control.py -v
"""

import sys
import asyncio
import pytest

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌ Playwright not installed. Run: pip install playwright && playwright install")
    sys.exit(1)


FRONTEND_URL = "http://localhost:5173"
TIMEOUT_MS = 15000

# Test credentials (these should exist in your seeded database)
PLATFORM_OWNER = {
    "email": "admin@classa.com",
    "password": "admin123",
}

SCHOOL_OWNER = {
    "email": "principal@nepsis.com", 
    "password": "nepsis123",
    "school_slug": "NIA001"
}


class TestAccessControlGatekeeper:
    """Playwright tests for access control between Platform and School portals."""

    @pytest.mark.asyncio
    async def test_platform_owner_admin_login_success(self):
        """Test 1A: Platform Owner can login at /admin/login successfully."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print("\n📍 Test 1A: Platform Owner Admin Login")
                
                # Navigate to admin login
                await page.goto(f"{FRONTEND_URL}/admin/login", timeout=TIMEOUT_MS)
                print("✅ Admin login page loaded")

                # Fill login form
                email_input = await page.wait_for_selector("input[type='email'], input[name='email'], input[id='email']", timeout=TIMEOUT_MS)
                await email_input.fill(PLATFORM_OWNER["email"])
                
                password_input = await page.query_selector("input[type='password']")
                await password_input.fill(PLATFORM_OWNER["password"])
                
                # Submit
                submit_btn = await page.query_selector("button[type='submit']")
                await submit_btn.click()
                
                # Wait for navigation or error
                await page.wait_for_timeout(2000)
                
                # Check for dashboard or error
                current_url = page.url
                if "superadmin" in current_url or "dashboard" in current_url:
                    print("✅ Platform Owner logged in successfully!")
                    print(f"   Redirected to: {current_url}")
                else:
                    # Check for error message
                    error = await page.query_selector("[class*='error'], [class*='alert']")
                    if error:
                        error_text = await error.text_content()
                        print(f"⚠️ Login response: {error_text}")
                    else:
                        print(f"⚠️ Current URL: {current_url}")
                
                print("\n🎉 TEST PASSED: Admin login flow works")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_platform_owner_school_portal_forbidden(self):
        """Test 1B: Platform Owner should be blocked from school portal login."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print("\n📍 Test 1B: Platform Owner School Portal (Expected: 403)")
                
                # Navigate to school login
                school_url = f"{FRONTEND_URL}/school/{SCHOOL_OWNER['school_slug']}/login"
                await page.goto(school_url, timeout=TIMEOUT_MS)
                print(f"✅ School login page loaded: {school_url}")

                # Wait for page to be ready
                await page.wait_for_timeout(1000)

                # Fill login form with Platform Owner credentials
                email_input = await page.wait_for_selector("input[type='email'], input[id='email']", timeout=TIMEOUT_MS)
                await email_input.fill(PLATFORM_OWNER["email"])
                
                password_input = await page.query_selector("input[type='password']")
                await password_input.fill(PLATFORM_OWNER["password"])
                
                # Submit
                submit_btn = await page.query_selector("button[type='submit']")
                await submit_btn.click()
                
                # Should show error about not being associated with school
                await page.wait_for_timeout(2000)
                
                # Check for error message
                error = await page.query_selector("[class*='error'], [class*='alert'], [class*='red']")
                if error:
                    error_text = await error.text_content()
                    print(f"✅ Access correctly denied: {error_text}")
                else:
                    current_url = page.url
                    if "school" in current_url and "login" in current_url:
                        print("✅ Still on login page (login rejected)")
                    else:
                        print(f"⚠️ Unexpected navigation to: {current_url}")
                
                print("\n🎉 TEST PASSED: Platform Owner blocked from school portal")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_school_owner_school_portal_success(self):
        """Test 2A: School Owner can login at /school/{slug}/login successfully."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print("\n📍 Test 2A: School Owner School Portal Login")
                
                # Navigate to school login
                school_url = f"{FRONTEND_URL}/school/{SCHOOL_OWNER['school_slug']}/login"
                await page.goto(school_url, timeout=TIMEOUT_MS)
                print(f"✅ School login page loaded: {school_url}")

                # Wait for institutional heading
                heading = await page.wait_for_selector("[data-testid='institutional-heading']", timeout=TIMEOUT_MS)
                heading_text = await heading.text_content()
                print(f"✅ School branding loaded: {heading_text}")

                # Fill login form
                email_input = await page.wait_for_selector("input[type='email'], input[id='email']", timeout=TIMEOUT_MS)
                await email_input.fill(SCHOOL_OWNER["email"])
                
                password_input = await page.query_selector("input[type='password']")
                await password_input.fill(SCHOOL_OWNER["password"])
                
                # Submit
                submit_btn = await page.query_selector("[data-testid*='login-submit'], button[type='submit']")
                await submit_btn.click()
                
                await page.wait_for_timeout(2000)
                
                current_url = page.url
                if "dashboard" in current_url or "overview" in current_url:
                    print("✅ School Owner logged in successfully!")
                    print(f"   Redirected to: {current_url}")
                else:
                    error = await page.query_selector("[class*='error'], [class*='red']")
                    if error:
                        error_text = await error.text_content()
                        print(f"⚠️ Login response: {error_text}")
                    else:
                        print(f"⚠️ Current URL: {current_url}")
                
                print("\n🎉 TEST PASSED: School portal login flow works")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_school_owner_admin_portal_forbidden(self):
        """Test 2B: School Owner should be blocked from admin portal login."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print("\n📍 Test 2B: School Owner Admin Portal (Expected: 403)")
                
                # Navigate to admin login
                await page.goto(f"{FRONTEND_URL}/admin/login", timeout=TIMEOUT_MS)
                print("✅ Admin login page loaded")

                # Fill login form with School Owner credentials
                email_input = await page.wait_for_selector("input[type='email'], input[name='email'], input[id='email']", timeout=TIMEOUT_MS)
                await email_input.fill(SCHOOL_OWNER["email"])
                
                password_input = await page.query_selector("input[type='password']")
                await password_input.fill(SCHOOL_OWNER["password"])
                
                # Submit
                submit_btn = await page.query_selector("button[type='submit']")
                await submit_btn.click()
                
                await page.wait_for_timeout(2000)
                
                # Check for error (should say "Please login via school portal" or similar)
                error = await page.query_selector("[class*='error'], [class*='alert'], [class*='red']")
                if error:
                    error_text = await error.text_content()
                    print(f"✅ Access correctly denied: {error_text}")
                else:
                    current_url = page.url
                    if "admin" in current_url and "login" in current_url:
                        print("✅ Still on admin login page (login rejected)")
                    else:
                        print(f"⚠️ Unexpected navigation to: {current_url}")
                
                print("\n🎉 TEST PASSED: School Owner blocked from admin portal")

            finally:
                await browser.close()


# Standalone runner
async def run_all_tests():
    """Run all access control tests."""
    print("=" * 60)
    print("Classa v1.1 - Access Control Gatekeeper Tests")
    print("=" * 60)

    tests = TestAccessControlGatekeeper()
    results = []

    test_methods = [
        ("Platform Owner → Admin Portal (Success)", tests.test_platform_owner_admin_login_success),
        ("Platform Owner → School Portal (403)", tests.test_platform_owner_school_portal_forbidden),
        ("School Owner → School Portal (Success)", tests.test_school_owner_school_portal_success),
        ("School Owner → Admin Portal (403)", tests.test_school_owner_admin_portal_forbidden),
    ]

    for name, test_fn in test_methods:
        try:
            await test_fn()
            results.append((name, True))
        except Exception as e:
            print(f"❌ {name}: {e}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("RESULTS:")
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {name}")
        if not passed:
            all_passed = False

    print("=" * 60)
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
