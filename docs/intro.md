# Introduction

`ory-nestjs` is a library for NestJS that provides a robust, tenant-aware Identity & Access Management (IAM) layer. It is built as a wrapper for the Ory Stack (Kratos, Keto, Hydra, and Oathkeeper) and the Ory Network control plane.

The core philosophy of this library is the **Zero-Ory-leakage contract**. This means that consuming applications interact with a stable, library-owned API, and never directly depend on or see Ory-specific types or errors.

## Key Features

- **Complete Ory coverage** (v0.5.0):
  - *Kratos:* sessions, identity CRUD + JSON-Patch, session extend, self-service flows (login, registration, recovery, settings, verification, logout — browser & native), identity schemas, courier messages.
  - *Keto:* permission check, grant, revoke, list, subject-tree expand, batch check.
  - *Hydra:* full OAuth2 client CRUD, all token grants (client_credentials, authorization_code + PKCE, refresh, jwt-bearer), introspect, revoke, JWK set management, login/consent/logout mediation, trusted JWT-bearer issuers.
  - *Oathkeeper:* zero-trust transport with JWT/HMAC envelope verification + replay protection.
  - *Ory Network:* project & workspace admin, API keys, members, event streams.
- **Multi-tenant by design**: Support multiple isolated Ory projects (self-hosted *or* cloud) from a single service.
- **Global Authentication**: Opt-out security model with a global `SessionGuard`.
- **Declarative Authorization**: Easy-to-use decorators for Role-Based Access Control (RBAC) and Relationship-Based Access Control (ReBAC via Keto).
- **Built-in Caching**: Pluggable session caching to reduce latency.
- **Audit Logging**: Structured audit events for every authentication and authorization decision.
- **Test-friendly**: Dedicated testing module with in-memory stubs for zero-network testing.

## Next Steps

- Follow the [Quick Start](./usage/quick-start) to integrate `ory-nestjs` into your project in 5 minutes.
- Check the [Installation](./usage/installation) guide for package details.
- Explore [Architecture](./development/architecture) to understand how it works under the hood.

## Example repository

A fully wired, runnable reference implementation lives at **[TabsAndSpaces-Software-Solutions/ory-nestjs-example](https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-example)** — clone, `docker compose up`, and hit the endpoints. Every scenario in this documentation has matching code in that repo; the README there maps each doc page to the commit that introduced the corresponding feature.
