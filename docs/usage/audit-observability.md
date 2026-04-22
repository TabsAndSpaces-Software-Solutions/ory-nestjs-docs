---
sidebar_position: 8
---

# Audit events and observability

Every auth decision emits a structured event. The default `LoggerAuditSink` writes them through NestJS `Logger` with automatic redaction (JWT-shaped strings, cookies, `traits`, admin tokens all stripped).

To ship events elsewhere, provide your own sink:

```ts
import { Injectable } from '@nestjs/common';
import { AuditSink, AUDIT_SINK, IamAuditEvent } from 'ory-nestjs';

@Injectable()
export class OtelAuditSink implements AuditSink {
  async emit(event: IamAuditEvent) {
    // push to OTel log record, SIEM webhook, Kafka, whatever.
  }
}

IamModule.forRoot({
  tenants: { /* … */ },
  auditSink: { provide: AUDIT_SINK, useClass: OtelAuditSink },
});
```

Every mutating call on every service emits an event. Events follow the stable naming convention `iam.<product>.<action>` (e.g. `iam.identity.patch`, `iam.jwk.createSet`).

**Authentication / authorization pipeline:**

| Event | Source | Level |
|---|---|---|
| `auth.success` | `SessionGuard`, `OAuth2Guard` | info |
| `auth.failure.missing_credential` | `SessionGuard` | warn |
| `auth.failure.expired` | transport/mapper | warn |
| `auth.failure.malformed` | transport | warn |
| `auth.failure.token_inactive` | `OAuth2Guard` | warn |
| `auth.failure.unsigned_header` | `OathkeeperTransport` | warn |
| `auth.failure.upstream` | `SessionGuard` | warn |
| `auth.tenant_mismatch` | `SessionGuard` | warn |
| `authz.role.deny` | `RoleGuard` | warn |
| `authz.permission.grant` | `PermissionGuard`, `PermissionService.grant` | info |
| `authz.permission.deny` | `PermissionGuard` | warn |
| `authz.permission.revoke` | `PermissionService.revoke` | info |
| `authz.upstream_unavailable` | `PermissionGuard` | warn |
| `authz.session.revoke` | `SessionService.revoke`, `IdentityService.revokeSession` | info |

**Kratos admin mutations (v0.5.0+):**

| Event | Source | Level |
|---|---|---|
| `iam.identity.create` | `IdentityService.create` | info |
| `iam.identity.updateTraits` | `IdentityService.updateTraits` | info |
| `iam.identity.patch` | `IdentityService.patch` (includes `paths[]` + `opCount`) | info |
| `iam.identity.delete` | `IdentityService.delete` | info |
| `iam.session.extend` | `IdentityService.extendSession` | info |
| `iam.flow.logout.browser` | `FlowService.submitBrowserLogout` | info |
| `iam.flow.logout.native` | `FlowService.performNativeLogout` | info |
| `iam.courier.message.access` | `CourierService.get({ includeBody: true })` — surveillance event for SIEM alerting on admin reads of recovery/verification bodies | warn |

**Hydra mutations:**

| Event | Source | Level |
|---|---|---|
| `oauth2.client.create` | `OAuth2ClientService.create` | info |
| `oauth2.client.delete` | `OAuth2ClientService.delete` | info |
| `iam.jwk.createSet` / `updateSet` / `deleteSet` | `JwkService` | info |
| `iam.jwk.updateKey` / `deleteKey` | `JwkService` | info |
| `iam.oauth2.trustedIssuer.trust` | `TrustedIssuerService.trust` | info |
| `iam.oauth2.trustedIssuer.delete` | `TrustedIssuerService.delete` | info |

**Ory Network mutations:**

| Event | Source | Level |
|---|---|---|
| `iam.network.project.create` / `set` | `ProjectAdminService` | info |
| `iam.network.project.purge` (attribute `irreversible: true`) | `ProjectAdminService.purge` | info |
| `iam.network.project.apiKey.create` / `apiKey.delete` | `ProjectAdminService` | info |
| `iam.network.workspace.create` / `update` | `WorkspaceAdminService` | info |
| `iam.network.workspace.apiKey.create` / `apiKey.delete` | `WorkspaceAdminService` | info |
| `iam.network.events.create` / `set` / `delete` | `EventsService` | info |

**Operational:**

| Event | Source | Level |
|---|---|---|
| `health.probe_failure` | `IamHealthIndicator` | warn |
| `config.boot_failure` | `IamModule` | error |

:::tip Alerting
Any event ending in `.purge`, `.delete`, or carrying `attributes.irreversible === true` is a reasonable default for a SIEM high-severity rule. `iam.courier.message.access` is specifically emitted so compliance can alert on administrators reading recovery tokens.
:::

## Health indicator (`@nestjs/terminus`)

```ts
import { TerminusModule, HealthCheckService } from '@nestjs/terminus';
import { IamHealthIndicator } from 'ory-nestjs';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService, private readonly iam: IamHealthIndicator) {}

  @Get()
  @Public()
  check() {
    return this.health.check([() => this.iam.isHealthy('ory-nestjs')]);
  }
}
```

Probes every configured tenant × product (`/health/ready`) with a 500ms timeout. Failure payload names the failing tenant + product only — no URLs, tokens, or project slugs leak.

## Correlation IDs

`SessionGuard` reads `X-Request-Id` off the request (or generates one), stamps it onto outbound Ory calls, and includes it on every audit event. Add your own `AsyncLocalStorage`-aware logger and requests across the stack will join neatly.
