# Authentication

### Guards

| Guard | Use when | Principal attached |
|---|---|---|
| `SessionGuard` | Default; cookie-based or bearer-token Kratos sessions | `IamIdentity` |
| `OptionalSessionGuard` | Route has both auth'd and anonymous modes | `IamIdentity \| null` |
| `OAuth2Guard` | Machine-to-machine calls with Hydra-issued tokens | `IamMachinePrincipal` |
| `PermissionGuard` | Enforces `@RequirePermission` via Keto | — (runs after `SessionGuard`) |
| `RoleGuard` | Enforces `@RequireRole` against identity traits | — (runs after `SessionGuard`) |

### Decorators

```ts
@Public()                      // skip SessionGuard entirely
@Anonymous()                   // method-level override; same effect as @Public but tighter scope
@Tenant('customer')            // scope this route (or controller) to a named tenant
@RequireRole('admin')          // at least one role must match (OR semantics)
@RequireRole('admin', 'staff') // still OR — user with either role passes
@RequirePermission({           // Keto check
  namespace: 'listings',
  relation: 'edit',
  object: (req) => `listings:${req.params.id}`,
})
@CurrentUser()                 // param decorator: inject the authenticated principal
```

### Transport selection

- **`cookie`** — browser apps. Kratos session cookie (default `ory_kratos_session`).
- **`bearer`** — mobile/native. `Authorization: Bearer <kratos-session-token>`.
- **`cookie-or-bearer`** — accepts either; tries cookie first. The common default for a BFF that serves both web and mobile.
- **`oathkeeper`** — zero-trust. You run Oathkeeper in front of your service; it authenticates upstream (Kratos) and forwards a cryptographically verifiable envelope. `SessionGuard` never calls Kratos on the hot path — it verifies the envelope locally and short-circuits.

### Zero-trust (Oathkeeper) modes

`transport: 'oathkeeper'` supports two verifier modes and four independent protections (all configurable under `tenant.oathkeeper`):

| Option | Meaning | Default |
|---|---|---|
| `verifier: 'hmac'` | Symmetric HMAC-SHA256 over a plain-JSON envelope. Shared secret between Oathkeeper's `header` mutator and your app. | ✅ (backwards-compatible) |
| `verifier: 'jwt'` | Asymmetric JWT (Oathkeeper `id_token` mutator). Public JWKS, private key never leaves Oathkeeper. | opt-in |
| `jwks: { url }` / `jwks: { keys }` | Remote JWKS endpoint (periodically refreshed, cooldown-gated refresh-on-miss) or inline JWK array. Required when `verifier === 'jwt'`. | — |
| `audience: string \| string[]` | Envelope MUST declare one of these audiences in `audience` (HMAC) or `aud` (JWT). Prevents cross-service replay when services share a signer. | unset (off) |
| `clockSkewMs` | Leeway applied to `expiresAt` / `exp` checks. | `30_000` |
| `replayProtection: { enabled, ttlMs }` | Reject a `jti` that has already been seen within `ttlMs`. Requires a `ReplayCache` binding (in-memory default, Redis-pluggable). | disabled |
| `signerKeys: string[]` | HMAC shared-secret allowlist (first-match wins; rotation fall-through emits a one-time WARN). Required when `verifier === 'hmac'`. | — |

End-to-end walkthrough: [Scenario D — Zero-trust microservices with Oathkeeper](./scenario-d).
