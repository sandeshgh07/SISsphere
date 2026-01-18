import jinja2
import os
from typing import Dict, Any

# Mock Email Service for now, but prints logic as requested.
# In a real app, this would use a mail library (e.g. smtplib, aiosmtplib, SendGrid, etc.)

TEMPLATE_DIR = os.path.join(os.getcwd(), "templates")
template_loader = jinja2.FileSystemLoader(searchpath=TEMPLATE_DIR)
template_env = jinja2.Environment(loader=template_loader)

class EmailService:
    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        try:
            template = template_env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            print(f"Error rendering template {template_name}: {e}")
            return ""

    def send_email(self, to_email: str, subject: str, html_content: str):
        # In PROD, send via SMTP
        # Here we log it to console/file for verification
        print(f"--- EMAIL SENT ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        # print(f"Content: {html_content}") # Omit full content in logs to avoid spamming console
        print(f"Content Length: {len(html_content)}")
        print(f"--- END EMAIL ---")

    def send_enrollment_email(self, to_email: str, student_name: str, login_url: str, username: str, pin: str, school_name: str):
        subject = f"Welcome to {school_name} - Enrollment Complete"
        context = {
            "student_name": student_name,
            "login_url": login_url,
            "username": username,
            "pin": pin,
            "school_name": school_name,
            "school_address": "123 Education Lane, Knowledge City", # Mock dynamic address
            "year": "2026"
        }
        html = self._render_template("enrollment_success.html", context)
        self.send_email(to_email, subject, html)

    def send_high_priority_notice(self, to_email: str, title: str, message: str, school_name: str):
        subject = f"URGENT: {title}"
        context = {
            "title": title,
            "message": message,
            "school_name": school_name,
            "year": "2026"
        }
        html = self._render_template("high_priority_notice.html", context)
        self.send_email(to_email, subject, html)

email_service = EmailService()
