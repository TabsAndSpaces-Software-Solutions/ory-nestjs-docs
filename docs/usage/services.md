# Services API

All services expose a `.forTenant(name)` method to return a tenant-scoped instance. Every method maps 1:1 to an Ory endpoint, with library-owned DTOs on the wire.

## Kratos

### `IdentityService`
Admin CRUD over identities and their sessions.

- `get(id)` — sanitized identity (no traits).
- `getWithTraits(id)` — identity with traits attached.
- `list({ page?, perPage? })` — paginated listing.
- `create({ schemaId, traits, verifiedAddresses? })` — provision an identity.
- `updateTraits(id, traits)` — full-replace traits.
- `patch(id, ops)` — RFC 6902 JSON-Patch. Target `/traits/*`, `/metadata_public/*`, `/metadata_admin/*`, `/state`.
- `delete(id)` — hard-delete.
- `listSessions(id)` — every active session for an identity.
- `revokeSession(sessionId)` — disable one session (audited).
- `extendSession(sessionId)` — push `expires_at` forward server-side.

### `SessionService`
Request-level session introspection + revocation.

- `whoami(req)` — resolve via the tenant transport, throws 401 when missing.
- `whoamiOrNull(req)` — returns `null` when missing, still fail-closed on upstream errors.
- `revoke(sessionId)` — admin revoke + cache eviction + audit.

### `FlowService`
Self-service flow proxy. See [Self-service flows](./self-service-flows) for the full `continue` vs `success` contract.

- `initiateLogin(opts?)` / `submitLogin(flowId, body)`
- `initiateRegistration(opts?)` / `submitRegistration(flowId, body)`
- `initiateRecovery(opts?)` / `submitRecovery(flowId, body)`
- `initiateSettings(opts?)` / `submitSettings(flowId, body)`
- `initiateVerification(opts?)` / `submitVerification(flowId, body)`
- `initiateBrowserLogout(cookie)` / `submitBrowserLogout(logoutToken)`
- `performNativeLogout(sessionToken)`
- `fetchFlow(kind, flowId)` — re-hydrate any flow family.

Every `initiate*` accepts `{ kind?: 'browser' | 'native', returnTo?: string }`.

### `SchemaService`
Identity-schema read access (JSON-Schema fragments that define traits shape).

- `list()` — all configured schemas.
- `get(id)` — single schema by id.

Requires `kratos.adminUrl` + `kratos.adminToken`.

### `CourierService`
Kratos transactional messages (verification emails, recovery codes). **Body redacted by default** — opt in per call.

- `list({ status?, recipient?, pageSize?, pageToken?, includeBody? })`
- `get(id, { includeBody? })`

## Keto

### `PermissionService`
Relationship CRUD + checks.

- `check(tuple)` — single boolean check.
- `grant(tuple)` — idempotent create (409 → success, audited).
- `revoke(tuple)` — idempotent delete (404 → success, audited).
- `list(query)` — paginated relationship listing.
- `expand({ namespace, object, relation, maxDepth? })` — subject-tree expansion.
- `checkBatch(tuples)` — concurrent fan-out; per-tuple `{ allowed, error? }` results.

## Hydra

### `TokenService`
OAuth2 token endpoint operations.

- `clientCredentials(scope)` — client-credentials grant (uses configured Hydra credentials).
- `authorizationCode({ code, redirectUri, clientId, clientSecret?, codeVerifier? })` — auth-code exchange (PKCE supported).
- `refresh({ refreshToken, clientId?, clientSecret?, scope? })` — refresh-token exchange.
- `jwtBearer({ assertion, scope?, clientId?, clientSecret? })` — `urn:ietf:params:oauth:grant-type:jwt-bearer`.
- `introspect(token)` — returns `{ active, subject, scope, ... }`; `active: false` is a normal return.
- `revoke(token, { tokenTypeHint?, clientId?, clientSecret? })` — RFC 7009.

### `OAuth2ClientService`
Hydra admin client CRUD.

- `create(input)` / `get(clientId)` / `list({ pageSize?, pageToken?, clientName?, owner? })`
- `set(clientId, input)` — full replace.
- `patch(clientId, ops)` — JSON-Patch.
- `delete(clientId)` (audited).

### `ConsentService`
Hydra login/consent/logout challenge mediation — the BFF side of the OAuth2 authorization flow.

- `getLoginRequest(challenge)` / `acceptLoginRequest(challenge, body)` / `rejectLoginRequest(challenge, body)`
- `getConsentRequest(challenge)` / `acceptConsentRequest(challenge, body)` / `rejectConsentRequest(challenge, body)`
- `getLogoutRequest(challenge)` / `acceptLogoutRequest(challenge)` / `rejectLogoutRequest(challenge)`

See [Hydra login/consent mediation](./consent-flow) for the full wiring.

### `JwkService`
JSON Web Key set management.

- `createSet(setName, { alg, use, kid? })` / `getSet(setName)` / `updateSet(setName, keys)` / `deleteSet(setName)`
- `getKey(setName, kid)` / `updateKey(setName, kid, key)` / `deleteKey(setName, kid)`

### `TrustedIssuerService`
`jwt-bearer` grant trusted-issuer registry.

- `trust({ issuer, subject?, scope, expiresAt, publicKey, allowAnySubject? })`
- `get(id)` / `list({ issuer?, pageSize?, pageToken? })` / `delete(id)`

## Ory Network (Cloud control plane)

All three require `mode: 'cloud'` + `cloud.workspaceApiKey`.

### `ProjectAdminService`
- `create({ name, workspaceId? })` / `list()` / `get(id)` / `set(id, patch)` / `purge(id)`
- `listMembers(id)`
- `createApiKey(projectId, { name })` / `listApiKeys(projectId)` / `deleteApiKey(projectId, tokenId)`

### `WorkspaceAdminService`
- `create({ name })` / `list(opts?)` / `get(id)` / `update(id, patch)`
- `listProjects(workspaceId)`
- `createApiKey(workspaceId, { name })` / `listApiKeys(workspaceId)` / `deleteApiKey(workspaceId, tokenId)`

### `EventsService`
- `create(projectId, { type, topicArn?, roleArn? })`
- `list(projectId)` / `set(projectId, streamId, patch)` / `delete(projectId, streamId)`

## Diagnostics

### `MetadataService`
- `version()` — Hydra build version (diagnostic).
- `discoverJwks()` — Hydra public `/.well-known/jwks.json`.
