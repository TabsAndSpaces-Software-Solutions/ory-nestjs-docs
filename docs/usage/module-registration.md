# Module Registration

### `forRoot` (sync)

Use when your config values are available at module-load time (process env, literals).

```ts
UkkiIamModule.forRoot({
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
UkkiIamModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cs: ConfigService) => ({
    tenants: {
      customer: {
        mode: cs.get('IAM_MODE') as 'self-hosted' | 'cloud',
        transport: 'cookie-or-bearer',
        kratos: {
          publicUrl: cs.get('KRATOS_PUBLIC_URL'),
          adminUrl: cs.get('KRATOS_ADMIN_URL'),
          adminToken: cs.get('KRATOS_ADMIN_TOKEN'),
        },
      },
    },
  }),
});
```

Config is validated synchronously at module-init time via zod; invalid config fails boot with a descriptive `IamConfigurationError` listing every offending path. The process exits non-zero — do not catch this.

### The `global` option

`global: true` (default) registers `SessionGuard` as `APP_GUARD`: every route is authenticated unless decorated with `@Public()`. `global: false` disables the global guard — routes default to *unauthenticated* and you opt **in** per route via `@UseGuards(SessionGuard)`. Either way, the module itself is always `@Global()` in the NestJS sense so guards/services are reachable everywhere.

### Tenant config shape

```ts
type TenantConfig = {
  mode: 'self-hosted' | 'cloud';
  transport: 'cookie' | 'bearer' | 'cookie-or-bearer' | 'oathkeeper';
  kratos: {
    publicUrl: string;            // required
    adminUrl?: string;            // required for admin ops (identity CRUD, session revoke)
    adminToken?: string;          // required when adminUrl is set in self-hosted mode
    sessionCookieName?: string;   // default 'ory_kratos_session'
  };
  keto?: { readUrl: string; writeUrl: string; apiKey?: string };
  hydra?: {
    publicUrl: string;
    adminUrl: string;
    adminToken?: string;
    clientId?: string;            // required for TokenService.clientCredentials
    clientSecret?: string;
  };
  cloud?: { projectSlug: string; apiKey: string };  // required when mode='cloud'
  oathkeeper?: {
    identityHeader?: string;      // default 'X-User'
    signatureHeader?: string;     // default 'X-User-Signature'
    signerKeys: string[];         // non-empty; allowlist supports rotation
  };
  logging?: { level: 'error' | 'warn' | 'info' | 'debug' };
  cache?: { sessionTtlMs: number; permissionTtlMs: number; jwksTtlMs: number };
  trustProxy?: boolean;           // required true in production with cookie transport
};
```
