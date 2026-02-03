"""
SISsphere Enterprise Configuration
Loads settings from environment variables with secure defaults.
"""
import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    # Fallback for older pydantic versions
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Superuser credentials (Platform Owner)
    superuser_username: Optional[str] = None
    superuser_password: Optional[str] = None
    
    # Database
    database_url: str = "sqlite:///./sissphere.db"
    
    # JWT Secret
    secret_key: str = "dev-secret-key-change-in-production"
    
    # Email Configuration
    mail_username: Optional[str] = None
    mail_password: Optional[str] = None
    mail_from: Optional[str] = None
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    
    # Contact notification recipient
    contact_notification_email: str = "sandeshgh07@gmail.com"
    
    # AI Integration
    gemini_api_key: Optional[str] = None
    
    # Frontend URL
    frontend_url: str = "http://localhost:5173"
    
    @property
    def email_configured(self) -> bool:
        """Check if email is properly configured."""
        return all([
            self.mail_username,
            self.mail_password,
            self.mail_from
        ])
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()

# Legacy compatibility exports
SUPERUSER_USERNAME = settings.superuser_username or os.getenv("SUPERUSER_USERNAME")
SUPERUSER_PASSWORD = settings.superuser_password or os.getenv("SUPERUSER_PASSWORD")
