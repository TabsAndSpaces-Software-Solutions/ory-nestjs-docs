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

Returned flow DTOs (`IamLoginFlow`, etc.) contain library-owned `IamFlowUi` nodes + an opaque `csrfToken`. Never pass Ory's UI shapes directly to your frontend; always go through these DTOs.

## Browser vs native flows

Every `initiate*` method takes an optional `kind: 'browser' | 'native'` selector. Kratos runs two distinct APIs behind the two modes; pick the one that matches your client.

| `kind` | Calls | CSRF cookie | Use for |
|---|---|---|---|
| `'browser'` *(default)* | `createBrowser*Flow` | ✅ Kratos sets a `csrf_token` cookie that the client must round-trip | Real browser front-ends where cookies flow through naturally |
| `'native'` | `createNative*Flow` | ❌ No CSRF cookie | Mobile apps, CLIs, curl-based clients, and BFFs proxying non-browser traffic |

If you leave `kind` unset you get the browser flow — preserved for backwards compatibility with 0.1.x.

### When to use native

If you hit `403` on `submit*` with anything other than a real browser client, you're on a browser flow but can't round-trip the CSRF cookie. Switch to native:

```ts
// BFF that serves a React Native app — no browser cookies in play.
@Post('/login')
async initiateNativeLogin(@Query('returnTo') returnTo?: string) {
  return this.flows.forTenant('customer').initiateLogin({
    kind: 'native',
    returnTo,
  });
}
```

Native flows return the same library DTO shape as browser flows — your submit handler doesn't change.

### When to use browser

If you're serving the login/registration UI from the same origin as your NestJS app and the browser is talking directly to your endpoints, browser flows are the right choice. Kratos's CSRF cookie protects the submit call.

### Mixed mode

You can pick per-call if your BFF fronts both browser and native clients. A common pattern is to branch on a client hint:

```ts
@Post('/login')
async initiateLogin(
  @Query('returnTo') returnTo: string | undefined,
  @Headers('x-client') client: string | undefined,
) {
  const kind = client === 'mobile' ? 'native' : 'browser';
  return this.flows.forTenant('customer').initiateLogin({ kind, returnTo });
}
```

:::note Since 0.2.0
The `kind` option was added in 0.2.0. In 0.1.x every `initiate*` call was hardcoded to the Browser API, so non-browser clients had to bypass `FlowService` entirely and call Kratos directly. Upgrading to 0.2.0 is a drop-in change — the default is still `'browser'`, so existing code keeps working.
:::
