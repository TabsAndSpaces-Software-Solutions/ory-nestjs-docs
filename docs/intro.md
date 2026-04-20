# Introduction

`ory-nestjs` is a library for NestJS that provides a robust, tenant-aware Identity & Access Management (IAM) layer. It is built as a wrapper for the Ory Stack (Kratos, Keto, Hydra, and Oathkeeper).

The core philosophy of this library is the **Zero-Ory-leakage contract**. This means that consuming applications interact with a stable, library-owned API, and never directly depend on or see Ory-specific types or errors.

## Key Features

- **Multi-tenant by design**: Support multiple isolated Ory projects from a single service.
- **Global Authentication**: Opt-out security model with a global `SessionGuard`.
- **Declarative Authorization**: Easy-to-use decorators for Role-Based Access Control (RBAC) and Relationship-Based Access Control (ReBAC via Keto).
- **Comprehensive Services**: Abstracted services for Identity, Sessions, Permissions, Tokens, and Flows.
- **Built-in Caching**: Pluggable session caching to reduce latency.
- **Audit Logging**: Structured audit events for every authentication and authorization decision.
- **Test-friendly**: Dedicated testing module with in-memory stubs for zero-network testing.

## Next Steps

- Follow the [Quick Start](./usage/quick-start) to integrate `ory-nestjs` into your project in 5 minutes.
- Check the [Installation](./usage/installation) guide for package details.
- Explore [Architecture](../development/architecture) to understand how it works under the hood.
