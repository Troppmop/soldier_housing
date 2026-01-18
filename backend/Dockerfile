FROM python:3.11-slim
WORKDIR /app
# Copy full context so this Dockerfile works whether the build context is the
# repo root or the backend/ subfolder. Install requirements conditionally
# from backend/requirements.txt (repo-root context) or requirements.txt
# (backend-context).
COPY . .

RUN set -eux; \
		apt-get update && apt-get install -y --no-install-recommends libpq-dev && rm -rf /var/lib/apt/lists/*; \
		if [ -f backend/requirements.txt ]; then \
			pip install --no-cache-dir -r backend/requirements.txt; \
		elif [ -f requirements.txt ]; then \
			pip install --no-cache-dir -r requirements.txt; \
		else \
			echo "No requirements file found"; \
		fi

ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
