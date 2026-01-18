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

    # Login
    print("Logging in...")
    try:
        page.goto("http://localhost:5173/login")
        page.get_by_placeholder("user@school.com").fill("principal@nepsis.com")
        page.locator("input[type=password]").fill("nepsis123")
        page.get_by_role("button", name="Sign In").click()

        # Wait for Dashboard
        page.wait_for_url("**/dashboard")
        time.sleep(5) # Wait for counts fetch

        # Screenshot 1: Sidebar with Badges and Header with Flag
        print("Taking Screenshot 1: Sidebar & Header...")
        page.screenshot(path="verification/sidebar_badges_header.png")

        # Verify badges are visible
        # Check specific badge numbers if possible, or just presence
        # expect(page.locator("text=2")).to_be_visible() # Notices
        # expect(page.locator("text=3")).to_be_visible() # Complaints

        # Screenshot 2: School Dashboard Overview
        print("Taking Screenshot 2: School Dashboard...")
        # Ensure we are on /dashboard
        page.goto("http://localhost:5173/dashboard")
        time.sleep(3)
        page.screenshot(path="verification/school_dashboard.png")

        # Screenshot 3: God View (Board Dashboard)
        print("Taking Screenshot 3: Board Dashboard...")
        page.goto("http://localhost:5173/dashboard/board-analytics")
        time.sleep(5) # Wait for charts to load
        page.screenshot(path="verification/god_view.png")

    except Exception as e:
        print(f"Verification Failed: {e}")
        page.screenshot(path="verification/failed.png")

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
        pass
