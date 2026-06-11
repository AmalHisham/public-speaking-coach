from sqlalchemy import text
from sqlalchemy.orm import Session


class HealthRepository:
    def is_database_available(self, db_session: Session) -> bool:
        result = db_session.execute(text("SELECT 1")).scalar_one()

        return result == 1
