# Nepsis SIS v1.1 - System Context

## CORE PRINCIPLES
1. **Tenant Isolation is Absolute**: Data must never leak between schools. All queries must be scoped by `school_id`.
2. **RBAC is Required**: Strict Role-Based Access Control must be enforced on all endpoints.

## Reputation Index Algorithm
The Reputation Index is calculated using the following weighted components:
1. **Attendance (40%)**: Percentage of student attendance.
2. **Fee Collection Rate (40%)**: Percentage of fees collected vs due.
3. **Complaint Resolution Speed (20%)**: Speed of resolving complaints (inverse metric).
