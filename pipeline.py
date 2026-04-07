# ============================================================
#  backend/pipeline.py
#
#  All ML logic in one file:
#    - Text preprocessing (spaCy)
#    - Skill extraction
#    - Experience extraction
#    - TF-IDF + cosine similarity
#    - Feature building
#    - Label generation
#    - Model training (LR, RF, GBM, SVM)
#    - ATS scoring
#    - Personality detection
#    - Ranking
# ============================================================

import re
import warnings
import numpy as np
import pandas as pd
from loguru import logger

import spacy
from spacy.lang.en.stop_words import STOP_WORDS

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, classification_report,
)

warnings.filterwarnings("ignore")

# ── Load spaCy once ───────────────────────────────────────────
try:
    nlp = spacy.load("en_core_web_sm")
    logger.success("spaCy loaded")
except OSError:
    raise SystemExit("Run: python -m spacy download en_core_web_sm")


# ════════════════════════════════════════════════════════════
#  SECTION 1 — BUILTIN SYNTHETIC DATASET
#  Format: dict[str, str]  →  {candidate_name: resume_text}
#  This is the "current dataset format" — plain Python strings.
# ════════════════════════════════════════════════════════════

BUILTIN_RESUMES: dict[str, str] = {
    "aisha_khan": """
    Aisha Khan | aisha.khan@email.com | Mumbai
    Senior Data Scientist with 8 years of experience in machine learning and NLP.
    Skills: Python, TensorFlow, PyTorch, scikit-learn, NLP, BERT, transformers,
    deep learning, SQL, PostgreSQL, AWS, Docker, Kubernetes, Git, pandas, numpy,
    Spark, Kafka, Airflow, FastAPI, MLflow, Kubeflow, feature engineering.
    Led NLP pipeline reducing churn 23%. Mentored team of 6. Presented to C-suite.
    Data Scientist TechCorp 2019–present. DataWorks 2016–2019. 8 years experience.
    """,
    "rahul_verma": """
    Rahul Verma | rahul.v@gmail.com | Bangalore
    Machine Learning Engineer with 5 years in computer vision and deep learning.
    Skills: Python, PyTorch, TensorFlow, OpenCV, scikit-learn, deep learning,
    computer vision, SQL, AWS, Docker, Git, pandas, numpy, Flask, YOLO.
    Real-time object detection 91% mAP. Deployed on AWS using Docker.
    ML Engineer VisionAI 2020–present. Infosys 2019–2020. 5 years experience.
    """,
    "priya_sharma": """
    Priya Sharma | priya.sharma@outlook.com | Hyderabad
    Data Scientist with 3 years experience in analytics and machine learning.
    Skills: Python, machine learning, scikit-learn, pandas, numpy, SQL, Tableau,
    Power BI, matplotlib, seaborn, random forest, NLP basics.
    Predictive models for customer segmentation. 3 years experience.
    """,
    "arjun_nair": """
    Arjun Nair | arjun.nair@techmail.com | Pune
    Junior Data Analyst with 1 year of experience. Recent graduate.
    Skills: Python basics, SQL, Excel, Tableau, statistics, data visualisation.
    Data Analyst LocalBiz 2023–present. 1 year.
    """,
    "sneha_patel": """
    Sneha Patel | sneha.patel@data.io | Chennai
    NLP Engineer and Data Scientist with 6 years of experience.
    Skills: Python, NLP, spaCy, NLTK, BERT, transformers, Hugging Face, machine learning,
    deep learning, TensorFlow, scikit-learn, SQL, Docker, AWS, Git, pandas.
    Deployed NLP pipelines 5M documents per day. Led 4-person NLP team. 6 years experience.
    """,
    "vikram_singh": """
    Vikram Singh | vikramsingh@dev.com | Delhi
    Full Stack Developer transitioning to Data Science. 4 years software experience.
    Skills: Python, JavaScript, SQL, MongoDB, Git, Docker, AWS basics, Flask, pandas.
    Full Stack Developer WebAgency 2020–present. 4 years.
    """,
    "meera_iyer": """
    Dr. Meera Iyer | meera.iyer@research.edu | Bangalore
    AI Researcher with 10 years of experience.
    Skills: Python, R, machine learning, deep learning, NLP, TensorFlow, PyTorch,
    scikit-learn, SQL, MongoDB, AWS, GCP, Azure, Docker, Kubernetes, Spark, MLflow.
    Principal Researcher IISc 2018–present. Amazon India 2016–2018. 10 years experience.
    """,
    "karthik_r": """
    Karthik R | karthik.ramesh@ml.com | Coimbatore
    ML Engineer with 2 years of experience.
    Skills: Python, scikit-learn, pandas, numpy, matplotlib, SQL, Git, machine learning,
    logistic regression, random forest, Docker, Flask.
    ML Engineer TechStartup 2022–present. 2 years.
    """,
    "ananya_das": """
    Ananya Das | ananya.das@dataeng.com | Kolkata
    Senior Data Engineer with 4 years in big data pipelines.
    Skills: Python, SQL, PostgreSQL, Apache Spark, Kafka, Hadoop, Airflow,
    AWS, GCP, Docker, Kubernetes, Terraform, Git, dbt, pandas, PySpark.
    Real-time pipeline 1B events per day. AWS cloud migration. 4 years experience.
    """,
    "riya_mehta": """
    Riya Mehta | riya.m@analytics.com | Ahmedabad
    Business Intelligence Analyst with 3 years of experience.
    Skills: SQL, Python, Tableau, Power BI, Excel, data visualisation, pandas.
    30+ executive dashboards. 3 years experience.
    """,
    "deepak_joshi": """
    Deepak Joshi | deepak.j@cloudml.com | Noida
    Cloud ML Architect with 7 years in MLOps and model deployment.
    Skills: Python, TensorFlow, PyTorch, scikit-learn, MLflow, Kubeflow,
    AWS SageMaker, Azure ML, Docker, Kubernetes, Git, SQL, FastAPI, machine learning.
    MLOps platform deployment time 2 weeks to 2 hours. Led 8 engineers. 7 years experience.
    """,
    "pooja_reddy": """
    Pooja Reddy | pooja.reddy@stats.com | Visakhapatnam
    Statistician and Data Scientist with 5 years of experience.
    Skills: Python, R, statistical modelling, hypothesis testing, A/B testing,
    regression, time series, scikit-learn, pandas, numpy, SQL, machine learning.
    Clinical trial analysis. A/B testing 20+ experiments. 5 years experience.
    """,
    "nikhil_gupta": """
    Nikhil Gupta | nikhil.g@fresher.com | Jaipur
    Recent Graduate B.Tech CSE 2024. Seeking entry-level ML role.
    Skills: Python, pandas, numpy, matplotlib, scikit-learn, SQL, Git, Jupyter.
    Projects: Iris classification, movie recommendation, COVID analysis.
    Data Science Intern LocalStartup 5 months.
    """,
    "lakshmi_v": """
    Lakshmi Venkatesh | lakshmi.v@bi.com | Mysore
    Data Analyst with 2 years in BI and reporting.
    Skills: SQL, Excel, Tableau, Google Data Studio, Python basics, data visualisation.
    Weekly dashboards for 500+ educators. 2 years experience.
    """,
    "saurabh_tiwari": """
    Saurabh Tiwari | saurabh.t@fintech.com | Mumbai
    Quantitative Analyst and Data Scientist with 6 years of experience.
    Skills: Python, R, machine learning, deep learning, LSTM, TensorFlow, scikit-learn,
    pandas, numpy, SQL, quantitative finance, algorithmic trading, Docker, AWS.
    LSTM stock prediction. Led quant team. 6 years experience.
    """,
    "amit_sharma": """
    Amit Sharma | amit.sharma@mlops.com | Bangalore
    MLOps Engineer with 4 years in production ML systems.
    Skills: Python, TensorFlow, PyTorch, MLflow, Kubeflow, Docker, Kubernetes,
    AWS SageMaker, GCP Vertex AI, CI/CD, Jenkins, Git, SQL, model deployment.
    Deployed 20+ models on Kubernetes. 4 years experience.
    """,
    "divya_krishnan": """
    Divya Krishnan | divya.k@airesearch.com | Chennai
    Research Scientist with 7 years in deep learning and NLP.
    Skills: Python, PyTorch, TensorFlow, BERT, GPT, transformers, Hugging Face, NLP,
    machine learning, scikit-learn, SQL, AWS, Docker, MLflow.
    Published 5 papers ACL EMNLP NeurIPS. 7 years experience.
    """,
    "rohit_bansal": """
    Rohit Bansal | rohit.bansal@analytics.com | Gurgaon
    Data Scientist with 4 years in retail analytics.
    Skills: Python, machine learning, scikit-learn, XGBoost, LightGBM, pandas,
    numpy, SQL, AWS, Docker, Git, feature engineering, A/B testing.
    Recommendation engine improving CTR 18%. 4 years experience.
    """,
    "kavitha_r": """
    Kavitha Raghunathan | kavitha.r@healthcare.com | Hyderabad
    Healthcare Data Scientist with 5 years in clinical ML.
    Skills: Python, R, machine learning, scikit-learn, pandas, numpy, SQL,
    statistical modelling, time series, TensorFlow, NLP, Docker, AWS.
    Patient readmission models. 5 years experience.
    """,
    "suresh_menon": """
    Suresh Menon | suresh.m@bigdata.com | Kochi
    Big Data Engineer with 6 years in Spark and Hadoop ecosystems.
    Skills: Python, Spark, PySpark, Hadoop, Kafka, Hive, Airflow, SQL, PostgreSQL,
    MongoDB, AWS, GCP, Docker, Git, Scala, ETL, data warehouse, dbt.
    Spark pipeline 500TB monthly on AWS EMR. 6 years experience.
    """,
    "neha_kapoor": """
    Neha Kapoor | neha.kapoor@startup.com | Pune
    Data Scientist and ML Engineer with 3 years at startups.
    Skills: Python, machine learning, scikit-learn, TensorFlow, Keras, pandas, numpy,
    SQL, MongoDB, Docker, AWS Lambda, Git, Flask, FastAPI, deep learning.
    End-to-end ML pipeline for 50K daily users. 3 years experience.
    """,
    "manish_agarwal": """
    Manish Agarwal | manish.a@senior.com | Mumbai
    Principal Data Scientist with 9 years across multiple domains.
    Skills: Python, R, machine learning, deep learning, NLP, TensorFlow, PyTorch,
    scikit-learn, XGBoost, SQL, PostgreSQL, AWS, GCP, Docker, Kubernetes, Spark,
    Airflow, MLflow, statistical modelling, A/B testing, causal inference.
    ML platform for 200+ data scientists. Led team of 15. 9 years experience.
    """,
    "tanya_mathur": """
    Tanya Mathur | tanya.m@junior.com | Noida
    Junior Data Scientist with 1.5 years of experience.
    Skills: Python, pandas, numpy, scikit-learn, SQL, Git, Jupyter, machine learning,
    logistic regression, decision trees, matplotlib, seaborn, statistics.
    Customer churn model 78% accuracy. 1.5 years experience.
    """,
    "prasad_iyer": """
    Prasad Iyer | prasad.i@cv.com | Bangalore
    Computer Vision Engineer with 5 years of experience.
    Skills: Python, PyTorch, TensorFlow, OpenCV, YOLO, Faster RCNN, deep learning,
    machine learning, computer vision, image classification, Docker, AWS.
    Real-time defect detection 97% precision. 5 years experience.
    """,
    "anitha_george": """
    Anitha George | anitha.g@analyst.com | Kochi
    Senior Business Analyst with 4 years in data-driven decisions.
    Skills: SQL, Python basics, Excel advanced, Tableau, Power BI, DAX,
    data visualisation, statistical analysis, A/B testing, stakeholder management.
    Self-service analytics platform 300+ users. 4 years experience.
    """,
}


# ════════════════════════════════════════════════════════════
#  SECTION 2 — SKILLS DATABASE
# ════════════════════════════════════════════════════════════

SKILLS_DB: list[str] = [
    "python","java","javascript","typescript","c++","c#","r","scala","go","bash",
    "machine learning","deep learning","reinforcement learning","transfer learning",
    "neural network","lstm","transformer","bert","gpt","xgboost","lightgbm",
    "gradient boosting","random forest","logistic regression","svm","feature engineering",
    "hyperparameter tuning","a/b testing","model deployment","mlops","mlflow","kubeflow",
    "nlp","natural language processing","text classification","sentiment analysis",
    "named entity recognition","transformers","hugging face","spacy","nltk",
    "computer vision","object detection","image classification","opencv","yolo",
    "tensorflow","pytorch","keras","scikit-learn","pandas","numpy","matplotlib",
    "seaborn","flask","fastapi","django","streamlit","pyspark",
    "sql","mysql","postgresql","mongodb","redis","elasticsearch","bigquery","redshift",
    "aws","azure","gcp","docker","kubernetes","terraform","ci/cd","jenkins",
    "airflow","kafka","spark","hadoop","sagemaker",
    "statistics","probability","hypothesis testing","regression","time series",
    "forecasting","bayesian","statistical modelling",
    "tableau","power bi","excel","data visualisation","looker",
]

_COMPILED = {
    s: re.compile(
        (re.escape(s) if " " in s else r"\b" + re.escape(s) + r"\b"),
        re.IGNORECASE,
    )
    for s in SKILLS_DB
}


# ════════════════════════════════════════════════════════════
#  SECTION 3 — NLP PREPROCESSING
# ════════════════════════════════════════════════════════════

def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"\S+@\S+\.\S+", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def preprocess(text: str) -> str:
    cleaned = clean_text(text)
    doc     = nlp(cleaned[:500000])
    tokens  = [
        t.lemma_ for t in doc
        if not t.is_punct and not t.is_space
        and t.text not in STOP_WORDS
        and len(t.text) > 2
        and t.text.replace("-","").replace("/","").isalpha()
    ]
    return " ".join(tokens)


# ════════════════════════════════════════════════════════════
#  SECTION 4 — FEATURE EXTRACTION
# ════════════════════════════════════════════════════════════

def extract_skills(text: str) -> list[str]:
    return sorted({s for s, p in _COMPILED.items() if p.search(text)})


def extract_experience(text: str) -> float:
    t = text.lower()
    mentions = re.findall(r"(\d+)\+?\s*years?\s+(?:of\s+)?experience", t)
    m_val = float(max([int(x) for x in mentions])) if mentions else 0.0
    ranges = re.findall(r"(\d{4})\s*[–\-—to]+\s*(present|current|\d{4})", t)
    r_total = 0.0
    for s, e in ranges:
        try:
            sv = int(s)
            ev = 2024 if e in ("present","current") else int(e)
            if 1970 <= sv <= 2024 and ev >= sv:
                r_total += ev - sv
        except ValueError:
            pass
    return max(m_val, min(r_total, 40.0))


def exp_score(years: float, min_req: float) -> float:
    if years <= 0:   return 0.0
    if years < min_req and min_req > 0:
        return round((years / 15.0) * (years / min_req), 4)
    return round(min(years / 15.0, 1.0), 4)


def seniority_label(years: float) -> str:
    if years == 0:  return "Unknown"
    if years <= 1:  return "Fresher"
    if years <= 2:  return "Junior"
    if years <= 4:  return "Mid-level"
    if years <= 7:  return "Senior"
    return "Principal / Lead"


def keyword_overlap(resume: str, jd: str) -> float:
    jd_tok  = set(preprocess(jd).split())
    res_tok = set(preprocess(resume).split())
    return len(jd_tok & res_tok) / len(jd_tok) if jd_tok else 0.0


# ════════════════════════════════════════════════════════════
#  SECTION 5 — PERSONALITY DETECTION
# ════════════════════════════════════════════════════════════

_PERS = {
    "Leadership"    : [r"\blead\b",r"\bled\b",r"\bmanaged\b",r"\bmentored\b",
                        r"\bspearheaded\b",r"\bsupervised\b",r"\bdirected\b"],
    "Teamwork"      : [r"\bteam\b",r"\bcollaborat",r"\bcross-functional\b",
                        r"\bpartnered\b",r"\bsynergy\b"],
    "Communication" : [r"\bpresented\b",r"\bcommunicated\b",r"\breported\b",
                        r"\bstakeholder\b",r"\bnegotiated\b",r"\bauthored\b"],
    "Problem Solving": [r"\bsolved\b",r"\boptimis",r"\boptimiz",r"\bimproved\b",
                         r"\bdebugged\b",r"\bdiagnosed\b"],
    "Initiative"    : [r"\bproactive\b",r"\binitiative\b",r"\bself-motivated\b",
                        r"\bindependently\b",r"\bpioneered\b"],
    "Mentorship"    : [r"\bmentored\b",r"\bcoached\b",r"\btrained\b",
                        r"\bonboarded\b",r"\bguided\b"],
    "Research"      : [r"\bresearch\b",r"\bpublished\b",r"\bpaper\b",
                        r"\bconference\b",r"\bjournal\b"],
}


def detect_personality(text: str) -> list[str]:
    return [
        trait for trait, patterns in _PERS.items()
        if any(re.search(p, text, re.I) for p in patterns)
    ]


# ════════════════════════════════════════════════════════════
#  SECTION 6 — FULL PIPELINE
# ════════════════════════════════════════════════════════════

FEATURE_NAMES = [
    "cosine_sim","must_match","pref_match","total_match",
    "keyword_overlap","norm_exp","exp_score_feat",
    "skill_count_norm","skill_density","seniority_score",
]

LABEL_WEIGHTS = [0.20, 0.28, 0.08, 0.08, 0.10, 0.10, 0.06, 0.04, 0.03, 0.03]


def run_full_pipeline(resumes: dict, job_config: dict) -> dict:
    """
    Main pipeline entry point.

    Args:
        resumes    : {name: resume_text}
        job_config : {
            title         : str,
            must_have     : list[str],
            preferred     : list[str],
            min_experience: float,
            threshold     : float,
            jd_text       : str,
        }

    Returns full results dict consumed by the API and frontend.
    """
    names     = list(resumes.keys())
    jd_text   = job_config.get("jd_text", "")
    must_have = [s.strip().lower() for s in job_config.get("must_have", [])]
    preferred = [s.strip().lower() for s in job_config.get("preferred", [])]
    min_exp   = float(job_config.get("min_experience", 0))
    threshold = float(job_config.get("threshold", 50.0))

    # ── Preprocess ────────────────────────────────────────────
    processed    = {n: preprocess(t) for n, t in resumes.items()}
    jd_processed = preprocess(jd_text)

    # ── TF-IDF similarity ─────────────────────────────────────
    corpus = [jd_processed] + [processed[n] for n in names]
    vectoriser = TfidfVectorizer(
        max_features=6000, ngram_range=(1,3), sublinear_tf=True,
        min_df=1, token_pattern=r"[a-z][a-z/\+#\.\-]*"
    )
    mat       = vectoriser.fit_transform(corpus)
    sims      = cosine_similarity(mat[1:], mat[0]).flatten().tolist()

    # ── Build feature matrix ──────────────────────────────────
    rows    = []
    extras  = []
    for i, name in enumerate(names):
        raw    = resumes[name]
        skills = extract_skills(raw)
        years  = extract_experience(raw)
        tc     = len(processed[name].split())
        sim    = sims[i]

        must_m  = len(set(skills) & set(must_have)) / max(len(must_have), 1)
        pref_m  = len(set(skills) & set(preferred)) / max(len(preferred), 1)
        total_m = len(set(skills) & set(must_have + preferred)) / max(len(must_have + preferred), 1)
        kw      = keyword_overlap(raw, jd_text)
        n_exp   = min(years / 15.0, 1.0)
        e_sc    = exp_score(years, min_exp)
        sc_norm = min(len(skills) / 50.0, 1.0)
        density = (len(skills) / max(tc, 1)) * 100
        sen     = min(years / 10.0, 1.0)

        rows.append([sim, must_m, pref_m, total_m, kw, n_exp, e_sc, sc_norm, density, sen])
        extras.append({
            "skills"  : skills,
            "years"   : years,
            "seniority": seniority_label(years),
            "personality": detect_personality(raw),
            "must_matched": sorted(set(skills) & set(must_have)),
            "missing"     : sorted(set(must_have) - set(skills)),
        })

    feature_df = pd.DataFrame(rows, columns=FEATURE_NAMES, index=names)

    # ── Generate labels ───────────────────────────────────────
    w         = np.array(LABEL_WEIGHTS)
    df_n      = feature_df.copy()
    rng       = df_n["skill_density"].max() - df_n["skill_density"].min()
    df_n["skill_density"] = (
        (df_n["skill_density"] - df_n["skill_density"].min()) / rng
        if rng > 0 else 0.5
    )
    composite = df_n[FEATURE_NAMES].values @ w
    labels    = (composite >= np.median(composite)).astype(int)

    # ── Scale + split ──────────────────────────────────────────
    X        = feature_df.values.astype(float)
    scaler   = MinMaxScaler()
    X_sc     = scaler.fit_transform(X)
    n        = len(X)
    ts       = max(0.20, min(0.30, 6 / n)) if n > 8 else 0.3
    X_tr, X_te, y_tr, y_te = train_test_split(
        X_sc, labels, test_size=ts, random_state=42,
        stratify=labels if len(set(labels)) > 1 else None,
    )

    # ── Train 4 models ────────────────────────────────────────
    CLFS = {
        "Logistic Regression": LogisticRegression(max_iter=2000, C=0.8, random_state=42),
        "Random Forest"      : RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42),
        "Gradient Boosting"  : GradientBoostingClassifier(n_estimators=150, max_depth=3, random_state=42),
        "SVM"                : SVC(kernel="rbf", C=1.2, probability=True, random_state=42),
    }

    model_metrics = {}
    best_f1, best_name, best_model = -1.0, "", None

    for mname, clf in CLFS.items():
        clf.fit(X_tr, y_tr)
        yp = clf.predict(X_te)
        f1 = f1_score(y_te, yp, zero_division=0)
        model_metrics[mname] = {
            "accuracy" : round(accuracy_score(y_te, yp), 4),
            "precision": round(precision_score(y_te, yp, zero_division=0), 4),
            "recall"   : round(recall_score(y_te, yp, zero_division=0), 4),
            "f1"       : round(f1, 4),
        }
        try:
            ypr = clf.predict_proba(X_te)[:,1]
            model_metrics[mname]["auc"] = round(roc_auc_score(y_te, ypr), 4)
        except Exception:
            model_metrics[mname]["auc"] = 0.0

        if f1 > best_f1:
            best_f1, best_name, best_model = f1, mname, clf

    # ── Score all candidates ──────────────────────────────────
    candidates = []
    for i, name in enumerate(names):
        fvec   = feature_df.iloc[i].to_dict()
        ex     = extras[i]
        years  = ex["years"]
        skills = ex["skills"]

        # ATS score
        raw_score = (
            fvec["must_match"]       * 0.40 +
            exp_score(years, min_exp)* 0.25 +
            fvec["keyword_overlap"]  * 0.20 +
            fvec["cosine_sim"]       * 0.15
        )
        raw_score += fvec["pref_match"] * 0.05
        ats = round(min(raw_score * 100, 100.0), 2)

        # ML prediction
        ml_pred = int(best_model.predict(scaler.transform([feature_df.iloc[i].values.tolist()]))[0])
        ml_prob = 0.0
        if hasattr(best_model, "predict_proba"):
            ml_prob = round(float(best_model.predict_proba(
                scaler.transform([feature_df.iloc[i].values.tolist()])
            )[0][1]) * 100, 1)

        # Extract name + email from text
        raw      = resumes[name]
        disp_name = _extract_display_name(raw, name)
        email     = _extract_email(raw)
        source    = "builtin" if name.startswith("builtin_") else \
                    ("csv" if name.startswith("csv_") else \
                    ("pdf" if name.startswith("pdf_") else "builtin"))

        candidates.append({
            "id"            : name,
            "name"          : disp_name,
            "email"         : email,
            "source"        : source,
            "ats_score"     : ats,
            "decision"      : "Shortlist" if ats >= threshold else "Reject",
            "ml_prediction" : "Shortlist" if ml_pred == 1 else "Reject",
            "ml_confidence" : ml_prob,
            "years_exp"     : years,
            "seniority"     : ex["seniority"],
            "skills_count"  : len(skills),
            "skills"        : skills,
            "must_matched"  : ex["must_matched"],
            "missing_skills": ex["missing"],
            "personality"   : ex["personality"],
            # sub-scores
            "skill_match_pct": round(fvec["must_match"] * 100, 1),
            "exp_pct"        : round(exp_score(years, min_exp) * 100, 1),
            "keyword_pct"    : round(fvec["keyword_overlap"] * 100, 1),
            "similarity_pct" : round(fvec["cosine_sim"] * 100, 2),
        })

    # Sort by ATS score
    candidates.sort(key=lambda x: x["ats_score"], reverse=True)
    for i, c in enumerate(candidates):
        c["rank"] = i + 1

    shortlisted = [c for c in candidates if c["decision"] == "Shortlist"]
    rejected    = [c for c in candidates if c["decision"] == "Reject"]
    total       = len(candidates)

    return {
        "summary": {
            "total"            : total,
            "shortlisted"      : len(shortlisted),
            "rejected"         : len(rejected),
            "selection_pct"    : round(len(shortlisted) / total * 100, 1) if total else 0,
            "rejection_pct"    : round(len(rejected)    / total * 100, 1) if total else 0,
            "avg_ats_score"    : round(sum(c["ats_score"] for c in candidates) / total, 1) if total else 0,
            "top_score"        : max(c["ats_score"] for c in candidates) if candidates else 0,
            "best_model"       : best_name,
            "best_model_f1"    : round(best_f1, 4),
            "threshold"        : threshold,
        },
        "candidates"   : candidates,
        "shortlisted"  : shortlisted,
        "rejected"     : rejected,
        "model_metrics": model_metrics,
        "job_config"   : job_config,
    }


def _extract_display_name(text: str, key: str) -> str:
    first = text.strip().split("\n")[0]
    part  = first.split("|")[0].strip()
    if 2 <= len(part.split()) <= 4 and len(part) < 50:
        return part
    clean = key.replace("builtin_","").replace("csv_","").replace("pdf_","")
    return clean.replace("_"," ").title()[:40]


def _extract_email(text: str) -> str:
    m = re.search(r"\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b", text, re.I)
    return m.group(0) if m else "—"
