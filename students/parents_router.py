from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from schools import models as school_models
from students import models as student_models
from academics import models as academic_models
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/parents", tags=["parents"])

class ParentStudentResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    roll_number: str
    grade_name: Optional[str] = None
    section_name: Optional[str] = None
    photo_url: Optional[str] = None
    
    class Config:
        from_attributes = True

@router.get("/me/students", response_model=List[ParentStudentResponse])
def get_my_linked_students(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Fetch all students linked to the currently logged-in parent.
    Strictly enforced by parent_assigned_links and school_id.
    """
    # Debug log
    print(f"Parent {user.id} fetching linked students for school {tenant.school_id}")

    links = db.query(student_models.ParentStudentLink).filter(
        student_models.ParentStudentLink.parent_id == str(user.id),
        student_models.ParentStudentLink.school_id == str(tenant.school_id)
    ).all()

    print(f"Found {len(links)} links")

    if not links:
        return []

    student_ids = [link.student_id for link in links]

    # optimized query with joins for grade/section names
    students_query = db.query(student_models.Student).filter(
        student_models.Student.id.in_(student_ids),
        student_models.Student.school_id == str(tenant.school_id) # Extra safety
    ).outerjoin(academic_models.Grade, student_models.Student.grade_id == academic_models.Grade.id)\
     .outerjoin(academic_models.Section, student_models.Student.section_id == academic_models.Section.id)\
     .add_columns(academic_models.Grade.name.label("grade_name"), academic_models.Section.name.label("section_name"))

    results = []
    for student, grade_name, section_name in students_query.all():
        results.append(ParentStudentResponse(
            id=student.id,
            first_name=student.first_name,
            last_name=student.last_name,
            roll_number=student.roll_number,
            grade_name=grade_name,
            section_name=section_name,
            photo_url=student.photo_url
        ))
    
    return results

# --- New Endpoints for Academics & Financials ---


from attendance.models import Attendance, AttendanceStatus
from academics.models import MarksEntry, ExamTerm
from finance.models import StudentInvoice, StudentInvoiceStatus, InvoiceLine
from sqlalchemy import func, desc

@router.get("/me/academics/summary")
def get_parent_academics_summary(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # 1. Get Linked Students
    links = db.query(student_models.ParentStudentLink).filter(
        student_models.ParentStudentLink.parent_id == str(user.id),
        student_models.ParentStudentLink.school_id == str(tenant.school_id)
    ).all()
    if not links: return []
    student_ids = [l.student_id for l in links]

    # 2. Fetch Students Info
    students = db.query(student_models.Student).filter(
        student_models.Student.id.in_(student_ids),
        student_models.Student.school_id == str(tenant.school_id)
    ).all()

    results = []
    for student in students:
        # A. Attendance Summary
        total_att = db.query(func.count(Attendance.id)).filter(Attendance.student_id == student.id).scalar()
        present = db.query(func.count(Attendance.id)).filter(Attendance.student_id == student.id, Attendance.status == AttendanceStatus.PRESENT).scalar()
        late = db.query(func.count(Attendance.id)).filter(Attendance.student_id == student.id, Attendance.status == AttendanceStatus.LATE).scalar()
        absent = db.query(func.count(Attendance.id)).filter(Attendance.student_id == student.id, Attendance.status == AttendanceStatus.ABSENT).scalar()
        
        pct = 0.0
        if total_att and total_att > 0:
            pct = round(((present + (late or 0)) / total_att) * 100, 1)

        # B. Recent Grades (Last 5 published marks)
        # Assuming MarksEntry links to ExamTerm which has date
        recent_grades = []
        marks_query = db.query(
            MarksEntry, 
            academic_models.Subject.name.label("subject_name"),
            academic_models.ExamTerm.name.label("term_name"),
            academic_models.ExamTerm.start_date
        ).join(
            academic_models.Subject, MarksEntry.subject_id == academic_models.Subject.id
        ).join(
            academic_models.ExamTerm, MarksEntry.exam_term_id == academic_models.ExamTerm.id
        ).filter(
            MarksEntry.student_id == student.id,
            MarksEntry.is_published == True
        ).order_by(desc(academic_models.ExamTerm.start_date)).limit(5)
        
        for m, subject_name, term_name, start_date in marks_query.all():
            recent_grades.append({
                "subject_name": subject_name,
                "exam_name": term_name,
                "marks_obtained": m.marks_obtained,
                "max_marks": m.total_marks,
                "date": start_date
            })
        
        results.append({
            "student_id": student.id,
            "student_name": f"{student.first_name} {student.last_name}",
            "attendance": {
                "present": present or 0,
                "late": late or 0,
                "absent": absent or 0,
                "percentage": pct
            },
            "recent_grades": recent_grades
        })
    return results

@router.get("/me/financials/summary")
def get_parent_financials_summary(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # 1. Get Linked Students
    links = db.query(student_models.ParentStudentLink).filter(
        student_models.ParentStudentLink.parent_id == str(user.id),
        student_models.ParentStudentLink.school_id == str(tenant.school_id)
    ).all()
    if not links: return {"files": [], "total_due": 0.0}
    student_ids = [l.student_id for l in links]
    
    # 2. Fetch Invoices per Student
    # Filter out DRAFT? Parents shouldn't see DRAFTS usually.
    # Adjust query to use StudentInvoiceStatus enum or string match
    invoices = db.query(StudentInvoice).filter(
        StudentInvoice.student_id.in_(student_ids),
        StudentInvoice.school_id == str(tenant.school_id),
        StudentInvoice.status != StudentInvoiceStatus.DRAFT
    ).all()
    
    total_due = 0.0
    students_map = {} # student_id -> {name, invoices: [], due: 0}
    
    # Pre-fill map
    students = db.query(student_models.Student).filter(student_models.Student.id.in_(student_ids)).all()
    for s in students:
        students_map[s.id] = {
            "student_id": s.id,
            "name": f"{s.first_name} {s.last_name}",
            "photo_url": s.photo_url,
            "invoices": [],
            "due": 0.0
        }
        
    for inv in invoices:
        # Check balance
        due = inv.balance if inv.balance is not None else 0.0
        students_map[inv.student_id]["due"] += float(due)
        total_due += float(due)
        
        students_map[inv.student_id]["invoices"].append({
            "id": str(inv.id),
            "invoice_number": f"INV-{str(inv.id)[:8].upper()}",
            "total_amount": float(inv.total_due),
            "balance": float(inv.balance),
            "status": str(inv.status), # cast enum
            "due_date": inv.due_date
        })
        
    return {
        "total_due": total_due,
        "students": list(students_map.values())
    }

# --- Directory Endpoint ---
import uuid

@router.get("/me/directory")
def get_parent_directory(
    grade_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # 1. Get Linked Students & Allowed Grades
    links = db.query(student_models.ParentStudentLink).filter(
        student_models.ParentStudentLink.parent_id == str(user.id),
        student_models.ParentStudentLink.school_id == str(tenant.school_id)
    ).all()
    
    my_student_ids = [l.student_id for l in links]
    
    # Fetch my students to get their grades
    my_students = db.query(student_models.Student).filter(
        student_models.Student.id.in_(my_student_ids)
    ).all()
    
    allowed_grade_ids = set()
    allowed_grades_list = []
    
    # Get Grade objects for metadata
    for s in my_students:
        if s.grade_id:
            allowed_grade_ids.add(s.grade_id)
            
    # Fetch Grade Details for allowed_grades
    if allowed_grade_ids:
        grades = db.query(academic_models.Grade).filter(
            academic_models.Grade.id.in_(list(allowed_grade_ids))
        ).all()
        allowed_grades_list = [{"id": g.id, "name": g.name} for g in grades]

    # 2. Filter Logic
    target_grade_ids = allowed_grade_ids
    if grade_id:
        if grade_id not in allowed_grade_ids:
            return {
                "allowed_grades": allowed_grades_list,
                "students": [],
                "parents": [],
                "staff": []
            }
        target_grade_ids = {grade_id}
    
    # 3. Fetch Directory Data
    
    response_data = {
        "allowed_grades": allowed_grades_list,
        "students": [],
        "parents": [],
        "staff": []
    }
    
    if target_grade_ids:
        # A. Students in target grades
        students_query = db.query(
            student_models.Student,
            academic_models.Grade.name.label("grade_name"),
            academic_models.Section.name.label("section_name")
        ).outerjoin(
            academic_models.Grade, student_models.Student.grade_id == academic_models.Grade.id
        ).outerjoin(
            academic_models.Section, student_models.Student.section_id == academic_models.Section.id
        ).filter(
            student_models.Student.grade_id.in_(list(target_grade_ids)),
            student_models.Student.school_id == str(tenant.school_id),
            student_models.Student.is_active == True
        ).all()
        
        dir_student_ids = []
        for s, g_name, sec_name in students_query:
            dir_student_ids.append(s.id)
            response_data["students"].append({
                "id": s.id,
                "name": f"{s.first_name} {s.last_name}",
                "grade_id": s.grade_id,
                "grade_name": g_name,
                "section": sec_name,
                "photo_url": s.photo_url
            })
            
        # B. Parents of those students
        if dir_student_ids:
            # Join ParentStudentLink -> User (Parent)
            # CAUTION: User.id is UUID, ParentStudentLink.parent_id is String.
            # We explicitly cast User.id to String for comparison if needed, or rely on SQLAlchemy.
            # But safer to use filter with cast if join fails.
            # Let's try explicit cast to String for the join condition.
            from sqlalchemy import cast, String as StringType
            
            parents_query = db.query(
                school_models.User,
                student_models.ParentStudentLink.student_id
            ).join(
                student_models.ParentStudentLink, 
                cast(school_models.User.id, StringType) == student_models.ParentStudentLink.parent_id
            ).filter(
                student_models.ParentStudentLink.student_id.in_(dir_student_ids),
                school_models.User.is_active == True
            ).all()
            
            parent_map = {}
            stud_lookup = {s["id"]: s for s in response_data["students"]}
            
            for p_user, linked_sid in parents_query:
                pid = str(p_user.id)
                if pid not in parent_map:
                    parent_map[pid] = {
                        "id": pid,
                        "name": f"{p_user.first_name} {p_user.last_name}",
                        "photo_url": p_user.photo_url,
                        "linked_students": []
                    }
                
                if linked_sid in stud_lookup:
                    child = stud_lookup[linked_sid]
                    if not any(c["id"] == child["id"] for c in parent_map[pid]["linked_students"]):
                        parent_map[pid]["linked_students"].append({
                            "id": child["id"],
                            "name": child["name"],
                            "grade_name": child["grade_name"]
                        })
            
            response_data["parents"] = list(parent_map.values())

    # C. Staff (All staff in school)
    excluded_roles = ["student", "parent", "guardian"]
    
    # User.school_id is UUID. tenant.school_id is str/uuid?
    # Convert string to UUID object for query
    try:
        school_uuid = uuid.UUID(str(tenant.school_id))
    except ValueError:
        # Fallback if somehow invalid
        school_uuid = tenant.school_id
        
    staff_users = db.query(school_models.User).filter(
        school_models.User.school_id == school_uuid,
        school_models.User.is_active == True,
        school_models.User.role.notin_(excluded_roles)
    ).all()
    
    for u in staff_users:
        response_data["staff"].append({
            "id": str(u.id),
            "name": f"{u.first_name} {u.last_name}",
            "role": u.role,
            "title": u.role.replace("_", " ").title() if u.role else "Staff",
            "photo_url": u.photo_url
        })

    return response_data
