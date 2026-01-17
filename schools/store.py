from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from .schemas import SchoolCreate, SchoolOut, SchoolWithPrincipalCreate
from .models import School, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SchoolStore:
    def __init__(self):
        # We don't hold state here anymore, but we can manage sessions
        pass

    def get_db(self):
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def create_school(self, data: SchoolCreate, db: Session, logo_url: str | None = None) -> SchoolOut:
        code = data.code.strip().lower()

        existing_school = db.query(School).filter(School.code == code).first()
        if existing_school:
            raise HTTPException(status_code=409, detail="School code already exists")

        new_school = School(
            name=data.name.strip(),
            code=code,
            country=data.country,
            is_active=data.is_active,
            logo_url=logo_url,
            created_at=datetime.utcnow(),
        )
        db.add(new_school)
        db.commit()
        db.refresh(new_school)
        return SchoolOut.model_validate(new_school)

    def update_school(self, db: Session, school_id: str, name: str = None, country: str = None, type: str = None, logo_url: str = None) -> SchoolOut:
        school = db.query(School).filter(School.id == school_id).first()
        if not school:
            raise HTTPException(status_code=404, detail="School not found")

        if name:
            school.name = name
        if country:
            school.country = country
        # Type is not in the model currently! Only in frontend code/response mock?
        # Model has: name, code, is_active, created_at, logo_url (added by me)
        # Frontend sends 'type'.
        # I should probably ignore type for now or add it to model if critical.
        # But for logo optimization task, I'll stick to logo.

        if logo_url:
            school.logo_url = logo_url

        db.commit()
        db.refresh(school)
        return SchoolOut.model_validate(school)

    def update_school_logo(self, db: Session, school_id: str, logo_url: str) -> SchoolOut:
        school = db.query(School).filter(School.id == school_id).first()
        if not school:
            raise HTTPException(status_code=404, detail="School not found")

        school.logo_url = logo_url
        db.commit()
        db.refresh(school)
        return SchoolOut.model_validate(school)

    def create_school_with_principal(self, data: SchoolWithPrincipalCreate, db: Session) -> SchoolOut:
        code = data.school.code.strip().lower()

        # Check if user email already exists (globally or per school? Usually globally unique emails for login)
        existing_user = db.query(User).filter(User.email == data.principal.email).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="User with this email already exists")

        # Start transaction is implicit in session
        try:
            # Create School
            new_school = School(
                name=data.school.name.strip(),
                code=code,
                country=data.school.country,
                is_active=data.school.is_active,
                created_at=datetime.utcnow(),
            )
            db.add(new_school)
            db.flush() # Flush to get ID

            # Create Principal
            hashed_pw = pwd_context.hash(data.principal.password)
            new_user = User(
                email=data.principal.email,
                hashed_password=hashed_pw,
                first_name=data.principal.first_name,
                last_name=data.principal.last_name,
                role="principal",
                school_id=new_school.id
            )
            db.add(new_user)

            db.commit()
            db.refresh(new_school)
            return SchoolOut.model_validate(new_school)
        except Exception as e:
            db.rollback()
            raise e

    def list_schools(self, db: Session, is_active: bool | None = None, school_id: str | None = None) -> list[SchoolOut]:
        query = db.query(School)
        if is_active is not None:
            query = query.filter(School.is_active == is_active)
        if school_id:
            query = query.filter(School.id == school_id)
        schools = query.all()
        return [SchoolOut.model_validate(s) for s in schools]

school_store = SchoolStore()
