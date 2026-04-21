---
sidebar_position: 10
---

# Self-service flows

`FlowService` is a thin server-side proxy over Kratos's self-service flow endpoints. Use it from a BFF that mediates between a browser/mobile UI and Kratos.

```ts
import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { FlowService, Public } from 'ory-nestjs';

@Controller('auth')
@Public()                            // these endpoints must be reachable without a session
export class AuthController {
  constructor(private readonly flows: FlowService) {}

  @Get('/login')
  async initiateLogin(@Query('returnTo') returnTo?: string) {
    return this.flows.forTenant('customer').initiateLogin({ returnTo });
  }

  @Post('/login/:flowId')
  async submitLogin(@Param('flowId') id: string, @Body() body: unknown) {
    const result = await this.flows.forTenant('customer').submitLogin(id, body);
    return result; // { kind: 'success', sessionId } | { kind: 'continue', flow }
  }
}
```

Returned flow DTOs (`LoginFlow`, etc.) contain library-owned `FlowUi` nodes + an opaque `csrfToken`. Never pass Ory's UI shapes directly to your frontend; always go through these DTOs.
