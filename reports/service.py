import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from sqlalchemy.orm import Session
from students.models import Student
from schools.models import School
from analytics.service import StudentHealthService
from fastapi import HTTPException
import pandas as pd
import numpy as np

class ReportService:
    def __init__(self):
        pass

    def _generate_trend_graph(self, trend_data):
        if not trend_data:
            return None

        terms = [t['term'] for t in trend_data]
        averages = [t['average'] for t in trend_data]

        # Use Object-Oriented Interface for thread safety
        from matplotlib.figure import Figure
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

        fig = Figure(figsize=(6, 4))
        ax = fig.add_subplot(111)
        ax.plot(terms, averages, marker='o', linestyle='-', color='b')
        ax.set_title('Academic Trend')
        ax.set_xlabel('Exam Term')
        ax.set_ylabel('Average Marks (%)')
        ax.set_ylim(0, 100)
        ax.grid(True)

        buf = io.BytesIO()
        FigureCanvas(fig).print_png(buf)
        buf.seek(0)
        return buf

    def _generate_heatmap_graph(self, heatmap_data):
        if not heatmap_data:
            return None

        # Simple visualization: Bar chart of status counts or just a colored strip
        # For a heatmap, let's do a 1D strip of colors
        # Green for Present, Red for Absent, Yellow for Late

        dates = [d['date'] for d in heatmap_data]
        statuses = [d['status'] for d in heatmap_data]

        # Map status to numbers for plotting
        status_map = {'PRESENT': 1, 'LATE': 0.5, 'ABSENT': 0}
        values = [status_map.get(s.value if hasattr(s, 'value') else s, 0) for s in statuses]

        from matplotlib.figure import Figure
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

        fig = Figure(figsize=(8, 2))
        ax = fig.add_subplot(111)

        # Create a heatmap-like visualization using imshow
        # We need a 2D array, so we reshape values to (1, N)
        if not values:
            return None

        val_array = np.array([values])

        cax = ax.imshow(val_array, cmap='RdYlGn', aspect='auto', vmin=0, vmax=1)
        ax.set_yticks([])
        # Label x-axis with a few dates
        if len(dates) > 5:
            ax.set_xticks(np.linspace(0, len(dates)-1, 5))
            ax.set_xticklabels([dates[int(i)].strftime('%m-%d') for i in np.linspace(0, len(dates)-1, 5)])
        else:
            ax.set_xticks(range(len(dates)))
            ax.set_xticklabels([d.strftime('%m-%d') for d in dates])

        ax.set_title('Attendance Heatmap (Last 90 Days)')

        buf = io.BytesIO()
        FigureCanvas(fig).print_png(buf)
        buf.seek(0)
        return buf

    def generate_report_card(self, db: Session, student_id: str, school_id: str) -> io.BytesIO:
        student = db.query(Student).filter(Student.id == student_id, Student.school_id == school_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        school = db.query(School).filter(School.id == school_id).first()

        analytics = StudentHealthService(db, school_id)
        trend_data = analytics.get_academic_trend(student_id)
        heatmap_data = analytics.get_attendance_heatmap(student_id)

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawString(50, height - 50, f"Report Card: {school.name if school else 'School'}")

        c.setFont("Helvetica", 14)
        c.drawString(50, height - 80, f"Student: {student.first_name} {student.last_name}")
        c.drawString(50, height - 100, f"Roll Number: {student.roll_number}")

        y_position = height - 150

        # Academic Trend Graph
        trend_img_buf = self._generate_trend_graph(trend_data)
        if trend_img_buf:
            img = ImageReader(trend_img_buf)
            c.drawImage(img, 50, y_position - 250, width=400, height=250)
            y_position -= 270
        else:
            c.drawString(50, y_position, "No academic data available.")
            y_position -= 50

        # Attendance Heatmap Graph
        heatmap_img_buf = self._generate_heatmap_graph(heatmap_data)
        if heatmap_img_buf:
            img = ImageReader(heatmap_img_buf)
            c.drawImage(img, 50, y_position - 150, width=500, height=150)
            y_position -= 170
        else:
            c.drawString(50, y_position, "No attendance data available.")

        c.showPage()
        c.save()

        buffer.seek(0)
        return buffer
