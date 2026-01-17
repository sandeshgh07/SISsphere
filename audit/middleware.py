import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import contextvars

TRACE_ID_HEADER = "X-Trace-ID"

# Context variable for trace_id, accessible in audit listener
trace_id_ctx = contextvars.ContextVar("trace_id", default=None)

def get_trace_id():
    return trace_id_ctx.get()

class TraceIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate or extract trace ID
        trace_id = request.headers.get(TRACE_ID_HEADER) or str(uuid.uuid4())

        # Set in context
        token = trace_id_ctx.set(trace_id)

        try:
            response = await call_next(request)
            # Return trace ID in response header
            response.headers[TRACE_ID_HEADER] = trace_id
            return response
        finally:
            trace_id_ctx.reset(token)
