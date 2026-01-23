#!/usr/bin/env python3
"""
Secure Setup Script for Classa Enterprise

This script helps set up the initial environment securely:
- Creates .env from template if missing
- Validates required security settings
- Creates SuperUser credentials if needed

Run: python scripts/setup_secure.py
"""

import os
import sys
import secrets
import string
from pathlib import Path

# Navigate to project root
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
ENV_EXAMPLE = PROJECT_ROOT / ".env.example"


def generate_secure_password(length: int = 24) -> str:
    """Generate a cryptographically secure password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_secret_key() -> str:
    """Generate a secure JWT secret key."""
    return secrets.token_urlsafe(64)


def setup_env():
    """Create .env file with secure defaults."""
    print("=" * 60)
    print("🔐 Classa Enterprise - Secure Setup")
    print("=" * 60)
    
    if ENV_FILE.exists():
        print(f"✅ .env file already exists at: {ENV_FILE}")
        
        # Verify critical settings
        with open(ENV_FILE, 'r') as f:
            content = f.read()
        
        issues = []
        if "SUPERUSER_USERNAME" not in content or "owner@" not in content:
            issues.append("⚠️ SUPERUSER_USERNAME not set")
        if "SUPERUSER_PASSWORD" not in content or "your-" in content.lower():
            issues.append("⚠️ SUPERUSER_PASSWORD appears to be placeholder")
        if "SECRET_KEY" not in content or "dev-secret" in content.lower() or "change" in content.lower():
            issues.append("⚠️ SECRET_KEY should be changed for production")
        
        if issues:
            print("\n⚠️ Security Warnings:")
            for issue in issues:
                print(f"   {issue}")
            print("\n📝 Edit your .env file to fix these issues.")
        else:
            print("✅ Security settings look good!")
        
        return
    
    # Create new .env from template
    print("\n📝 Creating new .env file...")
    
    # Generate secure values
    secret_key = generate_secret_key()
    superuser_password = generate_secure_password(16)
    
    env_content = f"""# Classa Enterprise Environment Configuration
# SECURITY FIRST: Keep this file secure and never commit to version control!

# ==============================================
# SUPERUSER CREDENTIALS (Platform Owner)
# ==============================================
SUPERUSER_USERNAME=owner@classa.com
SUPERUSER_PASSWORD={superuser_password}

# ==============================================
# JWT SECRET (CRITICAL - Keep secure!)
# ==============================================
SECRET_KEY={secret_key}

# ==============================================
# DATABASE
# ==============================================
DATABASE_URL=sqlite:///./classa.db
# For PostgreSQL in production:
# DATABASE_URL=postgresql://user:password@localhost:5432/classa

# ==============================================
# EMAIL CONFIGURATION (Classa Corporate)
# ==============================================
# For Gmail, use an App Password (not your real password)
# Generate at: https://myaccount.google.com/apppasswords

MAIL_USERNAME=sandeshgh07@gmail.com
MAIL_PASSWORD=your-google-app-password
MAIL_FROM=sandeshgh07@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

# Contact form notification recipient
CONTACT_NOTIFICATION_EMAIL=sandeshgh07@gmail.com

# ==============================================
# AI INTEGRATION (Optional)
# ==============================================
GEMINI_API_KEY=

# ==============================================
# FRONTEND URL (CORS)
# ==============================================
FRONTEND_URL=http://localhost:5173
"""
    
    with open(ENV_FILE, 'w') as f:
        f.write(env_content)
    
    # Make file readable only by owner for security
    os.chmod(ENV_FILE, 0o600)
    
    print(f"✅ Created .env file at: {ENV_FILE}")
    print(f"🔒 File permissions set to 600 (owner read/write only)")
    print()
    print("=" * 60)
    print("🔐 YOUR GENERATED CREDENTIALS (SAVE THESE!):")
    print("=" * 60)
    print(f"   📧 SuperUser Email:    owner@classa.com")
    print(f"   🔑 SuperUser Password: {superuser_password}")
    print("=" * 60)
    print()
    print("⚠️ IMPORTANT SECURITY NOTES:")
    print("   1. Save these credentials securely")
    print("   2. Never commit .env to version control")
    print("   3. Change MAIL_PASSWORD to your real Gmail App Password")
    print("   4. In production, use a strong unique SECRET_KEY")
    print()
    print("🚀 Restart the backend server to apply changes:")
    print("   python -m uvicorn main:app --reload")


def verify_startup():
    """Print verification of security settings on startup."""
    from config import settings, SUPERUSER_USERNAME, SUPERUSER_PASSWORD
    
    print("\n🔐 Security Verification:")
    print(f"   SuperUser configured: {'✅ Yes' if SUPERUSER_USERNAME else '❌ No'}")
    print(f"   Email configured: {'✅ Yes' if settings.email_configured else '⚠️ No (console fallback)'}")
    print(f"   Secret Key: {'✅ Custom' if 'dev-secret' not in settings.secret_key else '⚠️ Using dev default'}")
    

if __name__ == "__main__":
    setup_env()
    
    # Also verify if we can import config
    try:
        verify_startup()
    except Exception as e:
        print(f"\n⚠️ Could not verify config: {e}")
        print("   This is expected if dependencies aren't installed yet.")
