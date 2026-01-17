import logging

logger = logging.getLogger(__name__)

def log_forbidden_access(user_id: str, school_id: str, target_school_id: str, endpoint: str):
    """
    Logs a forbidden access attempt where a user tries to access a school_id that doesn't match their token.
    """
    logger.warning(
        f"Forbidden Access Attempt: User {user_id} (School: {school_id}) tried to access School {target_school_id} at {endpoint}"
    )
