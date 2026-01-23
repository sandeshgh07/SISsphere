
import asyncio
from playwright.async_api import async_playwright
import os

FRONTEND_URL = "http://localhost:5173"
OUTPUT_DIR = "/Users/sandeshghimire/.gemini/antigravity/brain/9bf067cc-c5eb-48aa-9da6-6a7913043600"

async def capture_admin_requests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Optimize visual
        await page.set_viewport_size({"width": 1280, "height": 800})
        
        print("Navigating to Admin Login...")
        await page.goto(f"{FRONTEND_URL}/admin/login")
        
        # Login
        print("Logging in...")
        await page.fill("input[type='email']", "admin@classa.com")
        await page.fill("input[type='password']", "admin123")
        await page.click("button[type='submit']")
        
        # Wait for Dashboard
        await page.wait_for_url("**/platform-admin")
        print("Dashboard loaded.")
        
        # Screenshot Dashboard Logic
        dash_path = os.path.join(OUTPUT_DIR, "admin_dashboard_initial.png")
        await page.screenshot(path=dash_path)
        print(f"Initial Dashboard saved to: {dash_path}")
        
        # Click Requests Button
        print("Opening Requests Panel...")
        await page.click("[data-testid='toggle-requests']")
        
        # Wait a bit for animation/fetch
        await page.wait_for_timeout(3000)
        
        # Take Screenshot regardless of content (table or empty message)
        output_path = os.path.join(OUTPUT_DIR, "admin_requests_inbox_proof.png")
        await page.screenshot(path=output_path)
        print(f"Inbox Screenshot saved to: {output_path}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(capture_admin_requests())
