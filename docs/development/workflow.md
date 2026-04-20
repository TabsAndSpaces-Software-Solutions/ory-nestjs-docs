# Development Workflow

This guide covers the day-to-day workflow for developers working on the `ory-nestjs` library.

## Commands

From the package root (`packages/ukki-iam`):

```bash
pnpm install            # Install dependencies
pnpm build              # Compile TypeScript (tsc -> dist/)
pnpm test               # Run all tests
pnpm lint               # Run ESLint
```

## Testing Conventions

We use several levels of testing:

- **Unit Tests** (`test/unit/**/*.test.ts`): Pure logic and service tests.
- **Contract Tests** (`test/contract/**/*.test.ts`): Tests against stubbed Ory APIs to verify our mappers and clients.
- **Integration Tests** (`test/integration/**/*.test.ts`): Tests against a real Ory instance (requires a running environment).
- **Co-located Tests** (`src/**/*.spec.ts`): Small unit tests alongside the code.

## Build Process

The library is built using `tsc`. The output is generated in the `dist/` directory, which is what gets published to the registry.

## Linting & Formatting

We use ESLint with a strict configuration to enforce architectural boundaries (like the Zero-Ory-leakage contract) and coding standards. Prettier is used for formatting.
