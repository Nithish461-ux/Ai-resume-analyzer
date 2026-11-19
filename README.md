# AI Resume Analyzer

Upload a PDF resume and paste a job description. The app extracts the resume text, uses an LLM (Google Gemini) to compare it with the job, and returns a match score, matched and missing skills, strengths, and specific suggestions. Past analyses are saved and can be reopened.

**Live demo:** [add link after deployment]

## Tech stack
- **Frontend:** React (Vite)
- **Backend:** Python, FastAPI
- **Database:** SQLite
- **AI:** Google Gemini API (provider isolated in one module, so it can be swapped)
- **Deployment:** Vercel (frontend and backend as separate projects)

## Features
- PDF text extraction with validation (file type, size up to 4 MB, scanned-PDF detection)
- Structured JSON output from the LLM, parsed and validated
- Automatic retries and model fallback when the AI service is busy
- Analysis history stored in SQLite
- Clear error handling in both API and UI

## Run locally
**Backend**

```bash
cd backend

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt
```

Create `backend/.env`:

```text
GEMINI_API_KEY=your_key

GEMINI_MODEL=gemini-2.5-flash

GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite

FRONTEND_URL=http://localhost:5173
```

```bash
uvicorn main:app --reload
```

**Frontend**

```bash
cd frontend

npm install

npm run dev
```

## API
- `POST /analyze` (PDF + job description) returns the analysis
- `GET /history` lists past analyses
- `GET /history/{id}` returns one analysis

## What I learned
- I learned how to connect a React interface with a FastAPI backend and exchange structured data between the two.
- I gained experience designing a reliable AI workflow with JSON validation, retries, model fallback, and clear error handling.
- I learned that caching repeated resume and job-description combinations reduces API calls and gives consistent results.
- I also learned how to use SQLite for application history and how backend, database, and LLM changes affect the full user experience.
