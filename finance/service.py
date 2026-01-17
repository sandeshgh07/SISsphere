from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from finance import models as finance_models
from communication import models as comm_models
from students import models as student_models
from schools import models as school_models

def check_overdue_installments(db: Session):
    """
    Checks for upcoming (3 days before), due (today), and overdue (3 days after) installments
    and sends notices.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    # Active plans only
    active_plans = db.query(finance_models.PaymentPlan).filter(
        finance_models.PaymentPlan.status == finance_models.PaymentPlanStatus.ACTIVE
    ).all()

    for plan in active_plans:
        installments = db.query(finance_models.Installment).filter(
            finance_models.Installment.payment_plan_id == plan.id,
            finance_models.Installment.status == finance_models.InstallmentStatus.PENDING
        ).all()

        for inst in installments:
            due_date = inst.due_date.date()
            days_diff = (due_date - today).days

            notice_needed = False
            message = ""

            if days_diff == 3:
                notice_needed = True
                message = f"Reminder: An installment of {inst.amount} is due in 3 days."
            elif days_diff == 0:
                notice_needed = True
                message = f"Reminder: An installment of {inst.amount} is due today."
            elif days_diff == -3:
                notice_needed = True
                message = f"Overdue: An installment of {inst.amount} was due 3 days ago. Please pay immediately."
                # Mark as overdue if not already?
                inst.status = finance_models.InstallmentStatus.OVERDUE

            if notice_needed:
                # Find student/parent to notify
                invoice = db.query(finance_models.Invoice).get(plan.invoice_id)
                student = db.query(student_models.Student).get(invoice.student_id)

                # Send notice (Create Notice entry targeted to this student)
                # Ideally, we send to Parent.
                # Find Parents
                parents = db.query(school_models.User).join(
                    student_models.ParentStudentLink,
                    student_models.ParentStudentLink.parent_id == school_models.User.id
                ).filter(
                    student_models.ParentStudentLink.student_id == student.id
                ).all()

                # For simplicity, create a High Priority Notice for the student/parent
                # We can reuse notice service or create directly.
                # Since we are in a service function, we can create a Notice record.

                # We need a 'system' user or similar to be author, or the school admin.
                # Just picking the first admin of the school for author_id is a hack but works for now.
                admin = db.query(school_models.User).filter(
                    school_models.User.school_id == plan.school_id,
                    school_models.User.role == "school_admin"
                ).first()

                if admin:
                    notice = comm_models.Notice(
                        school_id=plan.school_id,
                        title="Payment Installment Reminder",
                        content=message,
                        priority=comm_models.NoticePriority.HIGH,
                        author_id=admin.id
                    )
                    db.add(notice)
                    db.flush()

                    # Target the specific student
                    ns = comm_models.NoticeStudent(
                        notice_id=notice.id,
                        student_id=student.id
                    )
                    db.add(ns)

                    # Also try to create delivery entries for parents if logic permits
                    # (Simplified here to just creating the Notice)

    db.commit()
