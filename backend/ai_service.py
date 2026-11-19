import json
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

INSTRUCTIONS = """You are an expert technical recruiter and resume coach.
Compare the RESUME to the JOB DESCRIPTION and respond with JSON only,
using exactly these keys:
- skills_score: integer 0-50. Required technical skills the resume shows with real evidence (projects or work), as a share of those the job requires. 50 = all of them, 25 = about half, 0 = none.
- experience_score: integer 0-30. How well years and level of experience fit the job. Compare any claimed years with the dates in the work history. 30 = clear fit, 15 = partial, 0 = far off.
- evidence_score: integer 0-20. How much the resume proves its claims with projects, results and numbers. 20 = strong proof, 10 = some, 0 = only keyword lists.
- summary: 2-3 sentence overall assessment
- matched_skills: the 10-20 most important technical skills (tools, languages, frameworks) the job requires that the resume shows. No degrees or soft skills.
- missing_skills: the most important technical skills the job requires that the resume lacks
- strengths: list of 3-5 short strengths of this resume for this job
- suggestions: list of 4-6 specific, actionable improvements to the resume
Be honest and specific. Do not invent skills the resume does not mention.
Always verify claims against evidence: if the resume states a number of years of experience, compare it with the dates in the work history. Report any mismatch, or any skill claimed without supporting projects or experience, in the suggestions.
The score must reflect real, evidenced experience, not just keywords listed.
Return only the JSON object, with no extra text and no markdown fences."""

MAX_ATTEMPTS = 3


class AIServiceError(Exception):
    """Error with a message that is safe to show to the user."""


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(cleaned)


def _model_list() -> list:
    main = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    fallbacks = os.getenv("GEMINI_FALLBACK_MODELS", "")
    models = [main] + [m.strip() for m in fallbacks.split(",") if m.strip()]
    return list(dict.fromkeys(models))  # remove duplicates, keep order


def _is_temporary(error: Exception) -> bool:
    code = getattr(error, "code", None)
    text = str(error).lower()
    return code in (429, 500, 503, 504) or "unavailable" in text or "high demand" in text


def _finalize(result: dict) -> dict:
    parts = []
    for key, top in (("skills_score", 50), ("experience_score", 30), ("evidence_score", 20)):
        parts.append(max(0, min(top, int(result[key]))))
    result["match_score"] = sum(parts)
    return result


def analyze(resume_text: str, job_description: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("paste_"):
        raise AIServiceError("GEMINI_API_KEY is missing in the .env file.")

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(api_version="v1beta"),
    )

    prompt = (
        INSTRUCTIONS
        + "\n\nRESUME:\n" + resume_text[:15000]
        + "\n\nJOB DESCRIPTION:\n" + job_description[:8000]
    )

    last_error = None
    for model in _model_list():
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0,
                        seed=42,
                    ),
                )
                return _finalize(_parse_json(response.text))
            except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
                last_error = e  # bad or incomplete JSON: try again
            except Exception as e:
                last_error = e
                if not _is_temporary(e):
                    break  # e.g. wrong model name or bad key: try next model
            if attempt < MAX_ATTEMPTS:
                time.sleep(2 * attempt)  # wait 2s, then 4s

    if last_error is not None and _is_temporary(last_error):
        raise AIServiceError(
            "The AI service is very busy right now. Please try again in a minute."
        )
    raise AIServiceError(f"The AI service failed: {last_error}")