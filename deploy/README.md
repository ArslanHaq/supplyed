# Branch deployments

The deploy compose files are branch-specific so dev and production can run with
separate containers, ports, domains, backend URLs, and secrets.

- `deploy/docker-compose.dev.yml` is for the `dev` branch.
- `deploy/docker-compose.main.yml` is for the `main` branch.

Both compose files expect the same runtime file on the server:

- `$HOME/supplyed/.env` for port, backend URL, Auth.js values, OAuth
  credentials, and public site URL.

Use separate deployment directories, for example:

- `$HOME/supplyed/frontend-dev`
- `$HOME/supplyed/frontend-main`

If dev and main run on the same server, give them different ports and route each
port through the reverse proxy.

## Dev CI/CD

Pushing to `dev` runs lint/build checks, uploads the current source to the
development server, builds the Docker image on that server, and restarts the
frontend container. Pull requests targeting `dev` run only the checks.

Create a GitHub environment named `dev` and configure these secrets:

- `DEV_SERVER_HOST`: server hostname or IP
- `DEV_SERVER_USER`: SSH user with Docker access
- `DEV_SERVER_SSH_KEY`: private SSH key
- `DEV_SERVER_KNOWN_HOSTS`: pinned server host key from `ssh-keyscan`

No GitHub environment variables are required for dev deployment. Runtime app
configuration is owned by the server-side `.env` file.

Create this file manually on the dev server:

```sh
mkdir -p ~/supplyed/frontend-dev
nano ~/supplyed/.env
```

Example dev `.env`:

```dotenv
FRONTEND_PORT=3003
API_BASE_URL=http://127.0.0.1:3002
AUTH_SECRET=replace-with-a-long-development-secret
AUTH_URL=http://13.61.224.16:3003
NEXT_PUBLIC_SITE_URL=http://13.61.224.16:3003
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=
```

The server must be Linux with Docker and the Compose plugin installed. Its SSH
user must be able to write to the deployment directory and run Docker. The
frontend uses host networking, so its server-side API requests can reach a
backend listening on the server's loopback interface. Put a reverse proxy in
front of the frontend port when it needs to be publicly accessible. The backend
does not need a public URL.

The workflow keeps uploaded source releases under:

- `$HOME/supplyed/frontend-dev/releases/<git-sha>`
- `$HOME/supplyed/frontend-dev/current`

Do not put secrets inside the source tree. Keep runtime values only in
`$HOME/supplyed/.env`.

## Main deployment

The `main` branch compose file is ready for production, but this repository does
not yet contain a `main` GitHub Actions deployment workflow. Until that workflow
exists, deploy `main` manually or copy the `dev` workflow and replace all `DEV_*`
secrets/variables with production-specific `PROD_*` values.

Production should use the same directory shape as dev:

- `$HOME/supplyed/frontend-main/releases/<git-sha>`
- `$HOME/supplyed/frontend-main/current`

Example production `.env`:

```dotenv
FRONTEND_PORT=3000
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
cd ~/supplyed
docker compose --env-file .env -f frontend-main/docker-compose.main.yml build --pull frontend
docker compose --env-file .env -f frontend-main/docker-compose.main.yml up -d --remove-orphans
```

Run dev:

```sh
cd ~/supplyed
docker compose --env-file .env -f frontend-dev/docker-compose.dev.yml build --pull frontend
docker compose --env-file .env -f frontend-dev/docker-compose.dev.yml up -d --remove-orphans
```
