from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, select
from communication.models import (
    Notice, NoticeRole, NoticeGrade, NoticeSection, NoticeStudent,
    NoticeDelivery, NoticeDeliveryStatus
)
from students.models import Student, ParentStudentLink
from schools.models import User, School
from academics.models import TeacherAssignment
from auth.dependencies import Roles
from database import SessionLocal
import datetime

def process_high_priority_notice(notice_id: str):
    """
    Background task to resolve recipients and send emails.
    """
    db = SessionLocal()
    try:
        notice = db.query(Notice).get(notice_id)
        if not notice:
            return

        service = CommunicationService()
        recipients = service.resolve_notice_recipients(db, notice)

        # Idempotent Insert
        existing = db.query(NoticeDelivery.user_id).filter(
            NoticeDelivery.notice_id == notice_id
        ).all()
        existing_ids = {e[0] for e in existing}
        new_ids = recipients - existing_ids

        if new_ids:
            objects = [
                NoticeDelivery(
                    notice_id=notice_id,
                    user_id=uid,
                    channel="EMAIL",
                    status=NoticeDeliveryStatus.PENDING
                ) for uid in new_ids
            ]
            db.bulk_save_objects(objects)
            db.commit()

        # Send Emails (Stub)
        deliveries = db.query(NoticeDelivery).filter(
            NoticeDelivery.notice_id == notice_id,
            NoticeDelivery.status == NoticeDeliveryStatus.PENDING
        ).all()

        if not deliveries:
            return

        school = db.query(School).get(notice.school_id)
        school_name = school.name if school else "School"

        user_ids = [d.user_id for d in deliveries]
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in users}

        for d in deliveries:
            user = user_map.get(d.user_id)
            if user and user.email:
                print(f"[EMAIL SENT] To: {user.email}, Subject: [HIGH] {school_name}: {notice.title}")
                d.status = NoticeDeliveryStatus.SENT
                d.sent_at = datetime.datetime.now(datetime.timezone.utc)
            else:
                d.status = NoticeDeliveryStatus.FAILED
                d.error_message = "No email or user found"

        db.commit()

    except Exception as e:
        print(f"Error in background task: {e}")
        db.rollback()
    finally:
        db.close()

class CommunicationService:
    def resolve_notice_recipients(self, db: Session, notice: Notice) -> set:
        target_roles = [r.role for r in db.query(NoticeRole).filter_by(notice_id=notice.id).all()]
        target_grade_ids = [r.grade_id for r in db.query(NoticeGrade).filter_by(notice_id=notice.id).all()]
        target_section_ids = [r.section_id for r in db.query(NoticeSection).filter_by(notice_id=notice.id).all()]
        target_student_ids = [r.student_id for r in db.query(NoticeStudent).filter_by(notice_id=notice.id).all()]

        recipient_user_ids = set()

        # 1. PARENTS
        if Roles.PARENT in target_roles:
            query = db.query(ParentStudentLink.parent_id).join(Student, ParentStudentLink.student_id == Student.id)

            criteria = []
            if target_grade_ids:
                criteria.append(Student.grade_id.in_(target_grade_ids))
            if target_section_ids:
                criteria.append(Student.section_id.in_(target_section_ids))
            if target_student_ids:
                criteria.append(Student.id.in_(target_student_ids))

            filters = [Student.school_id == notice.school_id]
            if criteria:
                filters.append(or_(*criteria))

            parents = query.filter(and_(*filters)).all()
            recipient_user_ids.update([p.parent_id for p in parents])

        # 2. STUDENTS
        if Roles.STUDENT in target_roles:
            query = db.query(User.id).join(Student, User.email == Student.email)

            criteria = []
            if target_grade_ids:
                criteria.append(Student.grade_id.in_(target_grade_ids))
            if target_section_ids:
                criteria.append(Student.section_id.in_(target_section_ids))
            if target_student_ids:
                criteria.append(Student.id.in_(target_student_ids))

            filters = [Student.school_id == notice.school_id]
            if criteria:
                filters.append(or_(*criteria))

            students = query.filter(and_(*filters)).all()
            recipient_user_ids.update([s.id for s in students])

        # 3. TEACHERS
        if Roles.TEACHER in target_roles:
            query = db.query(TeacherAssignment.teacher_id)

            criteria = []
            if target_grade_ids:
                criteria.append(TeacherAssignment.grade_id.in_(target_grade_ids))
            if target_section_ids:
                criteria.append(TeacherAssignment.section_id.in_(target_section_ids))

            filters = [TeacherAssignment.school_id == notice.school_id]
            if criteria:
                filters.append(or_(*criteria))

            teachers = query.filter(and_(*filters)).all()
            recipient_user_ids.update([t.teacher_id for t in teachers])

        return recipient_user_ids

    def get_user_notices(self, db: Session, user: User, school_id: str):
        """
        Efficiently fetches notices for a user using JOINs/UNIONs.
        """

        # Base query for all: Match School ID
        base_query = db.query(Notice).filter(Notice.school_id == school_id)

        # 1. Role-based notices
        role_query = base_query.join(NoticeRole).filter(NoticeRole.role == user.role)

        queries = [role_query]

        # 2. Student-specific logic
        if user.role == Roles.STUDENT:
            # We need to find the student record for this user
            # Assuming email match as discussed
            student = db.query(Student).filter(
                Student.email == user.email,
                Student.school_id == school_id
            ).first()

            if student:
                # Grade-based
                if student.grade_id:
                    grade_query = base_query.join(NoticeGrade).filter(NoticeGrade.grade_id == student.grade_id)
                    queries.append(grade_query)

                # Section-based
                if student.section_id:
                    section_query = base_query.join(NoticeSection).filter(NoticeSection.section_id == student.section_id)
                    queries.append(section_query)

                # Individual-based
                individual_query = base_query.join(NoticeStudent).filter(NoticeStudent.student_id == student.id)
                queries.append(individual_query)

        # 3. Parent-specific logic
        elif user.role == Roles.PARENT:
            # Get all linked students
            linked_students = db.query(Student).join(ParentStudentLink).filter(
                ParentStudentLink.parent_id == user.id,
                ParentStudentLink.school_id == school_id
            ).all()

            student_ids = [s.id for s in linked_students]
            grade_ids = [s.grade_id for s in linked_students if s.grade_id]
            section_ids = [s.section_id for s in linked_students if s.section_id]

            if grade_ids:
                grade_query = base_query.join(NoticeGrade).filter(NoticeGrade.grade_id.in_(grade_ids))
                queries.append(grade_query)

            if section_ids:
                section_query = base_query.join(NoticeSection).filter(NoticeSection.section_id.in_(section_ids))
                queries.append(section_query)

            if student_ids:
                individual_query = base_query.join(NoticeStudent).filter(NoticeStudent.student_id.in_(student_ids))
                queries.append(individual_query)

        # Combine all queries with UNION
        final_query = queries[0]
        for q in queries[1:]:
            final_query = final_query.union(q)

        return final_query.order_by(Notice.created_at.desc()).all()
