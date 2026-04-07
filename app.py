# ============================================================
#  backend/main.py  (v2 — PDF upload with session tracking)
#
#  NEW in this version:
#    POST /api/upload-pdfs   → upload multiple PDFs, get parse
#                               status per file + run pipeline
#    GET  /api/uploaded-files → see all PDFs in current session
#    DELETE /api/uploaded-files/{filename} → remove one PDF
#    POST /api/clear          → clear all PDFs, start fresh
#    POST /api/run-with-uploaded → re-run after adding more PDFs
#
#  HOW PDF SESSION WORKS:
#    - Every PDF you upload gets stored in memory
#    - You can upload more PDFs later and they all accumulate
#    - Run pipeline runs on ALL uploaded PDFs + builtin (optional)
#    - Click Clear to start fresh with empty session
#
#  START:  python main.py
#  DOCS:   http://localhost:8000/docs
# ============================================================

import io
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

from pipeline    import run_full_pipeline, BUILTIN_RESUMES, SKILLS_DB
from data_loader import load_from_csv, load_from_pdf_bytes

app = FastAPI(title="ATS Resume Screening API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Session state ─────────────────────────────────────────────
_state = {
    "config": {
        "title"         : "Senior Data Scientist",
        "must_have"     : ["python","machine learning","deep learning",
                           "tensorflow","sql","aws","docker","git","scikit-learn"],
        "preferred"     : ["kubernetes","spark","mlflow","airflow","a/b testing"],
        "min_experience": 5.0,
        "threshold"     : 50.0,
        "jd_text"       : """
            Senior Data Scientist — Machine Learning Platform.
            Minimum 5 years of experience.
            Required: Python, machine learning, deep learning, TensorFlow or PyTorch,
            NLP, SQL, AWS or GCP or Azure, Docker, Git, scikit-learn, pandas, numpy,
            feature engineering, model deployment.
            Good to have: Kubernetes, Spark, Kafka, MLflow, Kubeflow, Airflow.
            Responsibilities: Lead ML projects, mentor team, present to stakeholders.
        """,
    },
    "uploaded_resumes" : {},   # {key: text}  — accumulates across uploads
    "uploaded_files"   : [],   # [{name, chars, status}]  — for display
    "results"          : None,
}


class JobConfig(BaseModel):
    title         : str
    must_have     : List[str]
    preferred     : List[str]
    min_experience: float
    threshold     : float
    jd_text       : Optional[str] = ""


def _run_pipeline_on_all(use_builtin: bool = True) -> dict:
    resumes = {}
    if use_builtin:
        resumes.update({f"builtin_{k}": v for k, v in BUILTIN_RESUMES.items()})
    resumes.update(_state["uploaded_resumes"])
    if not resumes:
        raise HTTPException(status_code=400, detail="No resumes to process")
    return run_full_pipeline(resumes, _state["config"])


# ── Health ────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "message": "ATS API v2 running"}


# ── Config ────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    return _state["config"]


@app.post("/api/config")
def save_config(config: JobConfig):
    cfg = config.dict()
    if not cfg.get("jd_text", "").strip():
        must = ", ".join(cfg["must_have"])
        pref = ", ".join(cfg["preferred"])
        cfg["jd_text"] = (
            f"Job Title: {cfg['title']}\n"
            f"Minimum Experience: {cfg['min_experience']} years.\n"
            f"Required Skills: {must}.\n"
            f"Good to Have: {pref}.\n"
        )
    _state["config"] = cfg
    logger.info(f"Config saved: {cfg['title']}")
    return {"status": "saved", "config": cfg}


# ── Demo run ──────────────────────────────────────────────────

@app.post("/api/run-demo")
def run_demo():
    """Run on 25 built-in resumes only."""
    try:
        tagged  = {f"builtin_{k}": v for k, v in BUILTIN_RESUMES.items()}
        results = run_full_pipeline(tagged, _state["config"])
        _state["results"] = results
        return results
    except Exception as exc:
        logger.error(f"Demo error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── PDF Upload ────────────────────────────────────────────────

@app.post("/api/upload-pdfs")
async def upload_pdfs(
    files       : List[UploadFile] = File(...),
    use_builtin : bool = Form(default=True),
    run_now     : bool = Form(default=True),
):
    """
    Upload one or more PDF resume files.

    - Each PDF is parsed immediately and added to the session
    - Uploaded PDFs accumulate — call again to add more
    - If run_now=True the full pipeline runs and returns results
    - If run_now=False just parses and stores; call /api/run-with-uploaded later

    Returns per-file parse status so the UI can show success/failure per file.
    """
    file_results = []

    for f in files:
        fname = f.filename

        if not fname.lower().endswith(".pdf"):
            file_results.append({
                "name"  : fname,
                "status": "skipped",
                "reason": "Not a PDF file",
                "chars" : 0,
                "key"   : None,
            })
            continue

        raw_bytes = await f.read()
        text      = load_from_pdf_bytes(fname, raw_bytes)

        if not text or len(text.strip()) < 50:
            file_results.append({
                "name"  : fname,
                "status": "failed",
                "reason": "No text found — may be a scanned or image-only PDF",
                "chars" : 0,
                "key"   : None,
            })
            logger.warning(f"No text extracted from: {fname}")
            continue

        key = f"pdf_{Path(fname).stem}"
        _state["uploaded_resumes"][key] = text

        info = {
            "name"  : fname,
            "status": "success",
            "reason": "",
            "chars" : len(text),
            "key"   : key,
        }
        file_results.append(info)

        # Update session file list (replace if same name uploaded again)
        existing = [x["name"] for x in _state["uploaded_files"]]
        if fname not in existing:
            _state["uploaded_files"].append(info)
        else:
            _state["uploaded_files"] = [
                info if x["name"] == fname else x
                for x in _state["uploaded_files"]
            ]

        logger.success(f"Parsed PDF: {fname}  ({len(text):,} chars)")

    response = {
        "file_results"  : file_results,
        "total_uploaded": len(_state["uploaded_resumes"]),
        "session_files" : _state["uploaded_files"],
        "success_count" : sum(1 for r in file_results if r["status"] == "success"),
        "failed_count"  : sum(1 for r in file_results if r["status"] in ("failed","skipped")),
    }

    if run_now:
        try:
            results = _run_pipeline_on_all(use_builtin=use_builtin)
            _state["results"] = results
            response["pipeline_results"] = results
        except Exception as exc:
            logger.error(f"Pipeline error: {exc}")
            response["pipeline_error"] = str(exc)

    return response


@app.post("/api/run-with-uploaded")
def run_with_uploaded(use_builtin: bool = True):
    """Re-run pipeline on all currently uploaded + optional builtin resumes."""
    try:
        results = _run_pipeline_on_all(use_builtin=use_builtin)
        _state["results"] = results
        return results
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/uploaded-files")
def get_uploaded_files():
    """Return list of PDFs uploaded in this session."""
    return {
        "files": _state["uploaded_files"],
        "count": len(_state["uploaded_resumes"]),
    }


@app.delete("/api/uploaded-files/{filename}")
def remove_file(filename: str):
    """Remove a specific PDF from the session."""
    key = f"pdf_{Path(filename).stem}"
    if key in _state["uploaded_resumes"]:
        del _state["uploaded_resumes"][key]
        _state["uploaded_files"] = [
            x for x in _state["uploaded_files"] if x["name"] != filename
        ]
        logger.info(f"Removed: {filename}")
        return {"status": "removed", "filename": filename}
    raise HTTPException(status_code=404, detail=f"{filename} not in session")


@app.post("/api/clear")
def clear_session():
    """Clear all uploaded PDFs and results."""
    _state["uploaded_resumes"].clear()
    _state["uploaded_files"].clear()
    _state["results"] = None
    logger.info("Session cleared")
    return {"status": "cleared"}


# ── CSV Upload ────────────────────────────────────────────────

@app.post("/api/upload-csv")
async def upload_csv(
    file        : UploadFile = File(...),
    text_col    : Optional[str] = Form(default=None),
    name_col    : Optional[str] = Form(default=None),
    use_builtin : bool = Form(default=True),
    max_rows    : int  = Form(default=200),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    import tempfile, os
    raw_bytes = await file.read()
    tmp_dir   = tempfile.gettempdir()          # works on Windows, Mac, Linux
    tmp_path  = Path(tmp_dir) / file.filename
    tmp_path.write_bytes(raw_bytes)

    resumes = {}
    if use_builtin:
        resumes.update({f"builtin_{k}": v for k, v in BUILTIN_RESUMES.items()})

    csv_data = load_from_csv(str(tmp_path), text_col=text_col,
                              name_col=name_col, max_rows=max_rows)
    resumes.update(csv_data)
    resumes.update(_state["uploaded_resumes"])
    tmp_path.unlink(missing_ok=True)

    if not resumes:
        raise HTTPException(status_code=400, detail="No resumes loaded from CSV")

    try:
        results = run_full_pipeline(resumes, _state["config"])
        _state["results"] = results
        return results
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Results ───────────────────────────────────────────────────

@app.get("/api/results")
def get_results():
    if _state["results"] is None:
        raise HTTPException(status_code=404, detail="No results yet")
    return _state["results"]


@app.get("/api/candidate/{candidate_id}")
def get_candidate(candidate_id: str):
    if _state["results"] is None:
        raise HTTPException(status_code=404, detail="No results yet")
    for c in _state["results"]["candidates"]:
        if c["id"] == candidate_id:
            return c
    raise HTTPException(status_code=404, detail=f"Candidate not found")


@app.get("/api/skills-list")
def get_skills_list():
    return {"skills": sorted(SKILLS_DB)}


if __name__ == "__main__":
    import uvicorn
    logger.info("ATS API starting on http://localhost:8000")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)