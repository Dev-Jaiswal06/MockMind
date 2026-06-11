# backend/resume_parser.py
import PyPDF2, docx, io

def parse_resume(file_bytes, filename):
    filename = filename.lower()
    text     = ""

    if filename.endswith(".pdf"):
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                t = page.extract_text()
                if t: text += t + "\n"
        except Exception as e:
            return f"PDF error: {e}", []

    elif filename.endswith((".docx", ".doc")):
        try:
            doc  = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            return f"DOCX error: {e}", []

    elif filename.endswith(".txt"):
        text = file_bytes.decode("utf-8", errors="ignore")
    else:
        return "", []

    return text.strip(), _skills(text)


def _skills(text):
    keywords = [
        "python","javascript","typescript","react","node.js","flask",
        "django","machine learning","deep learning","tensorflow","pytorch",
        "scikit-learn","sql","mongodb","postgresql","mysql","redis",
        "docker","kubernetes","git","aws","azure","gcp","html","css",
        "tailwind","bootstrap","next.js","express","data science",
        "numpy","pandas","nlp","opencv","java","c++","c#","go","php",
        "figma","ui/ux","rest api","graphql","linux","bash"
    ]
    low = text.lower()
    return list({s for s in keywords if s in low})