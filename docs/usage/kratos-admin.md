---
sidebar_position: 13
---

# Kratos admin — schemas, courier, identities

Beyond the self-service flows, `ory-nestjs` exposes four admin surfaces against a self-hosted or Ory Network Kratos.

## Identity JSON-Patch

`updateTraits(id, traits)` replaces the whole traits object. When you only need to flip a single field — or target `metadata_public` / `metadata_admin` / `state` — use `patch`:

```ts
import { IdentityService, type IamJsonPatchOp } from 'ory-nestjs';

@Injectable()
export class AdminActions {
  constructor(private readonly identities: IdentityService) {}

  async promoteToAdmin(userId: string) {
    const ops: IamJsonPatchOp[] = [
      { op: 'replace', path: '/metadata_public', value: { roles: ['admin'] } },
    ];
    return this.identities.forTenant('default').patch(userId, ops);
  }

  async deactivate(userId: string) {
    return this.identities.forTenant('default').patch(userId, [
      { op: 'replace', path: '/state', value: 'inactive' },
    ]);
  }
}
```

Supported paths: `/traits/*`, `/metadata_public/*`, `/metadata_admin/*`, `/state`. Anything else is rejected by Kratos with a 400.

## Session extension

`SessionService.revoke` kills a session immediately. The opposite — pushing `expires_at` forward — is `IdentityService.extendSession`:

```ts
const session = await this.identities.forTenant('default').extendSession(sessionId);
// session.expiresAt is now + the tenant's configured lifespan
```

Use sparingly: every call pushes expiry forward by Kratos's configured session lifespan (default 24h). Prefer normal re-authentication for long-lived sessions.

## Identity schemas

Registration UIs, settings forms, and consent screens need to know what traits a tenant's identity supports. `SchemaService` serves the raw JSON-Schema:

```ts
import { SchemaService } from 'ory-nestjs';

@Controller('schemas')
export class SchemasController {
  constructor(private readonly schemas: SchemaService) {}

  @Get() list() { return this.schemas.forTenant('default').list(); }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.schemas.forTenant('default').get(id);
  }
}
```

Schemas are rendered client-side into forms (e.g., via `@ory/elements` or a custom renderer). Requires `kratos.adminUrl` + `kratos.adminToken`.

## Courier messages

Transactional emails and SMS (verification codes, recovery links, login magic links) pass through Kratos's courier queue. Inspect them with `CourierService`:

```ts
import { CourierService } from 'ory-nestjs';

@Controller('admin/courier')
@Tenant('default')
@RequireRole('platform:admin')
export class CourierController {
  constructor(private readonly courier: CourierService) {}

  @Get('messages')
  list(
    @Query('status') status?: 'queued' | 'sent' | 'processing' | 'abandoned',
  ) {
    return this.courier.forTenant('default').list({ status });
  }

  @Get('messages/:id')
  get(
    @Param('id') id: string,
    @Query('includeBody') includeBody?: string,
  ) {
    // Bodies routinely contain one-time tokens. They're redacted by default
    // — opt in per-request, and audit access in your own middleware.
    return this.courier.forTenant('default').get(id, {
      includeBody: includeBody === 'true',
    });
  }
}
```

:::warning
`includeBody: true` surfaces recovery codes and magic links. Never expose this to non-admin UIs or log the result — guard the route with `@RequireRole` and ensure your audit sink scrubs the payload.
:::

## Logout flow

`FlowService` ships three logout modes depending on the client:

```ts
// Browser — two-step: initiate (forwarding the session cookie) + submit.
@Get('logout')
async initLogout(@Headers('cookie') cookie: string | undefined) {
  return this.flows.forTenant('default').initiateBrowserLogout(cookie ?? '');
  // => { logoutToken, logoutUrl }
}

@Post('logout')
async submitLogout(@Body() body: { logoutToken: string }) {
  await this.flows.forTenant('default').submitBrowserLogout(body.logoutToken);
  return { kind: 'success' };
}

// Native (mobile/CLI) — single call with the session token.
@Post('logout/native')
async native(@Body() body: { sessionToken: string }) {
  await this.flows.forTenant('default').performNativeLogout(body.sessionToken);
  return { kind: 'success' };
}
```
