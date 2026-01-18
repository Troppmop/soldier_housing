FROM python:3.11-slim
WORKDIR /app
# When CI builds from the repo root, the backend sources live under ./backend.
# Copy from both possible locations so builds succeed regardless of context.
# Prefer repo-root paths first, fallback to local paths when present.
COPY backend/requirements.txt ./requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
# Copy backend sources (repo-root context)
COPY backend/app /app/app
COPY backend/startup.py /app/startup.py
# Fallback: if building from inside backend/ folder, ensure files are present
COPY app /app/app
COPY startup.py /app/startup.py
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
