# Development deployment

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
