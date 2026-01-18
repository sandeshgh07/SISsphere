import time
import os
import sys
from datetime import datetime, timedelta

# Add root to sys.path
sys.path.append(os.getcwd())

from database import SessionLocal
from schools.models import School
from playwright.sync_api import sync_playwright, expect

def set_school_expiry(days_offset):
    db = SessionLocal()
    try:
        school = db.query(School).filter(School.code == "NIA001").first()
        school.subscription_expiry = datetime.utcnow() + timedelta(days=days_offset)
        school.is_active = True
        db.commit()
    finally:
        db.close()

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

    # 1. Landing Page
    print("Navigating to Landing Page...")
    try:
        page.goto("http://localhost:5173/")
        time.sleep(5)
        page.screenshot(path="verification/landing_debug.png")
        expect(page.get_by_role("heading", name="Classa Enterprise")).to_be_visible(timeout=5000)
        print("Screenshot Landing Page.")
    except Exception as e:
        print(f"Landing Page Failed: {e}")
        page.screenshot(path="verification/landing_failed.png")
        return

    # 2. Login
    print("Logging in...")
    try:
        page.get_by_role("button", name="Login").click()
        page.wait_for_url("**/login")

        page.get_by_placeholder("user@school.com").fill("principal@nepsis.com")
        page.locator("input[type=password]").fill("nepsis123")
        page.get_by_role("button", name="Sign In").click()

        # Wait for Dashboard
        page.wait_for_url("**/dashboard")
        time.sleep(5)
        expect(page.get_by_text("Welcome back!")).to_be_visible()
        page.screenshot(path="verification/dashboard_active.png")
        print("Screenshot Active Dashboard.")
    except Exception as e:
        print(f"Login Failed: {e}")
        page.screenshot(path="verification/login_failed.png")
        return

    # 3. Trigger Warning/Grace (Expired -15 days)
    print("Setting expiry to -15 days...")
    set_school_expiry(-15)

    # Re-login to refresh token
    print("Re-logging in for Grace...")
    page.goto("http://localhost:5173/login")
    page.get_by_placeholder("user@school.com").fill("principal@nepsis.com")
    page.locator("input[type=password]").fill("nepsis123")
    page.get_by_role("button", name="Sign In").click()
    page.wait_for_url("**/dashboard")
    time.sleep(5)

    try:
        expect(page.get_by_text("Subscription Expired:")).to_be_visible()
        page.screenshot(path="verification/dashboard_grace.png")
        print("Screenshot Grace Banner.")
    except Exception as e:
        print(f"Grace Banner Failed: {e}")
        page.screenshot(path="verification/grace_failed.png")


    # 4. Trigger Hard Lockout (Expired -35 days)
    print("Setting expiry to -35 days...")
    set_school_expiry(-35)

    # Re-login to refresh token
    print("Re-logging in for Suspended...")
    page.goto("http://localhost:5173/login")
    page.get_by_placeholder("user@school.com").fill("principal@nepsis.com")
    page.locator("input[type=password]").fill("nepsis123")
    page.get_by_role("button", name="Sign In").click()

    # Here, hard lockout might prevent API calls, but we check if DashboardLayout renders AccountSuspended.
    # But wait, AccountSuspended check is: `if (daysPast >= 34) return <AccountSuspended />`
    # This runs inside DashboardLayout.
    # Does Login redirect to Dashboard? Yes.
    # So we should land on /dashboard and see AccountSuspended.

    time.sleep(5)

    try:
        expect(page.get_by_text("Account Suspended")).to_be_visible()
        page.screenshot(path="verification/suspended.png")
        print("Screenshot Account Suspended.")
    except Exception as e:
        print(f"Suspended Page Failed: {e}")
        page.screenshot(path="verification/suspended_failed.png")

    browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")

    # Ensure DB is in good state first
    set_school_expiry(365)

    try:
        with sync_playwright() as playwright:
            run(playwright)
    finally:
        # Reset DB
        set_school_expiry(365)
