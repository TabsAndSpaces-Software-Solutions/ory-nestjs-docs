# Quick Start

Get up and running with `ory-nestjs` in 5 minutes. Pick the deployment mode that matches where your Ory stack runs — the rest of the library surface (guards, decorators, services) is identical.

## 1. Register the Module

### Option A — Ory Cloud (`mode: 'cloud'`)

Simplest setup: drop in your Ory Cloud project slug + API key and the library derives every URL automatically.

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { IamModule, InMemorySessionCache } from 'ory-nestjs';
import { AppController } from './app.controller';

@Module({
  imports: [
    IamModule.forRoot({
      sessionCache: new InMemorySessionCache(),
      tenants: {
        default: {
          mode: 'cloud',
          transport: 'cookie-or-bearer',
          cache: { sessionTtlMs: 300_000 }, // 5 minutes
          cloud: {
            projectSlug: 'nifty-blackwell-thv46tbvh5', // from the Ory Console URL
            apiKey: process.env.ORY_CLOUD_API_KEY!,    // Console → API Keys
          },
          trustProxy: true,
        },
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Where to find these values** (Ory Console):
- **`projectSlug`** — visible in the Console URL and in *Project Settings → General → Slug*. For a URL like `https://console.ory.sh/projects/.../overview` look at the *Project API URL* field, e.g. `https://nifty-blackwell-thv46tbvh5.projects.oryapis.com`. The slug is the hostname segment before `.projects.oryapis.com`.
- **`apiKey`** — *Project Settings → API Keys → Create API Key* (scope it to "Project API").

:::tip Cookie transport on Ory Cloud
If you use `transport: 'cookie'` or `'cookie-or-bearer'`, Ory Cloud's session cookie is named with a project-specific random slug (not the same as `projectSlug`). Find it in the Ory Console under *Project Settings → Sessions* and pass it via a partial `kratos` block:

```ts
cloud: { projectSlug: '…', apiKey: '…' },
kratos: { sessionCookieName: 'ory_session_<your-session-slug>' },
```

Bearer-only clients don't need this.
:::

### Option B — Self-hosted (`mode: 'self-hosted'`)

Use when you run Kratos (and optionally Keto / Hydra) yourself.

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { IamModule, InMemorySessionCache } from 'ory-nestjs';
import { AppController } from './app.controller';

@Module({
  imports: [
    IamModule.forRoot({
      sessionCache: new InMemorySessionCache(),
      tenants: {
        default: {
          mode: 'self-hosted',
          transport: 'cookie-or-bearer',
          cache: { sessionTtlMs: 300_000 },
          kratos: {
            publicUrl: 'https://kratos.example.com',
            adminUrl: 'https://kratos-admin.internal',
            adminToken: process.env.KRATOS_ADMIN_TOKEN!,
          },
          // keto:  { readUrl: '…', writeUrl: '…' },          // optional — Keto-backed permissions
          // hydra: { publicUrl: '…', adminUrl: '…', … },      // optional — OAuth2 / M2M
          trustProxy: true,
        },
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

Self-hosted mode requires at least `kratos.publicUrl`. `adminUrl` + `adminToken` are required only for admin operations (identity CRUD, session revoke).

:::tip No Ory running yet?
See [Local development stack](./local-dev-stack) for a copy-paste `docker-compose.yml` that brings up Kratos + Postgres + MailSlurper on your machine in one command.
:::

## 2. Secure your Controllers

Identical for both modes:

```ts
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Public, IamIdentity } from 'ory-nestjs';

@Controller()
export class AppController {
  @Get('/health')
  @Public()
  health() {
    return 'ok';
  }

  @Get('/me')
  me(@CurrentUser() user: IamIdentity) {
    return user;
  }
}
```

That's it. Every route requires a valid Kratos session by default — `@Public()` is the explicit opt-out. `@CurrentUser()` injects a library-owned DTO, so you never see an `@ory/*` type in your own code.

## What's next

- [Module registration](./module-registration) — full tenant-config shape, async registration, the `global` option.
- [Authentication](./authentication) — guards, transports, cookie vs bearer.
- [Self-service flows](./self-service-flows) — browser vs native login/registration/recovery.
- [Multi-tenancy](./multi-tenancy) — combine self-hosted and cloud tenants in a single service.
