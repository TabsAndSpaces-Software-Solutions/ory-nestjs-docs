---
sidebar_position: 15
---

# Scenario D — Zero-trust microservices with Oathkeeper

End-to-end walkthrough: from `nest new` to a running three-service system where every downstream request is cryptographically verified via a signed JWT from Oathkeeper. No shared secrets. No network calls back to Kratos on the hot path. Signing-key rotation, audience scoping, envelope expiry, and anti-replay — all from config.

Everything here ships in `ory-nestjs@0.4.0+`. If you're on 0.2.x, the HMAC-based Oathkeeper mode is still there and behaves the same; the `verifier: 'jwt'` upgrade path is additive.

:::note 0.4.0 fixes relevant to this scenario
- `Authorization: Bearer <jwt>` is now accepted unchanged — the transport strips the `Bearer ` prefix for `verifier: 'jwt'`. Before 0.4.0 every request 401'd with `auth.failure.invalid_signature`.
- `@RequirePermission(...)` routes correctly read `.data.allowed` off Keto's Axios response (instead of the incorrect `.allowed` on the raw response). Pre-0.4.0 every permission check 403'd even when Keto answered `allowed: true`.
- `TenantConfig` is now the input shape (fields with defaults are optional). Consumers who factor tenants into a shared helper no longer have to declare `sessionCookieName` and friends explicitly. For the post-validation shape use the new `ValidatedTenantConfig` export.
- Ory image tags: `oryd/kratos:v1.3.1` → `oryd/kratos:v26.2.0` (same for keto/hydra/oathkeeper). Docker Hub no longer hosts the old tags.
- Oathkeeper v26 rejects `OPTIONS` in `serve.proxy.cors.allowed_methods`; the provided `config/oathkeeper.yml` lists `GET, HEAD, POST, PUT, PATCH, DELETE`.
- Oathkeeper v26 does not auto-populate `jti`; the `id_token` claims template below explicitly declares `"jti": "{{ uuidv4 }}"` so the replay cache works.
:::

## What we're building

```
           ┌───────────────────────────────────────────────────┐
           │              Browser / mobile / curl               │
           └────────────────────────┬──────────────────────────┘
                                    │
                          http://localhost:4455
                                    │
                   ┌────────────────▼────────────────┐
                   │           Oathkeeper             │
                   │  - reads session cookie / bearer │
                   │  - verifies with Kratos          │
                   │  - signs id_token (JWT)          │
                   │  - publishes JWKS at /jwks.json  │
                   └───┬────────────┬─────────────────┘
                       │            │              │
           /auth/…     /orders/…   /inventory/…
                       │            │              │
          ┌────────────▼─┐   ┌──────▼──────┐   ┌──▼─────────────┐
          │   auth-bff   │   │ orders-api  │   │ inventory-api  │
          │   :3000      │   │ :3001       │   │ :3002          │
          │              │   │             │   │                │
          │ Kratos cookie│   │ Oathkeeper  │   │ Oathkeeper JWT │
          │ flows        │   │ JWT verify  │   │ + Keto permiss.│
          │ (public)     │   │ (zero-trust)│   │  + roles       │
          └──────────────┘   └─────────────┘   └────────────────┘
```

**Trust boundary**: `orders-api` and `inventory-api` never talk to Kratos. They trust a JWT signed by Oathkeeper's private key, which they verify against a JWKS fetched from Oathkeeper's management API. If the JWT is forged, expired, scoped for another service, or replayed — the request is 401'd before it touches your code.

## Prerequisites

- Node 20+, Docker + Docker Compose v2, `pnpm` (or npm/yarn).
- The local Ory stack from [Local Development Stack](./local-dev-stack). Keep it running in a separate terminal — you'll need Kratos, Oathkeeper, MailSlurper, and (for Scenario D) Keto.

## 1. Generate Oathkeeper's JWKS (id_token signing key)

Oathkeeper needs an RSA/EC keypair to sign id_tokens. Generate it once; Oathkeeper uses the private half to sign and publishes the public half for consumers.

```bash
# In the directory that holds your docker-compose.yml + config/
docker run --rm -v "$PWD/config:/config" oryd/oathkeeper:v26.2.0 \
  credentials generate --alg RS256 > config/oathkeeper-jwks.json
```

You now have `config/oathkeeper-jwks.json` with one RS256 key pair. **Never commit this file** — add it to `.gitignore`. Treat it like a database password.

## 2. Point Oathkeeper at the JWKS + enable the id_token mutator

Edit `config/oathkeeper.yml` — add `id_token` to the `mutators` block and raise it in the access rules so every downstream service receives a signed JWT:

```yaml title="config/oathkeeper.yml"
mutators:
  noop:
    enabled: true
  header:
    enabled: true
    config:
      headers:
        X-User: "{{ print .Subject }}"
  # NEW — zero-trust: id_token signs a JWT per request.
  id_token:
    enabled: true
    config:
      issuer_url: http://oathkeeper:4455/
      jwks_url: file:///etc/config/oathkeeper-jwks.json
      ttl: 60s
      claims: |
        {
          "tenant": "default",
          "aud": ["orders-api", "inventory-api"],
          "sub": "{{ print .Subject }}",
          "jti": "{{ uuidv4 }}",
          "metadataPublic": {{ print .Extra.metadata_public | toJson }}
        }
```

- `aud` — the services allowed to accept this token. Each NestJS service below will assert its own entry in this list.
- `ttl: 60s` — envelope expiry. `ory-nestjs`'s `clockSkewMs` (default 30 s) handles modest clock drift.
- `jti: "{{ uuidv4 }}"` — **required for the replay cache to work**. Oathkeeper v26 does NOT auto-populate `jti`; consumers who copy the template without this line will see every request after the first 401 with `auth.failure.replay`. The `uuidv4` template function is built into Oathkeeper's claims evaluator.

Then update `config/access-rules.json` to wire three routes — one public, two zero-trust:

```json title="config/access-rules.json"
[
  {
    "id": "auth-bff:public",
    "description": "Public auth routes — login, registration, recovery.",
    "upstream": { "url": "http://host.docker.internal:3000" },
    "match": {
      "url": "http://127.0.0.1:4455/auth/<**>",
      "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    },
    "authenticators": [{ "handler": "anonymous" }],
    "authorizer": { "handler": "allow" },
    "mutators": [{ "handler": "noop" }]
  },
  {
    "id": "orders-api:zero-trust",
    "description": "Zero-trust route — Kratos session required, JWT minted.",
    "upstream": { "url": "http://host.docker.internal:3001" },
    "match": {
      "url": "http://127.0.0.1:4455/orders/<**>",
      "methods": ["GET", "POST", "PUT", "DELETE"]
    },
    "authenticators": [
      { "handler": "cookie_session" },
      { "handler": "bearer_token" }
    ],
    "authorizer": { "handler": "allow" },
    "mutators": [{ "handler": "id_token" }]
  },
  {
    "id": "inventory-api:zero-trust",
    "description": "Zero-trust route — role-gated via the signed JWT's claims.",
    "upstream": { "url": "http://host.docker.internal:3002" },
    "match": {
      "url": "http://127.0.0.1:4455/inventory/<**>",
      "methods": ["GET", "POST", "PUT", "DELETE"]
    },
    "authenticators": [
      { "handler": "cookie_session" },
      { "handler": "bearer_token" }
    ],
    "authorizer": { "handler": "allow" },
    "mutators": [{ "handler": "id_token" }]
  }
]
```

Restart Oathkeeper:

```bash
docker compose restart oathkeeper
```

Sanity-check the JWKS endpoint:

```bash
curl -sS http://127.0.0.1:4456/.well-known/jwks.json | jq
```

You should see one key with `kty: RSA`, `use: sig`, `alg: RS256`. This is the URL every downstream service will fetch.

## 3. Scaffold three NestJS services

Pick any parent directory — the three services are independent apps.

```bash
npm i -g @nestjs/cli
nest new auth-bff      --package-manager pnpm --skip-git
nest new orders-api    --package-manager pnpm --skip-git
nest new inventory-api --package-manager pnpm --skip-git
```

Install `ory-nestjs` + peers in each:

```bash
for svc in auth-bff orders-api inventory-api; do
  (cd "$svc" && pnpm add ory-nestjs reflect-metadata rxjs)
done
```

(NestJS 10+/11+ ships `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs` already — the `pnpm add` above is a no-op for those. `ory-nestjs` is the only new dep.)

## 4. `auth-bff` — the Kratos-facing service (cookie transport)

`auth-bff` sits behind Oathkeeper's *anonymous* rule and proxies Kratos self-service flows for browsers. No JWT here — users hit it anonymously to register and log in.

`auth-bff/src/main.ts` — bind to 3000 so Oathkeeper can reach it:

```ts title="auth-bff/src/main.ts"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:4455', credentials: true });
  await app.listen(3000);
}
bootstrap();
```

`auth-bff/src/app.module.ts` — `global: false` because this service should default to open (users aren't logged in yet):

```ts title="auth-bff/src/app.module.ts"
import { Module } from '@nestjs/common';
import { IamModule } from 'ory-nestjs';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    IamModule.forRoot({
      global: false,                             // routes default to public
      tenants: {
        default: {
          mode: 'self-hosted',
          transport: 'cookie-or-bearer',
          trustProxy: true,
          kratos: {
            publicUrl: 'http://127.0.0.1:4433',  // Kratos public API
            adminUrl: 'http://127.0.0.1:4434',
            adminToken: 'local-dev-no-auth',
          },
        },
      },
    }),
  ],
  controllers: [AuthController],
})
export class AppModule {}
```

`auth-bff/src/auth.controller.ts`:

```ts title="auth-bff/src/auth.controller.ts"
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FlowService, Public } from 'ory-nestjs';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly flows: FlowService) {}

  @Get('login')
  initiateLogin(@Query('returnTo') returnTo?: string) {
    return this.flows.forTenant('default').initiateLogin({ returnTo });
  }

  @Post('login/:flowId')
  submitLogin(@Param('flowId') id: string, @Body() body: unknown) {
    return this.flows.forTenant('default').submitLogin(id, body);
  }

  @Get('registration')
  initiateRegistration() {
    return this.flows.forTenant('default').initiateRegistration();
  }

  @Post('registration/:flowId')
  submitRegistration(@Param('flowId') id: string, @Body() body: unknown) {
    return this.flows.forTenant('default').submitRegistration(id, body);
  }
}
```

Run it:

```bash
cd auth-bff && pnpm run start:dev
```

## 5. `orders-api` — zero-trust JWT consumer

This service **never** talks to Kratos. It trusts only the JWT minted by Oathkeeper. If you curl `orders-api` directly (bypassing Oathkeeper), every request 401s.

`orders-api/src/main.ts` — bind to 3001:

```ts title="orders-api/src/main.ts"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
}
bootstrap();
```

`orders-api/src/app.module.ts` — **this is the whole zero-trust config**:

```ts title="orders-api/src/app.module.ts"
import { Module } from '@nestjs/common';
import { IamModule } from 'ory-nestjs';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    IamModule.forRoot({
      tenants: {
        default: {
          mode: 'self-hosted',
          transport: 'oathkeeper',
          // Kratos still needs a publicUrl so the internal TenantClients
          // bundle builds — but this service never reaches out to it on
          // the request path.
          kratos: { publicUrl: 'http://127.0.0.1:4433' },
          oathkeeper: {
            verifier: 'jwt',                     // asymmetric JWT mode
            jwks: {
              url: 'http://127.0.0.1:4456/.well-known/jwks.json',
              algorithms: ['RS256'],
              refreshIntervalMs: 600_000,        // refetch every 10 min
              cooldownMs: 30_000,                // refetch-on-failure cooldown
            },
            audience: 'orders-api',              // must match the id_token claim
            clockSkewMs: 30_000,                 // expiry leeway
            replayProtection: {
              enabled: true,                     // use jti + replay cache
              ttlMs: 120_000,                    // remember each jti 2 min
            },
            // identityHeader defaults to 'X-User'; match Oathkeeper's output.
            identityHeader: 'Authorization',     // id_token mutator writes here
            signatureHeader: 'X-User-Signature', // unused in verifier=jwt
          },
        },
      },
    }),
  ],
  controllers: [OrdersController],
})
export class AppModule {}
```

:::tip `identityHeader: 'Authorization'`
Oathkeeper's `id_token` mutator writes the JWT into the `Authorization: Bearer <jwt>` header by default. Setting `identityHeader: 'Authorization'` tells the library's transport where to read it. The library will strip a `Bearer ` prefix automatically.
:::

`orders-api/src/orders.controller.ts`:

```ts title="orders-api/src/orders.controller.ts"
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { CurrentUser, IamIdentity, RequirePermission } from 'ory-nestjs';

@Controller('orders')
export class OrdersController {
  @Get()
  list(@CurrentUser() user: IamIdentity) {
    return { user: user.id, orders: [{ id: 'o-1' }, { id: 'o-2' }] };
  }

  @Get(':id')
  @RequirePermission({
    namespace: 'orders',
    relation: 'view',
    object: (req) => `orders:${req.params.id}`,
  })
  get(@Param('id') id: string, @CurrentUser() user: IamIdentity) {
    return { id, owner: user.id };
  }

  @Post()
  create(@Body() body: { sku: string }, @CurrentUser() user: IamIdentity) {
    return { id: 'o-new', createdBy: user.id, ...body };
  }
}
```

Run it:

```bash
cd orders-api && pnpm run start:dev
```

## 6. `inventory-api` — zero-trust + RBAC + Keto

Same transport config as `orders-api`, only the audience + controller differ. This service demonstrates role checks (`@RequireRole`) on a JWT claim and permission checks (`@RequirePermission`) against Keto.

`inventory-api/src/main.ts`:

```ts title="inventory-api/src/main.ts"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3002);
}
bootstrap();
```

`inventory-api/src/app.module.ts`:

```ts title="inventory-api/src/app.module.ts"
import { Module } from '@nestjs/common';
import { IamModule } from 'ory-nestjs';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    IamModule.forRoot({
      tenants: {
        default: {
          mode: 'self-hosted',
          transport: 'oathkeeper',
          kratos: { publicUrl: 'http://127.0.0.1:4433' },
          keto: {
            readUrl: 'http://127.0.0.1:4466',
            writeUrl: 'http://127.0.0.1:4467',
          },
          oathkeeper: {
            verifier: 'jwt',
            jwks: {
              url: 'http://127.0.0.1:4456/.well-known/jwks.json',
              algorithms: ['RS256'],
              refreshIntervalMs: 600_000,
              cooldownMs: 30_000,
            },
            audience: 'inventory-api',
            clockSkewMs: 30_000,
            replayProtection: { enabled: true, ttlMs: 120_000 },
            identityHeader: 'Authorization',
            signatureHeader: 'X-User-Signature',
          },
        },
      },
    }),
  ],
  controllers: [InventoryController],
})
export class AppModule {}
```

`inventory-api/src/inventory.controller.ts`:

```ts title="inventory-api/src/inventory.controller.ts"
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import {
  CurrentUser,
  IamIdentity,
  Public,
  RequirePermission,
  RequireRole,
} from 'ory-nestjs';

@Controller('inventory')
export class InventoryController {
  // Health is open for k8s/ELB probes.
  @Get('health')
  @Public()
  health() {
    return { status: 'ok' };
  }

  // Any authenticated user can read — no extra decorator needed;
  // SessionGuard is global and satisfied by the Oathkeeper JWT.
  @Get()
  list() {
    return [{ sku: 'sku-1', qty: 12 }];
  }

  // Only warehouse admins can adjust stock (role claim on the JWT).
  @Post('adjust')
  @RequireRole('warehouse:admin')
  adjust(@Body() body: { sku: string; delta: number }) {
    return { ok: true, ...body };
  }

  // Permission-scoped: can THIS user view THIS sku's ledger? Keto call.
  @Get(':sku/ledger')
  @RequirePermission({
    namespace: 'listings',
    relation: 'view',
    object: (req) => `inventory:${req.params.sku}`,
  })
  ledger(@Param('sku') sku: string, @CurrentUser() user: IamIdentity) {
    return { sku, viewer: user.id };
  }
}
```

Run it:

```bash
cd inventory-api && pnpm run start:dev
```

## 7. End-to-end smoke test

With all three services running and the Ory stack up, walk the full zero-trust path via the Oathkeeper proxy on port 4455.

### Register a user (goes through `auth-bff` via Oathkeeper)

```bash
# 1. Start a registration flow (non-browser / native).
curl -sS "http://127.0.0.1:4455/auth/registration" | jq '.id,.ui.action' -r
# copy the flow id from the first line, save the URL from the second.
```

```bash
# 2. Submit the flow with email + password.
FLOW_ID='<paste-flow-id>'
curl -sS -X POST "http://127.0.0.1:4455/auth/registration/$FLOW_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "method": "password",
    "password": "Corr3ctHorseBatteryStaple!",
    "traits": { "email": "alice@example.com" }
  }' | jq
```

Kratos returns a session token. Save it: `export SESSION="$(... | jq -r .session_token)"`.

### Hit `orders-api` through Oathkeeper (zero-trust path)

```bash
# Authenticated request → Oathkeeper mints a JWT → orders-api verifies.
curl -sS "http://127.0.0.1:4455/orders" -H "Authorization: Bearer $SESSION" | jq
# { "user": "<alice's identity id>", "orders": [...] }
```

### Confirm direct access to `orders-api` fails

This is the zero-trust check — bypassing Oathkeeper MUST 401.

```bash
curl -sS -i "http://127.0.0.1:3001/orders" -H "Authorization: Bearer $SESSION" | head -3
# HTTP/1.1 401 Unauthorized
```

`orders-api` has no way to verify `$SESSION` directly — it only accepts JWTs signed by Oathkeeper.

### Confirm audience scoping

If Oathkeeper mints a JWT with `aud: ['orders-api', 'inventory-api']`, both services accept it (when routed through their respective rules). If you try to use an `orders-api` JWT elsewhere, or trim the audience list in config, the other service 401s with `audience_mismatch`.

### Confirm replay protection

Capture a JWT and replay it manually:

```bash
# Fetch once through Oathkeeper and capture the forwarded Authorization header.
CAPTURED=$(curl -sS -D - "http://127.0.0.1:4455/orders" \
  -H "Authorization: Bearer $SESSION" 2>&1 | grep -i '^authorization:' || echo '')

# (If Oathkeeper doesn't forward the header — which is the default for id_token —
# capture it from tcpdump / a sniffer on the link. In a real attacker model,
# assume they can capture it in transit.)

# Replay with the SAME jti: the second request is refused.
curl -sS "http://127.0.0.1:3001/orders" -H "$CAPTURED"  # ok
curl -sS -i "http://127.0.0.1:3001/orders" -H "$CAPTURED" | head -3
# HTTP/1.1 401 Unauthorized
```

The transport stored the JWT's `jti` in the in-memory `ReplayCache`. Subsequent calls with the same `jti` (within 120 s) are rejected with `auth.failure.replay` and a 401.

:::note Multi-pod deployments
The in-memory replay cache is **process-local**. If your NestJS service runs as more than one pod, an attacker can replay once per pod. Override the `REPLAY_CACHE` DI token with a Redis-backed implementation:

```ts
import { REPLAY_CACHE, type ReplayCache } from 'ory-nestjs';

@Injectable()
class RedisReplayCache implements ReplayCache {
  constructor(private readonly redis: Redis) {}
  async seen(jti: string) { return (await this.redis.get(`jti:${jti}`)) !== null; }
  async remember(jti: string, ttlMs: number) {
    await this.redis.set(`jti:${jti}`, '1', 'PX', ttlMs, 'NX');
  }
}

@Module({
  imports: [IamModule.forRoot({ /* … */ })],
  providers: [{ provide: REPLAY_CACHE, useClass: RedisReplayCache }],
})
export class AppModule {}
```
:::

## 8. What you've got

Every request to `orders-api` and `inventory-api` now satisfies:

| Check | Who enforces it | What happens on failure |
|---|---|---|
| **Valid RS256 signature** | `jose` in `ory-nestjs` | 401 `auth.failure.invalid_signature` |
| **Not expired (`exp` + 30 s skew)** | `ory-nestjs` transport | 401 `auth.failure.expired` |
| **Audience matches this service** | `ory-nestjs` transport | 401 `auth.failure.audience_mismatch` |
| **`jti` not previously seen (120 s)** | `ReplayCache` | 401 `auth.failure.replay` |
| **Tenant claim matches this request's tenant** | `SessionGuard` | 401 `auth.tenant_mismatch` |
| **Public/Public+Anonymous routes bypass all of it** | `SessionGuard` | n/a — short-circuit `return true` |
| **`@RequireRole(...)` / `@RequirePermission(...)`** | `RoleGuard` / `PermissionGuard` | 403 `authz.role.deny` / `authz.permission.deny` |

No Kratos round-trip on the hot path. No shared secret between Oathkeeper and your services. Key rotation = publish a new JWK at Oathkeeper's JWKS URL; `ory-nestjs` refreshes on cache miss or periodically.

## 9. Rotating the signing key

1. Add a second key to `config/oathkeeper-jwks.json`:

   ```bash
   docker run --rm oryd/oathkeeper:v26.2.0 credentials generate --alg RS256 \
     | jq '.keys[0]' > /tmp/new-key.json
   # Merge into the existing JWKS keys[] array, keeping the old key for now.
   jq '.keys += [input]' config/oathkeeper-jwks.json /tmp/new-key.json \
     > config/oathkeeper-jwks.new.json && \
     mv config/oathkeeper-jwks.new.json config/oathkeeper-jwks.json
   ```

2. Update `config/oathkeeper.yml` to reference the new key's `kid` as the signer (first entry by default).
3. Restart Oathkeeper. It picks up the new JWKS; consumers pull the new JWK on their next refresh (≤ 10 min) or immediately on a cooldown-gated miss.
4. Drain in-flight tokens (≤ 60 s at `ttl: 60s`).
5. Remove the old key from JWKS, restart again.

No consumer restart, no config change on `orders-api` or `inventory-api`.

## 10. What to read next

- [Authentication](./authentication) — the full decorator + guard surface.
- [Self-service flows](./self-service-flows) — browser vs native flows for `auth-bff`.
- [Audit & observability](./audit-observability) — wiring the 19 `auth.*` / `authz.*` events into your logging / SIEM.
- [Error model](./error-model) — how `IamUnauthorizedError` / `IamForbiddenError` become the Nest exceptions your clients receive.
- [Testing](./testing) — spinning up `IamTestingModule` so you can unit-test controllers without booting Oathkeeper.
