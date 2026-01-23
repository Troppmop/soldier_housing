# Soldier Housing (Fullstack)

Quick scaffold for a mobile-friendly fullstack apartment registry (React + Vite + Tailwind frontend; FastAPI + SQLAlchemy backend; Postgres). Everything can be run via Docker locally and deployed to Railway.

## Local testing (Docker)

### Option A: Run using published Docker Hub images

```bash
docker compose pull
docker compose up
```

### Option B: Build locally (tag as `v1`) and run

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build
docker compose -f docker-compose.yml -f docker-compose.build.yml up
```

To publish those `v1` images to Docker Hub:

```bash
docker login
docker push dovidtroppe/soldier-housing-backend:v1
docker push dovidtroppe/soldier-housing-frontend:v1
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:8000 (OpenAPI at `/docs`)
- Postgres: localhost:5432

Default admin user (change during deployment):
- email: `admin@example.com`
- password: `changeme`

## Deploying to Railway (Docker)

1. Create a new Railway project.
2. Add a Postgres plugin (Railway will provide `DATABASE_URL`).
3. Create two services (or one monorepo service with two Dockerfiles):
    - Backend service: set Dockerfile to `backend/Dockerfile`. Set env vars:
       - `DATABASE_URL` (provided by Railway Postgres)
       - `SECRET_KEY` (set a strong random value)
       - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (bootstrap an admin user)
       - `RESEND_API_KEY`, `RESEND_FROM` (required for outbound emails)
       - `RESEND_REPLY_TO` (optional)
       - `CORS_ORIGINS` (comma-separated): `https://<your-frontend-domain>,http://localhost:8080,http://localhost:5173`
    - Frontend service: use `frontend/Dockerfile.prod`. Set env vars:
       - `VITE_API_URL`: `https://<your-backend-domain>`
4. Deploy. Railway builds the containers using the Dockerfiles. The frontend writes `/config.json` at startup from `VITE_API_URL`.

Troubleshooting:
- CORS error (No Access-Control-Allow-Origin): ensure backend `CORS_ORIGINS` includes your exact frontend origin (no trailing slash).
- Frontend calling localhost in prod: verify `https://<frontend>/config.json` contains the correct backend URL.
- 502/Bad Gateway: not applicable; nginx is not used. Frontend is served by a Node static server.
- `docker compose pull` says "not found": the image repo/tag doesn’t exist on Docker Hub (check `BACKEND_IMAGE`/`FRONTEND_IMAGE` in `.env`). If the repo is private, run `docker login` first.

Security note: change the default admin password before exposing to production. Set a strong `SECRET_KEY`.

## API Overview

- `POST /auth/register` - register
- `POST /auth/token` - form login (returns Bearer token)
- `GET /users/me` - get current user
- `GET /apartments` - list
- `POST /apartments` - create (auth)
- `POST /apartments/{id}/apply` - apply (auth)

## Development notes

- Backend dependencies: see `backend/requirements.txt`.
- Frontend dependencies: see `frontend/package.json`.

If you want, I can:
- Add migrations (Alembic)
- Harden auth (refresh tokens, email verification)
- Add file/image uploads for apartments

Would you like me to run the local docker-compose? (I can run commands if you want.)
