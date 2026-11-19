import hashlib
import io
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pypdf import PdfReader

import ai_service
import database

load_dotenv()

app = FastAPI(title="AI Resume Analyzer")

origins = [o.strip() for o in os.getenv("FRONTEND_URL", "http://localhost:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

database.init_db()


def extract_pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF.")


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
):
    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")
    if len(job_description.strip()) < 30:
        raise HTTPException(status_code=400, detail="Job description is too short.")

    data = await resume.read()
    if len(data) > 4 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF must be under 4 MB.")

    text = extract_pdf_text(data)
    if len(text) < 50:
        raise HTTPException(
            status_code=400,
            detail="No text found. The PDF may be a scanned image.",
        )

    # Create a unique hash for the resume and job description
    input_hash = hashlib.sha256(
        (text + "||" + job_description.strip()).encode("utf-8")
    ).hexdigest()

    cached = database.find_cached(input_hash)
    if cached:
        return {"id": cached["id"], "filename": resume.filename, "result": cached["result"]}

    try:
        result = await run_in_threadpool(ai_service.analyze, text, job_description)
    except ai_service.AIServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Something went wrong while analyzing.")

    analysis_id = database.save_analysis(resume.filename, result, input_hash)
    return {"id": analysis_id, "filename": resume.filename, "result": result}


@app.get("/history")
def history():
    return database.list_analyses()


@app.get("/history/{analysis_id}")
def history_item(analysis_id: int):
    item = database.get_analysis(analysis_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Not found.")
    return item