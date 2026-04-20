# Key Decisions

This document tracks the significant technical decisions made during the development of `ory-nestjs`.

## ADR 1: Module Format (CommonJS)

**Decision**: v1 of the library ships as CommonJS (CJS) only.

**Rationale**: Most NestJS projects still run on CJS natively. Providing only CJS simplifies the build process and avoids complex interop issues with the NestJS ecosystem. ESM can be added as a dual-build in the future if needed.

## ADR 2: Zero-Ory-leakage

**Decision**: No Ory-specific types or errors are allowed in the public API.

**Rationale**: Ory's APIs and SDKs are subject to change. By abstracting them, we provide a stable platform for internal teams and reduce the cost of upgrading the Ory stack.

## ADR 3: Zod for Configuration Validation

**Decision**: Use Zod for all configuration validation at boot time.

**Rationale**: IAM configuration is critical. Zod provides a declarative and type-safe way to ensure that all required URLs, tokens, and settings are present and valid before the application starts.

## ADR 4: Global-by-default Security

**Decision**: The `UkkiIamModule` registers a global `SessionGuard` by default.

**Rationale**: A "secure by default" posture reduces the risk of accidentally exposing routes. Developers must explicitly opt-out using the `@Public()` decorator.

## ADR 5: Internal Ory SDK Dependency

**Decision**: `@ory/client` is a regular dependency, not a peer dependency.

**Rationale**: We want to control the version of the Ory SDK used by the library to ensure compatibility with our internal mappers and adapters. Consuming apps should not need to know about the Ory SDK version.
