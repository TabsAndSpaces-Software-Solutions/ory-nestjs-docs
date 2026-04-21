---
sidebar_position: 11
---

# Testing consumer code

```ts
import { Test } from '@nestjs/testing';
import { IamTestingModule } from 'ory-nestjs';
import request from 'supertest';

describe('ListingsController', () => {
  it('allows the owner to edit', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        IamTestingModule.forRoot({
          identity: {
            id: 'u_abc', schemaId: 'default', state: 'active',
            verifiedAddressesFlags: { email: true, phone: false },
            metadataPublic: { roles: ['seller'] },
            tenant: 'customer',
          },
          permissions: { 'listings:edit:listings:42': true },
        }),
      ],
      controllers: [ListingsController],
      providers: [ListingsService],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await request(app.getHttpServer()).put('/listings/42').expect(200);
    await app.close();
  });

  it('denies when not owner', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        IamTestingModule.forRoot({
          identity: { /* same */ },
          permissions: { 'listings:edit:listings:42': false },
        }),
      ],
      controllers: [ListingsController],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await request(app.getHttpServer()).put('/listings/42').expect(403);
  });

  it('rejects unauthenticated request', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [IamTestingModule.forRoot({ /* no identity */ })],
      controllers: [ListingsController],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await request(app.getHttpServer()).put('/listings/42').expect(401);
  });
});
```

Zero network. Zero Ory dependencies. The testing module replaces all guards and services with deterministic in-memory stubs.

## Running the library's own integration tests

The library itself ships a real-Kratos integration harness under `test/integration/`. It spins up Postgres + Kratos via Testcontainers, logs in against a live API, and exercises the cookie and bearer transports end-to-end plus the session cache hit/miss/revoke paths.

```bash
# Unit + contract tests — fast, no Docker required.
pnpm test

# Integration tests — requires a running Docker daemon. Cold start is ~10s
# (container boot + migration), warm runs complete in a second.
pnpm test:integration
```

If you're onboarding a new deployment target, the integration harness is the fastest way to validate that your Kratos config is compatible: copy one of the specs under `test/integration/specs/` and point it at your cluster via the `StackHandle` override.

The `state` is mutable post-boot:

```ts
import { TESTING_STATE, TestingState } from 'ory-nestjs';
const state = moduleRef.get<TestingState>(TESTING_STATE);
state.permissions.set('listings:delete:listings:42', true);
```

:::warning Gotcha
`@UseGuards(SessionGuard)` using the class reference directly bypasses the DI alias because NestJS instantiates a fresh injectable. If you need to override a specific guard class, pair the testing module with `Test.createTestingModule(...).overrideGuard(SessionGuard).useValue(fakeInstance)`. In global-guard mode (the default) this is not an issue.
:::
