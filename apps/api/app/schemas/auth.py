from pydantic import BaseModel


class SessionValidationResponse(BaseModel):
    status: str
    user_id: str
    session_id: str
