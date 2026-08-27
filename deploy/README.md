# Branch deployments

The deploy compose files are branch-specific so dev and production can run with
separate containers, ports, domains, backend URLs, and secrets.

- `deploy/docker-compose.dev.yml` is for the `dev` branch.
- `deploy/docker-compose.main.yml` is for the `main` branch.

Both files expect the same two runtime files on the server:

- `.env` for compose interpolation values such as `FRONTEND_IMAGE` and
  `FRONTEND_PORT`.
- `.env.runtime` for application runtime values such as `API_BASE_URL`,
  `AUTH_SECRET`, `AUTH_URL`, OAuth credentials, and `NEXT_PUBLIC_SITE_URL`.

Use separate deployment directories, for example:

- `/opt/supplyed/frontend-dev`
- `/opt/supplyed/frontend-main`

If dev and main run on the same server, give them different ports and route each
port through the reverse proxy.

## Dev CI/CD

Pushing to `dev` runs lint/build checks, publishes a Docker image to GHCR, and
deploys that image to the development server. Pull requests targeting `dev` run
only the checks.

Create a GitHub environment named `dev` and configure these secrets:

- `DEV_SERVER_HOST`: server hostname or IP
- `DEV_SERVER_USER`: SSH user with Docker access
- `DEV_SERVER_SSH_KEY`: private SSH key
- `DEV_SERVER_KNOWN_HOSTS`: pinned server host key from `ssh-keyscan`
- `DEV_API_BASE_URL`: backend loopback URL on the server, for example
  `http://127.0.0.1:4000`
- `DEV_AUTH_SECRET`: a long random Auth.js secret
- Optional OAuth secrets used in `.env.example`

Configure these GitHub environment variables:

- `DEV_AUTH_URL`: public development frontend URL
- `DEV_SITE_URL`: public development frontend URL
- `DEV_FRONTEND_PORT`: frontend server port (defaults to `3000`)
- `DEV_DEPLOY_PATH`: deployment directory (defaults to
  `/opt/supplyed/frontend-dev`)

The server must be Linux with Docker and the Compose plugin installed. Its SSH
user must be able to write to the deployment directory and run Docker. The
frontend uses host networking and binds to `127.0.0.1`, so its server-side API
requests can reach a backend listening on the server's loopback interface. Put a
reverse proxy in front of the frontend port when it needs to be publicly
accessible. The backend does not need a public URL.

## Main deployment

The `main` branch compose file is ready for production, but this repository does
not yet contain a `main` GitHub Actions deployment workflow. Until that workflow
exists, deploy `main` manually or copy the `dev` workflow and replace all `DEV_*`
secrets/variables with production-specific `PROD_*` values.

Example production `.env`:

```dotenv
FRONTEND_IMAGE=ghcr.io/owner/repository:main
FRONTEND_PORT=3000
FRONTEND_BIND_ADDRESS=127.0.0.1
```

Example production `.env.runtime`:

```dotenv
API_BASE_URL=http://127.0.0.1:3002
AUTH_SECRET=replace-with-a-long-production-secret
AUTH_URL=https://app.supplyed.co.uk
NEXT_PUBLIC_SITE_URL=https://app.supplyed.co.uk
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=
```

Run production:

```sh
docker compose --env-file .env -f docker-compose.main.yml pull
docker compose --env-file .env -f docker-compose.main.yml up -d --remove-orphans
```

Run dev:

```sh
docker compose --env-file .env -f docker-compose.dev.yml pull
docker compose --env-file .env -f docker-compose.dev.yml up -d --remove-orphans
```
