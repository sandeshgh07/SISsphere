# Nepsis SIS v1.1 - System Context

## CORE PRINCIPLES
1. **Tenant Isolation is Absolute**: Data must never leak between schools. All queries must be scoped by `school_id`.
2. **RBAC is Required**: Strict Role-Based Access Control must be enforced on all endpoints.
