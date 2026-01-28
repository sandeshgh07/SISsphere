from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from audit.models import AuditLog
import json
from datetime import datetime, timezone
import contextvars
from audit.middleware import get_trace_id

# Context variable to store current user ID.
actor_id_ctx = contextvars.ContextVar("actor_id", default=None)
# Context variable to store reason for action (optional).
reason_ctx = contextvars.ContextVar("reason", default=None)
# Context variable to store hidden users (optional JSON string).
hidden_users_ctx = contextvars.ContextVar("hidden_users", default=None)

def set_actor_id(user_id: str):
    actor_id_ctx.set(user_id)

def get_actor_id():
    return actor_id_ctx.get()

def set_reason(reason: str):
    reason_ctx.set(reason)

def get_reason():
    return reason_ctx.get()

def set_hidden_users(hidden_users_json: str):
    hidden_users_ctx.set(hidden_users_json)

def get_hidden_users():
    return hidden_users_ctx.get()

def serialize(val):
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)

def audit_insert(mapper, connection, target):
    _audit(connection, target, "INSERT")

def audit_update(mapper, connection, target):
    _audit(connection, target, "UPDATE")

def audit_delete(mapper, connection, target):
    _audit(connection, target, "DELETE")

def _audit(connection, target, action):
    if isinstance(target, AuditLog):
        return

    actor_id = get_actor_id()
    trace_id = get_trace_id()
    reason = get_reason()
    hidden_users = get_hidden_users()

    before = {}
    after = {}

    state = inspect(target)

    if action == "INSERT":
        for attr in state.mapper.column_attrs:
            val = getattr(target, attr.key)
            after[attr.key] = val
    elif action == "DELETE":
         for attr in state.mapper.column_attrs:
             val = getattr(target, attr.key)
             before[attr.key] = val
    elif action == "UPDATE":
        for attr in state.mapper.column_attrs:
            hist = getattr(state.attrs, attr.key).history
            if hist.has_changes():
                before[attr.key] = hist.deleted[0] if hist.deleted else None
                after[attr.key] = hist.added[0] if hist.added else None

    # Insert into audit_logs table manually
    import uuid
    log_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc)

    audit_table = AuditLog.__table__
    connection.execute(
        audit_table.insert().values(
            id=log_id,
            actor_id=str(actor_id) if actor_id else None,
            action_type=action,
            table_name=target.__tablename__,
            record_id=str(target.id) if hasattr(target, 'id') else None,
            before_state=json.dumps(before, default=serialize) if before else None,
            after_state=json.dumps(after, default=serialize) if after else None,
            trace_id=trace_id,
            timestamp=timestamp,
            reason=reason,  # Added reason
            hidden_for_user_ids=hidden_users # Added hidden users
        )
    )

def setup_audit_listeners(Base):
    for mapper in Base.registry.mappers:
        event.listen(mapper, 'after_insert', audit_insert)
        event.listen(mapper, 'after_update', audit_update)
        event.listen(mapper, 'after_delete', audit_delete)
