from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from .schemas import SchoolCreate, SchoolOut, SchoolWithPrincipalCreate, UserCreateRequest
from .models import School, User, UserRole
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SchoolStore:
    def __init__(self):
        # We don't hold state here anymore, but we can manage sessions
        pass

    def create_user(self, db: Session, data: "UserCreateRequest", school_id: "UUID") -> User:
        # Check if user email already exists
        existing_user = db.query(User).filter(User.email == data.email).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="User with this email already exists")

        # Handle Full Name splitting if first/last not provided
        first_name = data.first_name
        last_name = data.last_name
        if not first_name or not last_name:
            if data.full_name:
                parts = data.full_name.strip().split(" ", 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ""
            else:
                 # Fallback if neither provided (shouldn't happen with proper validation, but just in case)
                 if not first_name: first_name = "Unknown"
                 if not last_name: last_name = "User"

        # Determine roles: use new 'roles' field or fallback to deprecated 'role'
        roles_list = data.roles if data.roles else ([data.role] if data.role else ["teacher"])
        primary_role = roles_list[0] if roles_list else "teacher"

        hashed_pw = pwd_context.hash(data.password)
        new_user = User(
            email=data.email,
            hashed_password=hashed_pw,
            first_name=first_name,
            last_name=last_name,
            role=primary_role,  # Primary role stored in user.role
            school_id=school_id,
            phone=data.phone,
            is_active=True
        )
        db.add(new_user)
        db.flush()  # Get user ID

        # Create UserRole entries for ALL roles (including primary)
        for role in roles_list:
            db.add(UserRole(user_id=new_user.id, role_name=role))

        if "parent" in roles_list and data.children_ids:
            from students.models import ParentStudentLink 
            for child_id in data.children_ids:
                link = ParentStudentLink(
                   parent_id=new_user.id,
                   student_id=str(child_id),
                   relationship="Parent" # Default
                )
                db.add(link)

        # Explicit Audit Log
        # (Though listeners might catch it, explicit ensures we capture high-level "User Creation" intent accurately)
        from audit.models import AuditLog
        from audit.listeners import get_actor_id
        import json
        
        audit_log = AuditLog(
            actor_id=get_actor_id(),
            action_type="INSERT",
            table_name="users",
            record_id=str(new_user.id),
            before_state=None,
            after_state=json.dumps({
                "email": new_user.email,
                "role": new_user.role,
                "first_name": new_user.first_name,
                "last_name": new_user.last_name,
                "school_id": str(new_user.school_id)
            }),
            reason="User Created via Admin Console"
        )
        db.add(audit_log)

        db.commit()
        db.refresh(new_user)
        return new_user

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

    def create_school_with_principal(self, data: SchoolWithPrincipalCreate, db: Session, role: str = "principal") -> SchoolOut:
        code = data.school.code.strip().lower()

        # Check if user email already exists (globally or per school? Usually globally unique emails for login)
        existing_user = db.query(User).filter(User.email == data.principal.email).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="User with this email already exists")

        # Start transaction is implicit in session
        try:
            # Determine logo URL - use provided or default placeholder
            logo_url = data.school.logo_url if hasattr(data.school, 'logo_url') and data.school.logo_url else "/static/logos/classa_default.png"
            
            # Get contact_request_id if provided (for SaaS lead tracking)
            contact_request_id = getattr(data.school, 'contact_request_id', None)
            
            # Create School
            new_school = School(
                name=data.school.name.strip(),
                code=code,
                country=data.school.country,
                is_active=data.school.is_active,
                logo_url=logo_url,
                contact_request_id=contact_request_id,
                created_at=datetime.utcnow(),
            )
            db.add(new_school)
            db.flush() # Flush to get ID

            # Create User (Principal or School Admin)
            hashed_pw = pwd_context.hash(data.principal.password)
            new_user = User(
                email=data.principal.email,
                hashed_password=hashed_pw,
                first_name=data.principal.first_name,
                last_name=data.principal.last_name,
                role=role,
                school_id=new_school.id
            )
            db.add(new_user)

            # If school was created from a Contact Request, mark it as RESOLVED
            if contact_request_id:
                from communication.models import ContactRequest, ContactRequestStatus
                contact = db.query(ContactRequest).filter(ContactRequest.id == contact_request_id).first()
                if contact:
                    contact.status = ContactRequestStatus.RESOLVED

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
