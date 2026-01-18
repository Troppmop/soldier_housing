# syntax=docker/dockerfile:1.4
FROM python:3.11-slim
WORKDIR /app
# Copy only requirements first to leverage layer caching
COPY requirements.txt ./requirements.txt
# Install Python deps with pip cache for faster rebuilds
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
# Copy application sources
COPY app /app/app
COPY startup.py /app/startup.py
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]