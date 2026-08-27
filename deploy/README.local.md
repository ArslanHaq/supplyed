# Local Docker development

Start the frontend with hot reload:

```sh
docker compose -f docker-compose.local.yml up --build -d
```

Open <http://localhost:3000>. By default, server-side requests from the
frontend container reach a backend running on the host at port `4000` through
`http://host.docker.internal:4000`.

Override the frontend port or backend URL when needed:

```sh
FRONTEND_PORT=3001 API_BASE_URL=http://host.docker.internal:4001 \
  docker compose -f docker-compose.local.yml up --build -d
```

View logs or stop it with:

```sh
docker compose -f docker-compose.local.yml logs -f frontend
docker compose -f docker-compose.local.yml down
```
