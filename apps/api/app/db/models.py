from sqlalchemy import MetaData

from app import models as _models  # noqa: F401
from app.db.base import Base

target_metadata: MetaData = Base.metadata

__all__ = ["Base", "target_metadata"]
