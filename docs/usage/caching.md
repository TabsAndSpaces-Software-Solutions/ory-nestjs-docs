---
sidebar_position: 5
---

# Session caching

By default, every request hits Kratos to validate the session. To reduce latency and Kratos load, you can enable session caching.

## Enabling caching

1. Provide a `sessionCache` implementation in `UkkiIamModule.forRoot`.
2. Set `cache.sessionTtlMs > 0` for the desired tenants.

The library ships with two implementations:
- `NoopSessionCache` (default): Performs no caching.
- `InMemorySessionCache`: A simple LRU cache for single-pod deployments.

```ts
UkkiIamModule.forRoot({
  sessionCache: new InMemorySessionCache({ max: 1000 }),
  tenants: {
    default: {
      // ...
      cache: { sessionTtlMs: 60000 }, // 1 minute
    },
  },
});
```

## Cache behavior

- **Fail-open:** If the cache backend throws an error, the library bypasses the cache and calls Kratos directly. The error is logged but doesn't fail the request.
- **TTL computation:** The actual TTL is `min(sessionTtlMs, session.expiresAt - now)`. A session is never cached beyond its Ory-defined expiry.
- **Eviction on revoke:** Calling `SessionService.revoke(sessionId)` or `IdentityService.revokeSession(userId, sessionId)` automatically evicts the session from the cache.
- **Observability:** Successful cache hits are flagged in the `auth.success` audit event as `cacheHit: true`.

## Custom cache backends

For multi-pod deployments, implement the `SessionCache` interface (e.g., using Redis):

```ts
import { SessionCache, ResolvedSession } from 'ory-nestjs';

export class RedisSessionCache implements SessionCache {
  async get(key: string): Promise<ResolvedSession | null> { /* ... */ }
  async set(key: string, value: ResolvedSession, ttlMs: number): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async deleteBySessionId(sessionId: string): Promise<void> { /* ... */ }
}
```
