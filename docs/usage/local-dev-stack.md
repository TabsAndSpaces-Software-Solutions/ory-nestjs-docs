# Local Development Stack

Spin up the **full Ory stack** on your machine with one `docker compose up`:

| Service | Host URL | Role |
|---|---|---|
| **Kratos — public** | `http://127.0.0.1:4433` | Self-service flows, session introspection. Point `kratos.publicUrl` here. |
| **Kratos — admin** | `http://127.0.0.1:4434` | Identity CRUD, session revoke. Point `kratos.adminUrl` here. |
| **Keto — read** | `http://127.0.0.1:4466` | Permission checks. Point `keto.readUrl` here. |
| **Keto — write** | `http://127.0.0.1:4467` | Relationship grants/revokes. Point `keto.writeUrl` here. |
| **Hydra — public** | `http://127.0.0.1:4444` | OAuth2 / OIDC discovery + tokens. Point `hydra.publicUrl` here. |
| **Hydra — admin** | `http://127.0.0.1:4445` | Client registration, token introspection. Point `hydra.adminUrl` here. |
| **Oathkeeper — proxy** | `http://127.0.0.1:4455` | Identity-aware reverse proxy (put your NestJS app behind this). |
| **Oathkeeper — api** | `http://127.0.0.1:4456` | Rule + health management. |
| **MailSlurper UI** | `http://127.0.0.1:4436` | Catches verification/recovery emails. |

Each Ory service has its own Postgres volume so state persists across restarts. Everything runs on loopback — nothing exposed to your LAN.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine ≥ 24.0 with the Compose v2 plugin (`docker compose version`).
- Ports `4433 / 4434 / 4436 / 4437 / 4444 / 4445 / 4455 / 4456 / 4466 / 4467` free on your host.

## Get the files

Seven files — one compose + six configs. The fastest way:

```bash
mkdir -p config
curl -O https://orynestjs.tabsandspaces.co/local-dev/docker-compose.yml
curl -o config/kratos.yml            https://orynestjs.tabsandspaces.co/local-dev/config/kratos.yml
curl -o config/identity.schema.json  https://orynestjs.tabsandspaces.co/local-dev/config/identity.schema.json
curl -o config/keto.yml              https://orynestjs.tabsandspaces.co/local-dev/config/keto.yml
curl -o config/hydra.yml             https://orynestjs.tabsandspaces.co/local-dev/config/hydra.yml
curl -o config/oathkeeper.yml        https://orynestjs.tabsandspaces.co/local-dev/config/oathkeeper.yml
curl -o config/access-rules.json     https://orynestjs.tabsandspaces.co/local-dev/config/access-rules.json
```

Expected layout:

```
.
├── docker-compose.yml
└── config/
    ├── kratos.yml
    ├── identity.schema.json
    ├── keto.yml
    ├── hydra.yml
    ├── oathkeeper.yml
    └── access-rules.json
```

Or copy each file from the blocks below.

### `docker-compose.yml`

Uses pinned tags (`kratos:v26.2.0`, `keto:v26.2.0`, `hydra:v26.2.0`, `oathkeeper:v26.2.0`). Bump as you like.

```yaml title="docker-compose.yml"
services:
  # ─────────────────────────────── Kratos ───────────────────────────────
  kratos-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kratos
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: kratos
    volumes:
      - kratos-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kratos -d kratos"]
      interval: 3s
      timeout: 3s
      retries: 30

  kratos-migrate:
    image: oryd/kratos:v26.2.0
    environment:
      DSN: postgres://kratos:secret@kratos-postgres:5432/kratos?sslmode=disable&max_conns=20&max_idle_conns=4
    volumes:
      - ./config:/etc/config:ro
    command: -c /etc/config/kratos.yml migrate sql -e --yes
    restart: on-failure
    depends_on:
      kratos-postgres:
        condition: service_healthy

  kratos:
    image: oryd/kratos:v26.2.0
    ports:
      - "4433:4433"
      - "4434:4434"
    environment:
      DSN: postgres://kratos:secret@kratos-postgres:5432/kratos?sslmode=disable&max_conns=20&max_idle_conns=4
      LOG_LEVEL: info
    volumes:
      - ./config:/etc/config:ro
    command: serve -c /etc/config/kratos.yml --dev --watch-courier
    restart: unless-stopped
    depends_on:
      kratos-migrate:
        condition: service_completed_successfully

  mailslurper:
    image: oryd/mailslurper:latest-smtps
    ports:
      - "4436:4436"
      - "4437:4437"
    restart: unless-stopped

  # ──────────────────────────────── Keto ────────────────────────────────
  keto-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: keto
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: keto
    volumes:
      - keto-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U keto -d keto"]
      interval: 3s
      timeout: 3s
      retries: 30

  keto-migrate:
    image: oryd/keto:v26.2.0
    environment:
      DSN: postgres://keto:secret@keto-postgres:5432/keto?sslmode=disable&max_conns=20&max_idle_conns=4
    volumes:
      - ./config:/etc/config:ro
    command: migrate up -y -c /etc/config/keto.yml
    restart: on-failure
    depends_on:
      keto-postgres:
        condition: service_healthy

  keto:
    image: oryd/keto:v26.2.0
    ports:
      - "4466:4466"
      - "4467:4467"
    environment:
      DSN: postgres://keto:secret@keto-postgres:5432/keto?sslmode=disable&max_conns=20&max_idle_conns=4
      LOG_LEVEL: info
    volumes:
      - ./config:/etc/config:ro
    command: serve -c /etc/config/keto.yml
    restart: unless-stopped
    depends_on:
      keto-migrate:
        condition: service_completed_successfully

  # ─────────────────────────────── Hydra ────────────────────────────────
  hydra-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hydra
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: hydra
    volumes:
      - hydra-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hydra -d hydra"]
      interval: 3s
      timeout: 3s
      retries: 30

  hydra-migrate:
    image: oryd/hydra:v26.2.0
    environment:
      DSN: postgres://hydra:secret@hydra-postgres:5432/hydra?sslmode=disable&max_conns=20&max_idle_conns=4
    volumes:
      - ./config:/etc/config:ro
    command: migrate sql -e --yes -c /etc/config/hydra.yml
    restart: on-failure
    depends_on:
      hydra-postgres:
        condition: service_healthy

  hydra:
    image: oryd/hydra:v26.2.0
    ports:
      - "4444:4444"
      - "4445:4445"
    environment:
      DSN: postgres://hydra:secret@hydra-postgres:5432/hydra?sslmode=disable&max_conns=20&max_idle_conns=4
      SECRETS_SYSTEM: change-me-insecure-dev-secret-0000000000000000
      LOG_LEVEL: info
    volumes:
      - ./config:/etc/config:ro
    command: serve all --dev -c /etc/config/hydra.yml
    restart: unless-stopped
    depends_on:
      hydra-migrate:
        condition: service_completed_successfully

  # ───────────────────────────── Oathkeeper ─────────────────────────────
  oathkeeper:
    image: oryd/oathkeeper:v26.2.0
    ports:
      - "4455:4455"
      - "4456:4456"
    volumes:
      - ./config:/etc/config:ro
    command: serve -c /etc/config/oathkeeper.yml
    restart: unless-stopped
    depends_on:
      kratos:
        condition: service_started

volumes:
  kratos-data:
  keto-data:
  hydra-data:
```

### `config/kratos.yml` / `config/identity.schema.json`

Kratos public URLs, self-service flows, email+password identity. Same as the minimal stack; paste from [the download URL above](https://orynestjs.tabsandspaces.co/local-dev/config/kratos.yml) or edit to match your own identity schema.

### `config/keto.yml`

```yaml title="config/keto.yml"
version: v26.2.0

log:
  level: info
  format: json
  leak_sensitive_values: false

# Starter namespaces — edit to match your relationship model.
namespaces:
  - id: 0
    name: listings
  - id: 1
    name: organizations

serve:
  read:
    host: 0.0.0.0
    port: 4466
  write:
    host: 0.0.0.0
    port: 4467
  metrics:
    host: 0.0.0.0
    port: 4468
```

### `config/hydra.yml`

```yaml title="config/hydra.yml"
serve:
  cookies:
    same_site_mode: Lax

urls:
  self:
    issuer: http://127.0.0.1:4444
  # Point these at your NestJS app's login/consent/logout routes.
  consent: http://127.0.0.1:3000/consent
  login:   http://127.0.0.1:3000/login
  logout:  http://127.0.0.1:3000/logout

# DEV SECRETS — rotate before anything resembling production.
secrets:
  system:
    - change-me-insecure-dev-secret-0000000000000000

oidc:
  subject_identifiers:
    supported_types: [pairwise, public]
    pairwise:
      salt: some-salt-change-me-for-production

oauth2:
  expose_internal_errors: true

log:
  level: info
  format: json
```

### `config/oathkeeper.yml`

Enables three authenticators (`cookie_session`, `bearer_token`, `anonymous`), the `allow` authorizer, and the `header` mutator that injects `X-User` / `X-User-Extras` into upstream requests.

```yaml title="config/oathkeeper.yml"
log:
  level: info
  format: json

serve:
  proxy:
    port: 4455
    cors:
      enabled: true
      allowed_origins: ["*"]
      # OPTIONS is NOT listed — Oathkeeper v26 rejects the config if it
       # is. Preflight for OPTIONS is handled automatically before the
       # method allowlist is consulted.
      allowed_methods: [GET, HEAD, POST, PUT, PATCH, DELETE]
      allowed_headers: [Authorization, Content-Type, Cookie]
      exposed_headers: [Content-Type]
      allow_credentials: true
  api:
    port: 4456

access_rules:
  repositories:
    - file:///etc/config/access-rules.json
  matching_strategy: glob

authenticators:
  anonymous:
    enabled: true
    config:
      subject: anonymous
  bearer_token:
    enabled: true
    config:
      check_session_url: http://kratos:4433/sessions/whoami
      preserve_path: true
      preserve_query: true
      subject_from: "identity.id"
      extra_from: "identity"
  cookie_session:
    enabled: true
    config:
      check_session_url: http://kratos:4433/sessions/whoami
      preserve_path: true
      preserve_query: true
      subject_from: "identity.id"
      extra_from: "identity"
      only:
        - ory_kratos_session
  noop:
    enabled: true

authorizers:
  allow:
    enabled: true
  deny:
    enabled: true

mutators:
  noop:
    enabled: true
  header:
    enabled: true
    config:
      headers:
        X-User: "{{ print .Subject }}"
        X-User-Extras: '{{ print .Extra | toJson }}'

errors:
  fallback:
    - json
  handlers:
    json:
      enabled: true
      config:
        verbose: true
    redirect:
      enabled: true
      config:
        to: http://127.0.0.1:3000/login
```

### `config/access-rules.json`

One starter rule that proxies every request to your NestJS app (via `host.docker.internal:3000`) after running all authenticators + the header mutator.

```json title="config/access-rules.json"
[
  {
    "id": "app:passthrough",
    "description": "Default catch-all rule. Authenticates via cookie or bearer, falls through anonymous, forwards to the NestJS app.",
    "upstream": {
      "url": "http://host.docker.internal:3000",
      "preserve_host": true
    },
    "match": {
      "url": "http://127.0.0.1:4455/<**>",
      "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    },
    "authenticators": [
      { "handler": "cookie_session" },
      { "handler": "bearer_token" },
      { "handler": "anonymous" }
    ],
    "authorizer": { "handler": "allow" },
    "mutators": [
      { "handler": "header" }
    ]
  }
]
```

## Run

```bash
docker compose up
```

Wait ~20 seconds for the three migrate containers to finish. Health-check each service:

```bash
curl -sS http://127.0.0.1:4433/health/ready   # Kratos
curl -sS http://127.0.0.1:4466/health/ready   # Keto (read)
curl -sS http://127.0.0.1:4444/health/ready   # Hydra
curl -sS http://127.0.0.1:4456/health/ready   # Oathkeeper
```

Each returns `{"status":"ok"}`.

## Point ory-nestjs at the full stack

```ts
import { IamModule } from 'ory-nestjs';

IamModule.forRoot({
  tenants: {
    default: {
      mode: 'self-hosted',
      transport: 'cookie-or-bearer',
      trustProxy: true,
      kratos: {
        publicUrl: 'http://127.0.0.1:4433',
        adminUrl: 'http://127.0.0.1:4434',
        adminToken: 'local-dev-no-auth', // Kratos --dev ignores this; the schema still requires it.
      },
      keto: {
        readUrl:  'http://127.0.0.1:4466',
        writeUrl: 'http://127.0.0.1:4467',
      },
      hydra: {
        publicUrl: 'http://127.0.0.1:4444',
        adminUrl:  'http://127.0.0.1:4445',
        adminToken: 'local-dev-no-auth',
        // Fill these in after you register an OAuth2 client via the admin API.
        clientId:     process.env.HYDRA_CLIENT_ID,
        clientSecret: process.env.HYDRA_CLIENT_SECRET,
      },
    },
  },
});
```

### Using Oathkeeper in front of your app

Switch the transport to `'oathkeeper'` and put your NestJS app behind `http://127.0.0.1:4455`:

Two modes — pick one:

```ts
// HMAC mode (shared secret — simpler, symmetric).
default: {
  mode: 'self-hosted',
  transport: 'oathkeeper',
  kratos: { publicUrl: 'http://127.0.0.1:4433' },
  oathkeeper: {
    verifier: 'hmac',
    signerKeys: ['<base64-of-your-oathkeeper-signing-key>'],
    // identityHeader + signatureHeader default to X-User / X-User-Signature.
  },
},

// JWT mode (asymmetric, recommended — no shared secret).
default: {
  mode: 'self-hosted',
  transport: 'oathkeeper',
  kratos: { publicUrl: 'http://127.0.0.1:4433' },
  oathkeeper: {
    verifier: 'jwt',
    identityHeader: 'Authorization',        // id_token mutator writes here; Bearer prefix is stripped
    jwks: { url: 'http://127.0.0.1:4456/.well-known/jwks.json' },
    audience: 'my-api',
    clockSkewMs: 30_000,
    replayProtection: { enabled: true, ttlMs: 300_000 },
  },
},
```

The sample `access-rules.json` above uses the `header` mutator (unsigned `X-User`) for HMAC mode. For asymmetric JWT mode, switch the rule's mutator to `id_token` and follow [Scenario D](./scenario-d) for the full walkthrough — it covers key generation, JWKS publication, and consumer-side verification end-to-end.

## Common tasks

- **Reset a single service's state** — e.g. `docker compose down kratos kratos-migrate && docker volume rm <project>_kratos-data && docker compose up kratos`.
- **Reset everything** — `docker compose down -v` wipes all three Postgres volumes.
- **Register an OAuth2 client with Hydra** (for `TokenService.clientCredentials`):

  ```bash
  curl -sS -X POST http://127.0.0.1:4445/admin/clients \
    -H 'Content-Type: application/json' \
    -d '{
      "client_name":   "dev-m2m",
      "grant_types":   ["client_credentials"],
      "scope":         "read:listings",
      "token_endpoint_auth_method": "client_secret_post"
    }' | jq
  ```
  Copy the returned `client_id` / `client_secret` into your NestJS env (`HYDRA_CLIENT_ID` / `HYDRA_CLIENT_SECRET`).

- **Grant a Keto relationship** (to test `@RequirePermission`):

  ```bash
  curl -sS -X PUT http://127.0.0.1:4467/admin/relation-tuples \
    -H 'Content-Type: application/json' \
    -d '{
      "namespace": "listings",
      "object":    "listings:42",
      "relation":  "owner",
      "subject_id":"user:abc-123"
    }'
  ```

- **Read captured emails** — open `http://127.0.0.1:4436`. All Kratos verification/recovery links land there.

## Troubleshooting

- **`port is already allocated`** — something on your host already owns 4433 / 4434 / 4444 / 4445 / 4455 / 4456 / 4466 / 4467 / 4436 / 4437. Either stop it or edit the compose file's port mapping.
- **Migrate containers never complete** — `docker compose logs kratos-migrate keto-migrate hydra-migrate`. Usually a DSN typo or a stale volume; `docker compose down -v && docker compose up` to reset.
- **Hydra rejects requests with `unsupported signature algorithm`** — you forgot `--dev`; the provided compose already passes it.
- **Oathkeeper 502s on all routes** — `host.docker.internal` is unreachable (Linux without Docker Desktop). Add this to the `oathkeeper` service in the compose file:

  ```yaml
      extra_hosts:
        - "host.docker.internal:host-gateway"
  ```
- **CORS errors from your NestJS app** — edit `serve.public.cors.allowed_origins` in `config/kratos.yml` and restart the `kratos` container.
