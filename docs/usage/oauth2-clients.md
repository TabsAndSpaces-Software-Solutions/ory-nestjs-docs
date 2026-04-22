---
sidebar_position: 11
---

# Hydra OAuth2 — clients, tokens & keys

`OAuth2ClientService`, `TokenService`, `JwkService`, and `TrustedIssuerService` wrap Hydra's admin and public surfaces. This page covers the operational workflows you'll actually run in production: registering clients, issuing + introspecting + revoking tokens, and rotating signing keys.

## Tenant config

Enable Hydra by adding a `hydra` block to the tenant config:

```ts
IamModule.forRoot({
  tenants: {
    default: {
      mode: 'self-hosted',
      transport: 'cookie-or-bearer',
      kratos: { publicUrl: '…', adminUrl: '…', adminToken: '…' },
      hydra: {
        publicUrl: 'http://127.0.0.1:4444',
        adminUrl: 'http://127.0.0.1:4445',
        clientId: process.env.HYDRA_CLIENT_ID,       // for clientCredentials
        clientSecret: process.env.HYDRA_CLIENT_SECRET,
      },
    },
  },
});
```

`publicUrl` serves token exchange + revoke; `adminUrl` serves client CRUD, introspection, consent mediation, and JWK CRUD.

## Registering an OAuth2 client

```ts
import { OAuth2ClientService, type IamOAuth2ClientInput } from 'ory-nestjs';

@Injectable()
export class ProvisioningService {
  constructor(private readonly clients: OAuth2ClientService) {}

  async registerPartner(name: string) {
    const input: IamOAuth2ClientInput = {
      clientName: name,
      grantTypes: ['client_credentials'],
      scope: 'inventory:read inventory:write',
      tokenEndpointAuthMethod: 'client_secret_basic',
    };
    return this.clients.forTenant('default').create(input);
    // => { clientId, clientSecret, ... }
    // Secret is returned ONCE. Forward to the partner over a secure channel.
  }
}
```

`create` emits an `oauth2.client.create` audit event. `delete` emits `oauth2.client.delete`.

### Patching a client

JSON-Patch lets you flip individual fields without re-sending the whole object:

```ts
await this.clients.forTenant('default').patch(clientId, [
  { op: 'replace', path: '/scope', value: 'inventory:read' },
  { op: 'add',     path: '/metadata/owner', value: 'team-logistics' },
]);
```

`set(clientId, input)` replaces the whole client (use with care — missing fields reset to defaults).

## Issuing tokens

### client_credentials (M2M)

```ts
const token = await this.tokens.forTenant('default').clientCredentials([
  'inventory:read',
]);
// { accessToken, tokenType: 'Bearer', expiresIn: 3600, scope: ['inventory:read'] }
```

Uses the tenant's configured `hydra.clientId` / `hydra.clientSecret`.

### authorization_code + PKCE

```ts
const token = await this.tokens.forTenant('default').authorizationCode({
  code: req.query.code,
  redirectUri: 'https://app.example.com/callback',
  clientId: 'public-spa',
  codeVerifier: req.session.pkceVerifier,   // public client — no clientSecret
});
```

### refresh_token

```ts
const fresh = await this.tokens.forTenant('default').refresh({
  refreshToken: oldToken.refreshToken,
  clientId: 'mobile-app',
  clientSecret: '…',
  scope: ['offline_access', 'inventory:read'],
});
```

### jwt-bearer (federated / server-signed assertions)

```ts
const token = await this.tokens.forTenant('default').jwtBearer({
  assertion: signedJwt,
  scope: ['inventory:read'],
});
```

The issuer of `assertion` must be registered via `TrustedIssuerService` first (see below).

## Introspecting & revoking

```ts
const info = await this.tokens.forTenant('default').introspect(token);
if (!info.active) throw new UnauthorizedException();

await this.tokens.forTenant('default').revoke(token, {
  tokenTypeHint: 'refresh_token',
  clientId: 'mobile-app',
  clientSecret: '…',
});
```

`introspect` returns `active: false` for unknown/expired tokens — it does **not** throw.

## JWK management

Hydra signs ID tokens and (optionally) access tokens with keys in its JWK store. Rotate with `JwkService`:

```ts
// Generate a new signing key set
await this.jwks.forTenant('default').createSet('my-signing-set', {
  alg: 'RS256',
  use: 'sig',
});

// List keys later
const set = await this.jwks.forTenant('default').getSet('my-signing-set');

// Delete an old set
await this.jwks.forTenant('default').deleteSet('old-set');
```

For rolling rotations, keep N and N+1 coexisting in the same set, then delete N once caches expire.

## Trusted JWT-bearer issuers

Before accepting `jwtBearer` grants, register the issuer:

```ts
await this.trustedIssuers.forTenant('default').trust({
  issuer: 'https://partner.example.com',
  subject: 'partner-service-account',
  scope: ['inventory:read'],
  expiresAt: '2027-01-01T00:00:00Z',
  publicKey: { kty: 'RSA', kid: 'partner-2026', n: '…', e: 'AQAB' },
});
```

Use `allowAnySubject: true` to accept any `sub` claim from the issuer (useful when the issuer brokers many users).

## Diagnostics

```ts
const { version } = await this.metadata.forTenant('default').version();
const jwks        = await this.metadata.forTenant('default').discoverJwks();
```

`discoverJwks` hits Hydra's public `/.well-known/jwks.json` — what clients use to verify ID tokens.
