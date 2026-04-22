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

## The `continue` vs `success` result

Every `submit*` method resolves to one of two shapes:

| Result | When | What to do |
|---|---|---|
| `{ kind: 'success', sessionId }` | Kratos authenticated the user and issued a session. | Set the session cookie, redirect / return 200. |
| `{ kind: 'continue', flow }` | Submission didn't complete — validation failed, a new step is required, or a UI-level error needs to be shown (wrong password, duplicate email, unknown identifier, missing required field). | Re-render the flow — `flow.ui.messages[*]` and per-field `flow.ui.nodes[*].messages[*]` carry the error text to show the user. |

User-facing errors are **not** thrown — they come back as `continue` so your frontend can render them inline next to the offending field. Only *infrastructure* failures throw (network errors, Kratos 5xx, flow expired, etc.).

```ts
const result = await this.flows.forTenant('customer').submitLogin(id, body);
if (result.kind === 'success') {
  // Good to go — set cookie, return user.
  return { sessionId: result.sessionId };
}
// `continue` — render the flow again; the new UI carries the error message.
return result.flow;
```

:::note Since 0.4.1
Kratos v26+ returns **HTTP 400 with a full flow body** for the most common user-facing failure modes (wrong password, duplicate email, unknown identifier). Earlier `ory-nestjs` releases passed those 400s straight through `ErrorMapper`, which surfaced them as 500s — breaking the documented discriminated-union pattern. As of 0.4.1 `submitLogin` / `submitRegistration` / `submitRecovery` / `submitVerification` unwrap the 400 flow envelope into `{ kind: 'continue', flow }` automatically. No consumer-side change required; remove any `try { submit… } catch { re-fetch flow }` workarounds. (`submitSettings` was not affected — Kratos returns 422 there, which was never routed through the 400 path.)
:::

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

## Logout

As of 0.5.0 `FlowService` also mediates Kratos logout. Three entry points depending on the client:

```ts
// Browser — two-step: Kratos returns a { logoutToken, logoutUrl } pair.
@Get('logout')
async initLogout(@Headers('cookie') cookie: string | undefined) {
  return this.flows.forTenant('default').initiateBrowserLogout(cookie ?? '');
}

@Post('logout')
async submitLogout(@Body() body: { logoutToken: string }) {
  await this.flows.forTenant('default').submitBrowserLogout(body.logoutToken);
  return { kind: 'success' };
}

// Native (mobile / CLI) — one call with the session token.
@Post('logout/native')
async native(@Body() body: { sessionToken: string }) {
  await this.flows.forTenant('default').performNativeLogout(body.sessionToken);
  return { kind: 'success' };
}
```

The browser flow **requires** the original session cookie to be forwarded — include `req.headers.cookie` verbatim in `initiateBrowserLogout`. Kratos responds with `Set-Cookie` headers that clear the session; surface those back to the browser.
