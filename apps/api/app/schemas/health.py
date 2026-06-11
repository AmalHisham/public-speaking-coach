from typing import Literal

from pydantic import BaseModel


class DatabaseHealthStatus(BaseModel):
    status: Literal["ok", "unavailable"]


class HealthCheckResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: DatabaseHealthStatus
