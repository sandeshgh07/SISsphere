from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./dev.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Add this to register listeners later
def register_listeners():
    from audit.listeners import setup_audit_listeners
    # Import all models to ensure they are mapped
    import schools.models
    import students.models
    import academics.models
    import finance.models
    import audit.models
    setup_audit_listeners(Base)
