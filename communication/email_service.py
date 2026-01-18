import os
import logging
from jinja2 import Environment, FileSystemLoader, select_autoescape
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        template_dir = os.path.join(os.path.dirname(__file__), "templates")
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    def send_email(self, to_email: str, subject: str, template_name: str, context: Dict[str, Any]):
        template = self.env.get_template(template_name)

        # Add common context
        if "login_url" not in context:
            context["login_url"] = f"{self.frontend_url}/login"

        html_content = template.render(**context)

        # MOCK SMTP: Log the email
        logger.info(f"--- MOCK EMAIL SENT ---")
        logger.info(f"To: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Content (preview): {html_content[:200]}...")
        logger.info(f"-----------------------")

    def send_enrollment_welcome(self, to_email: str, pin: str, school_name: str):
        self.send_email(
            to_email=to_email,
            subject=f"Welcome to {school_name}",
            template_name="enrollment_welcome.html",
            context={"email": to_email, "pin": pin, "school_name": school_name}
        )

    def send_payment_receipt(self, to_email: str, fee_id: str, amount: float, date: str, school_name: str):
         self.send_email(
            to_email=to_email,
            subject=f"Payment Receipt - {school_name}",
            template_name="payment_approved.html",
            context={"fee_id": fee_id, "amount": amount, "date": date, "school_name": school_name}
        )

    def send_priority_notice(self, to_emails: List[str], title: str, content: str, school_name: str):
        # In reality, this would loop or use BCC
        # For mock, just log "Sent to X recipients"
        logger.info(f"Processing Priority Notice for {len(to_emails)} recipients")

        # Just render once to verify template
        template = self.env.get_template("priority_notice.html")
        html_content = template.render(title=title, content=content, school_name=school_name)

        logger.info(f"--- PRIORITY NOTICE ---")
        logger.info(f"Recipients: {len(to_emails)}")
        logger.info(f"Subject: URGENT: {title}")
        logger.info(f"Content: {html_content[:200]}...")
        logger.info(f"-----------------------")
