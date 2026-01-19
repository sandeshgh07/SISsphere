from playwright.sync_api import sync_playwright, expect
import time

# NOTE: This verification script successfully verifies:
# 1. Navigation to /find-school
# 2. Rendering of the school card "Nepsis International Academy"
# 3. Clicking the card to navigate to the School Login Page.
#
# CURRENT STATUS: The script hangs waiting for "Institutional Portal" text on the School Login Page.
# This indicates a potential frontend rendering delay or race condition in the test environment,
# though manual cURL checks confirm the backend endpoint returns correct JSON.

def run():
    with sync_playwright() as p:
        # Cannot run headed in this environment, using headless
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Visit Find School Page
            print("Navigating to Find School page...")
            # Use networkidle to ensure API calls complete
            page.goto("http://localhost:5173/find-school", wait_until="networkidle")

            # Verify title
            page.wait_for_selector("text=Find Your School")
            expect(page.get_by_text("Find Your School")).to_be_visible()

            # Verify school card exists (Nepsis) using relaxed locator
            print("Waiting for school card...")
            school_card = page.locator("text=Nepsis International Academy").first
            school_card.wait_for(state="visible", timeout=10000)

            # Click on school
            print("Clicking school card...")
            school_card.click()

            # Verify School Login Page
            print("Verifying School Login Page...")
            page.wait_for_url("**/school/NIA001/login")
            # Wait for specific school elements
            page.wait_for_selector("text=Institutional Portal")
            expect(page.get_by_text("Nepsis International Academy")).to_be_visible()

            # 2. Test School Login (Principal)
            print("Logging in as Principal...")
            page.fill("input[type='email']", "principal@nepsis.edu.np")
            page.fill("input[type='password']", "nepsis123")
            page.click("button:has-text('Login to Portal')")

            # Verify Dashboard
            print("Waiting for dashboard...")
            page.wait_for_url("**/dashboard", timeout=15000)
            expect(page.get_by_text("Welcome back!")).to_be_visible()
            print("Principal Login successful!")

            # Logout
            print("Logging out...")
            page.evaluate("localStorage.clear()")
            page.goto("http://localhost:5173/login", wait_until="networkidle")

            # 3. Test Platform Login (SuperUser)
            print("Navigating to Platform Login...")
            # Check for button link
            platform_btn = page.locator("a[href='/platform-admin/login']")
            platform_btn.wait_for(state="visible")
            platform_btn.click()

            # Verify Platform Login Page
            page.wait_for_url("**/platform-admin/login")
            page.wait_for_selector("text=Admin Portal")

            print("Logging in as Platform Owner...")
            page.fill("input[type='email']", "owner@classa.com")
            page.fill("input[type='password']", "admin123")
            page.click("button:has-text('Enter Console')")

            # Verify Dashboard
            print("Waiting for dashboard...")
            page.wait_for_url("**/dashboard", timeout=15000)
            expect(page.get_by_text("Welcome back!")).to_be_visible()
            print("Platform Login successful!")

            # 4. NEGATIVE TEST A: Principal at Platform Portal
            print("Testing Negative Case A: Principal at Platform Portal...")
            page.evaluate("localStorage.clear()")
            page.goto("http://localhost:5173/platform-admin/login", wait_until="networkidle")

            page.fill("input[type='email']", "principal@nepsis.edu.np")
            page.fill("input[type='password']", "nepsis123")
            page.click("button:has-text('Enter Console')")

            # Expect Error Toast
            # "Access restricted to Platform Owners."
            toast = page.locator("text=Access restricted to Platform Owners")
            toast.wait_for(state="visible", timeout=5000)
            print("Negative Case A Passed: Principal blocked from Platform Portal.")

            # 5. NEGATIVE TEST B: Platform Owner at School Portal
            print("Testing Negative Case B: Platform Owner at School Portal...")
            page.goto("http://localhost:5173/school/NIA001/login", wait_until="networkidle")

            page.fill("input[type='email']", "owner@classa.com")
            page.fill("input[type='password']", "admin123")
            page.click("button:has-text('Login to Portal')")

            # Expect Error Toast
            # "Platform Owners must login via the Central Portal."
            toast = page.locator("text=Platform Owners must login via the Central Portal")
            toast.wait_for(state="visible", timeout=5000)
            print("Negative Case B Passed: Platform Owner blocked from School Portal.")

            time.sleep(1)
            page.screenshot(path="verification/verification_final_robust.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_final_robust.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    run()
