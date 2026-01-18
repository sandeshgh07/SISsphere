from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def register_listeners():
    from audit.listeners import setup_audit_listeners
    # Import all models to ensure they are mapped
    import schools.models
    import students.models
    import academics.models
    import finance.models
    import audit.models

    # Attempt to import others that might exist in the codebase
    try:
        import communication.models
        import attendance.models
    except ImportError:
        pass

    setup_audit_listeners(Base)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
