# Contributing to ory-nestjs

Thank you for your interest in contributing to `ory-nestjs`!

## Pull Request Guidelines

1. **Focus**: Each PR should have a single, clear focus.
2. **Tests**: All new features and bug fixes must include tests.
3. **Documentation**: Update the relevant documentation files in `ory-nestjs` if you change the public API or behavior.
4. **Commits**: Use descriptive commit messages.

## Development Setup

1. Clone the repository.
2. Install dependencies: `pnpm install`.
3. Build the project: `pnpm build`.
4. Run tests: `pnpm test`.

## Coding Standards

- Follow the existing coding style and naming conventions.
- Ensure all new public symbols are exported from `src/index.ts`.
- **Never** export anything from `@ory/*` packages.
- Use explicit types; avoid `any`.

## Adding a New Service

When adding a new service:
1. Define the library-owned DTOs in `src/dto`.
2. Implement the mappers in `src/dto/mappers`.
3. Add the service class in `src/services` with `.forTenant()` support.
4. Export the service and DTOs from `src/index.ts`.
5. Add unit and contract tests.
