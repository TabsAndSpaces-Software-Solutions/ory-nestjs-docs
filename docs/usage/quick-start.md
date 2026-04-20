# Quick Start

Get up and running with `ory-nestjs` in 5 minutes.

### 1. Register the Module

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { UkkiIamModule, InMemorySessionCache } from 'ory-nestjs';
import { AppController } from './app.controller';

@Module({
  imports: [
    UkkiIamModule.forRoot({
      sessionCache: new InMemorySessionCache(), // optional: enable in-memory caching
      tenants: {
        default: {
          mode: 'self-hosted',
          transport: 'cookie-or-bearer',
          cache: { sessionTtlMs: 300_000 }, // 5 minutes
          kratos: {
            publicUrl: 'https://kratos.example.com',
            adminUrl: 'https://kratos-admin.internal',
            adminToken: process.env.KRATOS_ADMIN_TOKEN,
          },
        },
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

### 2. Secure your Controllers

```ts
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Public, UkkiIdentity } from 'ory-nestjs';

@Controller()
export class AppController {
  @Get('/health')
  @Public()
  health() {
    return 'ok';
  }

  @Get('/me')
  me(@CurrentUser() user: UkkiIdentity) {
    return user;
  }
}
```

That's it. Every route under this app requires a valid Kratos session by default. `@Public()` is the explicit opt-out. `@CurrentUser()` injects a library-owned DTO — you never see an `@ory/*` type in your own code.
