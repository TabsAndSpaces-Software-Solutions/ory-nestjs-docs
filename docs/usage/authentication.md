# Authentication

### Guards

| Guard | Use when | Principal attached |
|---|---|---|
| `SessionGuard` | Default; cookie-based or bearer-token Kratos sessions | `UkkiIdentity` |
| `OptionalSessionGuard` | Route has both auth'd and anonymous modes | `UkkiIdentity \| null` |
| `OAuth2Guard` | Machine-to-machine calls with Hydra-issued tokens | `UkkiMachinePrincipal` |
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
- **`oathkeeper`** — you run Oathkeeper in front of your service. It verifies sessions and forwards a signed identity envelope. `SessionGuard` never calls Kratos on the hot path; it only verifies the envelope signature against the configured allowlist.
