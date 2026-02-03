"""
Classa Enterprise Email Service
Production-ready email service using environment-based configuration.
"""
import os
from typing import Dict, Any, Optional, List
import jinja2

try:
    from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
    FASTAPI_MAIL_AVAILABLE = True
except ImportError:
    FASTAPI_MAIL_AVAILABLE = False

from config import settings

# Template configuration
TEMPLATE_DIR = os.path.join(os.getcwd(), "templates")
template_loader = jinja2.FileSystemLoader(searchpath=TEMPLATE_DIR)
template_env = jinja2.Environment(loader=template_loader)


def get_mail_config() -> Optional["ConnectionConfig"]:
    """Get FastMail connection config if email is configured."""
    if not FASTAPI_MAIL_AVAILABLE:
        return None
    
    if not settings.email_configured:
        return None
    
    return ConnectionConfig(
        MAIL_USERNAME=settings.mail_username,
        MAIL_PASSWORD=settings.mail_password,
        MAIL_FROM=settings.mail_from,
        MAIL_PORT=settings.mail_port,
        MAIL_SERVER=settings.mail_server,
        MAIL_STARTTLS=settings.mail_starttls,
        MAIL_SSL_TLS=settings.mail_ssl_tls,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
        TEMPLATE_FOLDER=TEMPLATE_DIR
    )


class EmailService:
    """
    Email service with automatic fallback to console logging.
    Uses FastMail when properly configured, otherwise logs to console.
    """
    
    def __init__(self):
        self._config = get_mail_config()
        self._fastmail = None
        
        if self._config and FASTAPI_MAIL_AVAILABLE:
            self._fastmail = FastMail(self._config)
            print("✅ Email service configured with FastMail")
        else:
            if not FASTAPI_MAIL_AVAILABLE:
                print("⚠️ FastMail not installed. Using console logging for emails.")
            elif not settings.email_configured:
                print("⚠️ Email not configured in .env. Using console logging for emails.")
    
    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render a Jinja2 template."""
        try:
            template = template_env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            print(f"Error rendering template {template_name}: {e}")
            return ""
    
    async def send_email_async(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str,
        to_emails: Optional[List[str]] = None
    ) -> bool:
        """
        Send email asynchronously using FastMail.
        Falls back to console logging if not configured.
        """
        recipients = to_emails or [to_email]
        
        if self._fastmail:
            try:
                message = MessageSchema(
                    subject=subject,
                    recipients=recipients,
                    body=html_content,
                    subtype=MessageType.html
                )
                await self._fastmail.send_message(message)
                print(f"📧 Email sent to: {', '.join(recipients)}")
                return True
            except Exception as e:
                print(f"❌ Failed to send email: {e}")
                # Fall back to console logging
                self._log_email(recipients, subject, html_content)
                return False
        else:
            self._log_email(recipients, subject, html_content)
            return True
    
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Synchronous email sending (for background tasks).
        Uses sync wrapper for async email sending.
        """
        import asyncio
        
        if self._fastmail:
            try:
                # Create new event loop for sync context
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(
                        self.send_email_async(to_email, subject, html_content)
                    )
                    return result
                finally:
                    loop.close()
            except Exception as e:
                print(f"❌ Sync email failed: {e}")
                self._log_email([to_email], subject, html_content)
                return False
        else:
            self._log_email([to_email], subject, html_content)
            return True
    
    def _log_email(self, recipients: List[str], subject: str, html_content: str):
        """Log email to console (fallback when email not configured)."""
        print(f"\n--- EMAIL (console fallback) ---")
        print(f"To: {', '.join(recipients)}")
        print(f"Subject: {subject}")
        print(f"Content Length: {len(html_content)} chars")
        print(f"--- END EMAIL ---\n")
    
    def send_enrollment_email(
        self, 
        to_email: str, 
        student_name: str, 
        login_url: str, 
        username: str, 
        pin: str, 
        school_name: str
    ):
        """Send enrollment welcome email."""
        subject = f"Welcome to {school_name} - Enrollment Complete"
        context = {
            "student_name": student_name,
            "login_url": login_url,
            "username": username,
            "pin": pin,
            "school_name": school_name,
            "school_address": "123 Education Lane, Knowledge City",
            "year": "2026"
        }
        html = self._render_template("enrollment_success.html", context)
        self.send_email(to_email, subject, html)
    
    def send_high_priority_notice(
        self, 
        to_email: str, 
        title: str, 
        message: str, 
        school_name: str
    ):
        """Send urgent/high priority notice."""
        subject = f"URGENT: {title}"
        context = {
            "title": title,
            "message": message,
            "school_name": school_name,
            "year": "2026"
        }
        html = self._render_template("high_priority_notice.html", context)
        self.send_email(to_email, subject, html)
    
    def send_contact_notification(
        self,
        contact_id: str,
        name: str,
        email: str,
        subject: str,
        message: str,
        school_name: Optional[str] = None
    ):
        """Send notification about new contact form submission."""
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #003333; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">New Contact Request</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #666; width: 120px;">Reference ID:</td>
                        <td style="padding: 8px 0; font-weight: bold;">{contact_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Name:</td>
                        <td style="padding: 8px 0;">{name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Email:</td>
                        <td style="padding: 8px 0;"><a href="mailto:{email}">{email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Subject:</td>
                        <td style="padding: 8px 0;">{subject}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">School:</td>
                        <td style="padding: 8px 0;">{school_name or 'Not specified'}</td>
                    </tr>
                </table>
                <div style="margin-top: 20px; padding: 15px; background: white; border-left: 4px solid #5C2438;">
                    <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">Message:</p>
                    <p style="margin: 0; white-space: pre-wrap;">{message}</p>
                </div>
            </div>
            <div style="background: #333; color: #999; padding: 15px; text-align: center; font-size: 12px;">
                SISsphere Systems Inc. | <a href="mailto:{settings.contact_notification_email}" style="color: #5C2438;">Reply from Dashboard</a>
            </div>
        </div>
        """
        
        self.send_email(
            to_email=settings.contact_notification_email,
            subject=f"[SISsphere Contact] {subject}",
            html_content=html_content
        )
    
    def send_contact_reply(
        self,
        to_email: str,
        name: str,
        original_subject: str,
        reply_message: str
    ):
        """Send reply to a contact request."""
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #003333; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">SISsphere</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <p>Dear {name},</p>
                <p>Thank you for contacting SISsphere.</p>
                <div style="background: white; padding: 20px; border-left: 4px solid #5C2438; margin: 20px 0;">
                    {reply_message}
                </div>
                <p>Best regards,<br>The SISsphere Team</p>
            </div>
            <div style="background: #333; color: #999; padding: 15px; text-align: center; font-size: 12px;">
                © 2026 SISsphere Systems Inc. All rights reserved.<br>
                📧 sandeshgh07@gmail.com | 📞 +1 (647) 745-2035
            </div>
        </div>
        """
        
        self.send_email(
            to_email=to_email,
            subject=f"Re: {original_subject} - SISsphere",
            html_content=html_content
        )


# Global service instance
email_service = EmailService()
