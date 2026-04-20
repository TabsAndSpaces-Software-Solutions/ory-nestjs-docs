# Architecture Overview

`ory-nestjs` is designed as a high-level abstraction layer over the Ory Stack. It follows several key architectural patterns to ensure stability, security, and ease of use.

## Zero-Ory-leakage Contract

The primary goal of the library is to insulate consuming applications from the complexities and breaking changes of the Ory APIs.

- **Stable API Surface**: Consuming apps only interact with `ory-nestjs` services, decorators, and DTOs.
- **Internal Adapters**: Ory-specific logic and clients are confined to the `src/clients`, `src/dto/mappers`, and `src/transport` directories.
- **Enforced Boundaries**: ESLint rules prevent direct imports of `@ory/*` packages outside of the adapter layer.

## Multi-tenant Adapter Pattern

The library uses an adapter pattern to handle multi-tenancy.

- **Tenant Registry**: At boot time, the library validates and registers configurations for all defined tenants.
- **Scoped Clients**: Services use a registry to return clients that are pre-configured with the correct URLs, tokens, and transport settings for a specific tenant.
- **Invariant Enforcement**: Guards ensure that a session from Tenant A cannot be used to access a route scoped to Tenant B.

## Security Transports

The library supports multiple authentication transports, which are abstracted behind a common interface:

- **Cookie/Bearer**: Direct integration with Kratos.
- **Oathkeeper**: Verification of signed identity envelopes from an upstream proxy.

## Audit Pipeline

Every authentication and authorization decision flows through a central audit pipeline.

- **Redaction**: A built-in redactor ensures that sensitive data (JWTs, tokens, PII) never leaks into audit logs.
- **Pluggable Sinks**: Developers can provide custom `AuditSink` implementations to ship events to external systems (SIEM, OTel, etc.).

## Boot-time Validation

The library uses **Zod** for strict configuration validation. If the provided configuration is invalid, the application fails to boot with a clear error message. This prevents runtime failures due to misconfiguration.
