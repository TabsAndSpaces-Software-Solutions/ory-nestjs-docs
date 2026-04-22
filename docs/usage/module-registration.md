# Module Registration

### `forRoot` (sync)

Use when your config values are available at module-load time (process env, literals).

```ts
IamModule.forRoot({
  tenants: { /* … */ },
  defaultTenant: 'customer', // optional; auto-picked if only one tenant
  global: true,              // default true; see below
  auditSink: { provide: AUDIT_SINK, useClass: MyAuditSink }, // optional
  sessionCache: new InMemorySessionCache(), // optional
});
```

### `forRootAsync` (async)

Use when config comes from `@nestjs/config`, a secret manager, or any async source.

```ts
// Self-hosted example
IamModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cs: ConfigService) => ({
    tenants: {
      customer: {
        mode: 'self-hosted',
        transport: 'cookie-or-bearer',
        trustProxy: true,
        kratos: {
          publicUrl: cs.getOrThrow('KRATOS_PUBLIC_URL'),
          adminUrl: cs.get('KRATOS_ADMIN_URL'),
          adminToken: cs.get('KRATOS_ADMIN_TOKEN'),
        },
      },
    },
  }),
});

// Ory Cloud example — no kratos block needed; URLs derived from projectSlug.
IamModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cs: ConfigService) => ({
    tenants: {
      customer: {
        mode: 'cloud',
        transport: 'cookie-or-bearer',
        trustProxy: true,
        cloud: {
          projectSlug: cs.getOrThrow('ORY_PROJECT_SLUG'),
          apiKey: cs.getOrThrow('ORY_CLOUD_API_KEY'),
        },
      },
    },
  }),
});
```

Config is validated synchronously at module-init time via zod; invalid config fails boot with a descriptive `IamConfigurationError` listing every offending path. The process exits non-zero — do not catch this.

### The `global` option

`global: true` (default) registers the full guard chain — `SessionGuard`, then `RoleGuard`, then `PermissionGuard` — as `APP_GUARD`s, in that order. Every route is authenticated and authorized unless decorated with `@Public()` / `@Anonymous()`. `RoleGuard` and `PermissionGuard` are no-ops on any route that doesn't carry `@RequireRole` / `@RequirePermission`, so global registration is safe for endpoints that only need authentication.

`global: false` disables all three global bindings — routes default to *unauthenticated* and you opt **in** per route via `@UseGuards(SessionGuard, RoleGuard, PermissionGuard)` (include only what you need). Either way, the module itself is always `@Global()` in the NestJS sense so guards/services are reachable everywhere.

:::note Since 0.2.0
Before 0.2.0 only `SessionGuard` was bound to `APP_GUARD`, which silently turned `@RequireRole` / `@RequirePermission` into no-ops unless consumers manually added `@UseGuards(RoleGuard, PermissionGuard)` to every controller. As of 0.2.0 the three guards run as a chain under `APP_GUARD` and `@RequireRole` / `@RequirePermission` are enforced by default.
:::

### Tenant config shape

```ts
type TenantConfig = {
  mode: 'self-hosted' | 'cloud';
  transport: 'cookie' | 'bearer' | 'cookie-or-bearer' | 'oathkeeper';

  // Required for mode: 'self-hosted'. Optional for mode: 'cloud' —
  // the library derives Kratos URLs from cloud.projectSlug and only
  // reads this block for overrides (e.g. a project-specific
  // sessionCookieName).
  kratos?: {
    publicUrl?: string;           // required in self-hosted; derived from projectSlug in cloud
    adminUrl?: string;            // required for admin ops (identity CRUD, session revoke)
    adminToken?: string;          // required when adminUrl is set in self-hosted mode
    sessionCookieName?: string;   // default 'ory_kratos_session' — override for Ory Cloud
  };

  // Required for mode: 'cloud'. The library uses these to build the
  // Ory Cloud project URL (https://<projectSlug>.projects.oryapis.com)
  // and to authenticate admin calls.
  cloud?: { projectSlug: string; apiKey: string };

  keto?: { readUrl: string; writeUrl: string; apiKey?: string };
  hydra?: {
    publicUrl: string;
    adminUrl: string;
    adminToken?: string;
    clientId?: string;            // required for TokenService.clientCredentials
    clientSecret?: string;
  };
  oathkeeper?: {
    identityHeader?: string;                  // default 'X-User'
    signatureHeader?: string;                 // default 'X-User-Signature'

    // Verifier discriminator — 'hmac' for shared-secret envelopes (default,
    // backwards-compatible) or 'jwt' for asymmetric JWTs minted by the
    // Oathkeeper `id_token` mutator. See Scenario D.
    verifier?: 'hmac' | 'jwt';                // default 'hmac'

    // HMAC mode — symmetric keys shared with Oathkeeper's `header` mutator.
    // First match wins; non-primary matches emit a one-time WARN (rotation).
    signerKeys?: string[];                    // required when verifier === 'hmac'

    // JWT mode — one of url or keys is required when verifier === 'jwt'.
    jwks?: {
      url?: string;                           // remote JWKS; periodically refreshed
      keys?: Record<string, unknown>[];       // inline JWK array (dev/tests)
      algorithms?: string[];                  // default ['RS256', 'ES256']; HS*/none rejected
      refreshIntervalMs?: number;             // default 600_000
      cooldownMs?: number;                    // default 30_000 (refresh-on-miss gate)
    };

    // Shared across verifier modes.
    audience?: string | string[];             // if set, envelope/JWT must declare it
    clockSkewMs?: number;                     // default 30_000; leeway on expiry check
    replayProtection?: {
      enabled?: boolean;                      // requires a jti claim + ReplayCache
      ttlMs?: number;                         // default 600_000
    };
  };
  logging?: { level: 'error' | 'warn' | 'info' | 'debug' };
  cache?: { sessionTtlMs: number; permissionTtlMs: number; jwksTtlMs: number };
  trustProxy?: boolean;           // required true in production with cookie transport

  // Per-tenant outbound rate limiter (token bucket). Omit to disable.
  rateLimit?: {
    rps: number;                  // sustained tokens/second; default 100
    burst: number;                // bucket capacity; default 150
    queueTimeoutMs?: number;      // wait at most N ms before 503; default 5_000
    maxQueueSize?: number;        // waiters before immediate 503; default 100
  };

  // Per-host circuit breaker on outbound calls. Omit to disable.
  circuitBreaker?: {
    failureThreshold: number;     // consecutive 5xx/network errors; default 5
    windowMs: number;             // sliding window for failure counting; default 30_000
    openMs: number;               // OPEN duration before HALF_OPEN probe; default 10_000
  };
};
```

### Examples by mode

#### Cloud

```ts
{
  mode: 'cloud',
  transport: 'cookie-or-bearer',
  cloud: {
    projectSlug: 'nifty-blackwell-thv46tbvh5',
    apiKey: process.env.ORY_CLOUD_API_KEY!,
  },
  trustProxy: true,
  // Optional override: Ory Cloud names the session cookie with a
  // project-specific random slug, not the projectSlug used above.
  // Look it up in Ory Console → Project Settings → Sessions.
  kratos: { sessionCookieName: 'ory_session_abcdef01234' },
}
```

The library builds the Ory Cloud API URL (`https://<projectSlug>.projects.oryapis.com`) automatically and uses `cloud.apiKey` for every admin-scoped call — you do not need to populate `kratos.publicUrl`, `kratos.adminUrl`, or `kratos.adminToken` yourself.

#### Self-hosted

```ts
{
  mode: 'self-hosted',
  transport: 'cookie-or-bearer',
  kratos: {
    publicUrl: 'https://kratos.example.com',
    adminUrl: 'https://kratos-admin.internal',
    adminToken: process.env.KRATOS_ADMIN_TOKEN!,
  },
  // Optional Keto / Hydra for permissions + OAuth2:
  keto: {
    readUrl: 'https://keto-read.internal',
    writeUrl: 'https://keto-write.internal',
  },
  hydra: {
    publicUrl: 'https://hydra.example.com',
    adminUrl: 'https://hydra-admin.internal',
    adminToken: process.env.HYDRA_ADMIN_TOKEN!,
    clientId: process.env.HYDRA_CLIENT_ID,
    clientSecret: process.env.HYDRA_CLIENT_SECRET,
  },
  trustProxy: true,
}
```

`kratos.publicUrl` is required; everything else scales with the features you use (`adminUrl`/`adminToken` for admin APIs, `keto` for permission checks, `hydra` for OAuth2 / machine-to-machine tokens).

:::note Since 0.2.1
In 0.2.0 the `kratos` block was required for every tenant regardless of mode, which broke `mode: 'cloud'` at both the TypeScript (`Property 'kratos' is missing in type`) and runtime (*"kratos is required"*) layers. 0.2.1 made `kratos` optional for cloud tenants and derives URLs + admin credentials from `cloud.projectSlug` + `cloud.apiKey`. Self-hosted still requires `kratos.publicUrl`.
:::

### Rate limit + circuit breaker (Since 0.5.0)

Every tenant can opt into two outbound-axios interceptors:

- **Rate limiter** — a per-tenant token-bucket. Requests block in a small FIFO queue when the bucket is empty; exceeding `queueTimeoutMs` or `maxQueueSize` raises `IamUpstreamUnavailableError` with a computed `retryAfter`.
- **Circuit breaker** — one state machine per upstream host. N consecutive 5xx or network errors inside `windowMs` flip the circuit OPEN for `openMs`; a single HALF_OPEN probe then either closes it (success) or reopens it (failure). 4xx responses (401/403/404/429) do **not** count toward tripping — they reflect the caller, not upstream health.

```ts
IamModule.forRoot({
  tenants: {
    default: {
      // … standard fields …
      rateLimit: { rps: 200, burst: 400 },
      circuitBreaker: {
        failureThreshold: 10,
        windowMs: 60_000,
        openMs: 15_000,
      },
    },
  },
});
```

Both are **off by default** — omitting the block disables the interceptor entirely. When the library trips either guard it throws `IamUpstreamUnavailableError`, which the HTTP boundary maps to a 503 with a dynamic `Retry-After` (see [Error model](./error-model#retryafter-on-503)).

:::warning Multi-pod caveat
The rate limiter is in-process. If you run N pods, the effective global limit is N × rps. Divide your target Ory admin quota across pods in the `rps` setting. For a shared bucket you'd need a Redis-backed backend — not shipped with the library yet.
:::

:::note Since 0.4.0 — `TenantConfig` vs `ValidatedTenantConfig`
Before 0.4.0, the exported `TenantConfig` type was the post-validation output shape, which forced every consumer factory to redundantly supply defaulted fields:

```ts
// 0.3.x — TS2741: Property 'sessionCookieName' is missing in type …
function buildTenant(): TenantConfig {
  return {
    mode: 'self-hosted',
    transport: 'cookie-or-bearer',
    kratos: { publicUrl: process.env.KRATOS_URL! }, // ← sessionCookieName error
  };
}
```

In 0.4.0 the types are split:

- `TenantConfig` — **input** shape (what you write at the call site; defaulted fields are optional). Use this on factory/helper return types.
- `ValidatedTenantConfig` — **output** shape, with every default applied. This is what `ConfigLoader.load()` returns and what the library reads internally. Consumers rarely need it; reach for it only when you're writing code that relies on defaults being present.

If you kept a `TenantConfig`-typed variable to read a defaulted field, switch it to `ValidatedTenantConfig`.
:::
