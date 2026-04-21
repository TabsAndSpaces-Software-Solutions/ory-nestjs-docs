# Services API

All services expose a `.forTenant(name)` method to return a tenant-scoped instance.

### `IdentityService`
Manage identities (users).
- `get(id)`: Get identity (sanitized).
- `list()`: List identities.
- `create(traits)`: Create identity.
- `updateTraits(id, traits)`: Update identity traits.
- `delete(id)`: Delete identity.

### `SessionService`
Manage sessions.
- `whoami(req)`: Get current session/identity.
- `revoke(sessionId)`: Revoke a specific session.

### `PermissionService`
Manage Keto relationships.
- `check(query)`: Check a permission.
- `grant(tuple)`: Grant a permission.
- `revoke(tuple)`: Revoke a permission.

### `TokenService`
OAuth2 operations (Hydra).
- `clientCredentials(scopes)`: Get M2M token.
- `introspect(token)`: Introspect a token.

### `FlowService`
Self-service flows (Kratos). Every `initiate*` accepts an optional `{ kind?: 'browser' \| 'native', returnTo?: string, ... }` — see [Self-service flows](./self-service-flows) for when to pick `'native'`.
- `initiateLogin(opts?)` / `submitLogin()`
- `initiateRegistration(opts?)` / `submitRegistration()`
- `initiateSettings(opts?)` / `submitSettings()`
- `initiateRecovery(opts?)` / `submitRecovery()`
- `initiateVerification(opts?)` / `submitVerification()`
