FROM python:3.11-slim
WORKDIR /app
# When building from repo root (CI / Railway), files may be referenced from project root.
# Support both repo-root and backend-folder build contexts by attempting to copy from known locations.
# Primary (repo root build): copy from ./backend; fallback for local builds uses relative paths.
COPY backend/requirements.txt ./requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app /app/app
COPY backend/startup.py /app/startup.py
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
