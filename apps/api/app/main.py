from fastapi import FastAPI

from app.api.router import api_router


app = FastAPI(
    title="Public Speaking Coach API",
    version="0.1.0",
    description="Backend services for session persistence, metrics validation, and reporting.",
)
app.include_router(api_router)
