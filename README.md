# Soldier Housing (Fullstack)

Quick scaffold for a mobile-friendly fullstack apartment registry (React + Vite + Tailwind frontend; FastAPI + SQLAlchemy backend; Postgres). Everything can be run via Docker locally and deployed to Railway.

## Local testing (Docker)

Start services with docker-compose:

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
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
       - `CORS_ORIGINS` (comma-separated): `https://<your-frontend-domain>,http://localhost:8080,http://localhost:5173`
    - Frontend service: use `frontend/Dockerfile.prod`. Set env vars:
       - `VITE_API_URL`: `https://<your-backend-domain>`
4. Deploy. Railway builds the containers using the Dockerfiles. The frontend writes `/config.json` at startup from `VITE_API_URL`.

Troubleshooting:
- CORS error (No Access-Control-Allow-Origin): ensure backend `CORS_ORIGINS` includes your exact frontend origin (no trailing slash).
- Frontend calling localhost in prod: verify `https://<frontend>/config.json` contains the correct backend URL.
- 502/Bad Gateway: not applicable; nginx is not used. Frontend is served by a Node static server.

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
