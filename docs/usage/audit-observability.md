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

Events emitted:

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
| `health.probe_failure` | `IamHealthIndicator` | warn |
| `config.boot_failure` | `IamModule` | error |

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
