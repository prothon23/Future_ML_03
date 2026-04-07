# ============================================================
#  backend/data_loader.py
#  Reads CSV files and PDF folders.
#  Always returns dict[str, str] = {candidate_key: resume_text}
# ============================================================

import re
from pathlib import Path
from loguru import logger

import pandas as pd

COMMON_TEXT_COLS = [
    "Resume", "resume", "resume_text", "ResumeText",
    "text", "Text", "cv", "CV", "description", "content",
]


def load_from_csv(
    filepath    : str,
    text_col    : str = None,
    name_col    : str = None,
    max_rows    : int = 500,
    encoding    : str = "utf-8",
) -> dict:
    """
    Load resumes from a CSV file.
    Returns {csv_<idx>: resume_text}
    """
    path = Path(filepath)
    if not path.exists():
        logger.error(f"CSV not found: {filepath}")
        return {}

    try:
        df = pd.read_csv(filepath, encoding=encoding, nrows=max_rows)
    except UnicodeDecodeError:
        df = pd.read_csv(filepath, encoding="latin-1", nrows=max_rows)

    logger.info(f"CSV '{path.name}' → {df.shape[0]} rows × {df.shape[1]} cols: {list(df.columns)}")

    # Auto-detect text column
    if text_col is None:
        for col in COMMON_TEXT_COLS:
            if col in df.columns:
                text_col = col
                break
    if text_col is None:
        str_cols = df.select_dtypes(include="object").columns.tolist()
        if str_cols:
            avg = {c: df[c].astype(str).str.len().mean() for c in str_cols}
            text_col = max(avg, key=avg.get)

    if text_col is None:
        logger.error("No text column found in CSV")
        return {}

    resumes = {}
    skipped = 0
    for idx, row in df.iterrows():
        raw = str(row.get(text_col, "")).strip()
        if len(raw) < 50:
            parts = [f"{c}: {str(row[c]).strip()}" for c in df.columns
                     if c != name_col and str(row[c]).strip().lower() not in ("nan","none","")]
            raw = " | ".join(parts)
        if len(raw.strip()) < 20:
            skipped += 1
            continue
        if name_col and name_col in row:
            label = str(row[name_col])[:25].strip().replace(" ","_").replace("/","_")
            key   = f"csv_{label}_{idx}"
        else:
            key = f"csv_candidate_{idx:04d}"
        resumes[key] = raw

    logger.success(f"CSV: loaded {len(resumes)}, skipped {skipped}")
    return resumes


def load_from_pdf_folder(folder_path: str) -> dict:
    """
    Load all *.pdf files from a folder.
    Returns {pdf_<stem>: extracted_text}
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.error("pypdf not installed. Run: pip install pypdf")
        return {}

    folder = Path(folder_path)
    if not folder.exists():
        logger.error(f"Folder not found: {folder_path}")
        return {}

    pdf_files = sorted(folder.glob("*.pdf"))
    if not pdf_files:
        logger.warning(f"No PDFs found in: {folder_path}")
        return {}

    resumes = {}
    failed  = 0
    for pdf_path in pdf_files:
        try:
            reader    = PdfReader(str(pdf_path))
            pages     = [p.extract_text() for p in reader.pages
                         if p.extract_text() and len(p.extract_text().strip()) > 10]
            full_text = "\n".join(pages).strip()
            if len(full_text) < 50:
                logger.warning(f"Very little text from {pdf_path.name} — likely scanned PDF")
                failed += 1
                continue
            resumes[f"pdf_{pdf_path.stem}"] = full_text
            logger.success(f"  ✓ {pdf_path.name}")
        except Exception as exc:
            logger.error(f"Failed: {pdf_path.name} — {exc}")
            failed += 1

    logger.success(f"PDF: loaded {len(resumes)}, failed {failed}")
    return resumes


def load_from_pdf_bytes(filename: str, file_bytes: bytes) -> str:
    """
    Extract text from PDF bytes (for file upload via API).
    """
    try:
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(file_bytes))
        pages  = [p.extract_text() for p in reader.pages
                  if p.extract_text() and len(p.extract_text().strip()) > 10]
        return "\n".join(pages).strip()
    except Exception as exc:
        logger.error(f"PDF bytes parse failed for {filename}: {exc}")
        return ""
