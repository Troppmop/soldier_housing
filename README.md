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
   - Backend service: set Dockerfile to `backend/Dockerfile`. Set env vars: `DATABASE_URL` (from Railway), `SECRET_KEY` (set secure), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
   - Frontend service: set Dockerfile to `frontend/Dockerfile`. Set env var `VITE_API_URL` to your backend URL.
4. Deploy. Railway builds the containers using the Dockerfiles.

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
