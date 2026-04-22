---
sidebar_position: 12
---

# Hydra login & consent mediation

`ConsentService` mediates the OAuth2 authorization-code flow — the user-facing half that Hydra itself does not render. A BFF collects the user decision and calls `accept*` or `reject*` to resume the flow.

## End-to-end shape

```
┌────────┐   1. authorize   ┌──────┐  2. redirect(?login_challenge=…)  ┌──────────┐
│ Client │ ───────────────► │Hydra │ ────────────────────────────────► │  Your    │
└────────┘                  │      │                                   │   BFF    │
     ▲                      │      │  4. redirect(?consent_challenge=…)│          │
     │                      │      │ ◄──────────── 3. acceptLogin ──── │          │
     │                      │      │                                   │          │
     │                      │      │  6. redirect(?code=…)             │          │
     │                      │      │ ◄──────────── 5. acceptConsent ── │          │
     │                      │      │                                   └──────────┘
     │                      │      │  7. redirect back to client
     └──────────────────────┤      │ ◄──
                            └──────┘
```

Four challenge types are mediated:

| Challenge | Purpose |
|---|---|
| **login** | Who is the user? BFF authenticates and replies `{ subject }`. |
| **consent** | What permissions does the user grant to this client? BFF replies `{ grantScope, session? }`. |
| **logout** | User-initiated logout through an OIDC relying party. |
| **error** | Hydra hit an internal issue — surface the error to the user. |

## Login challenge

```ts
import { ConsentService, Public } from 'ory-nestjs';

@Controller('oauth2')
@Public()
export class OAuthController {
  constructor(private readonly consent: ConsentService) {}

  @Get('login')
  async login(
    @Query('login_challenge') challenge: string,
    @Res() res: Response,
  ) {
    const req = await this.consent
      .forTenant('default')
      .getLoginRequest(challenge);

    // Skip the UI if Hydra already knows this user.
    if (req.skip) {
      const { redirectTo } = await this.consent
        .forTenant('default')
        .acceptLoginRequest(challenge, { subject: req.subject });
      return res.redirect(redirectTo);
    }

    // Otherwise render your login UI; after auth, POST to /login/complete.
    return res.render('login', { challenge, clientId: req.clientId });
  }

  @Post('login/complete')
  async completeLogin(
    @Body() body: { challenge: string; subject: string; remember?: boolean },
    @Res() res: Response,
  ) {
    const { redirectTo } = await this.consent
      .forTenant('default')
      .acceptLoginRequest(body.challenge, {
        subject: body.subject,
        remember: body.remember ?? false,
        rememberFor: 3600,
      });
    return res.redirect(redirectTo);
  }
}
```

Reject a login (wrong password, user banned) with `rejectLoginRequest(challenge, { error, errorDescription? })`.

## Consent challenge

```ts
@Get('consent')
async consent(
  @Query('consent_challenge') challenge: string,
  @Res() res: Response,
) {
  const req = await this.consent
    .forTenant('default')
    .getConsentRequest(challenge);

  if (req.skip) {
    // User already consented — auto-approve.
    const { redirectTo } = await this.consent
      .forTenant('default')
      .acceptConsentRequest(challenge, {
        grantScope: req.requestedScope,
      });
    return res.redirect(redirectTo);
  }

  // Render the scope list for the user to approve.
  return res.render('consent', {
    challenge,
    clientId: req.clientId,
    requestedScope: req.requestedScope,
  });
}

@Post('consent/complete')
async completeConsent(
  @Body() body: { challenge: string; grantedScopes: string[] },
  @Res() res: Response,
) {
  const { redirectTo } = await this.consent
    .forTenant('default')
    .acceptConsentRequest(body.challenge, {
      grantScope: body.grantedScopes,
      session: {
        // Extra claims that land in the ID token + access token.
        accessToken: { role: 'customer' },
        idToken: { email_verified: true },
      },
    });
  return res.redirect(redirectTo);
}
```

## Logout challenge

```ts
@Get('logout')
async logout(
  @Query('logout_challenge') challenge: string,
  @Res() res: Response,
) {
  const { redirectTo } = await this.consent
    .forTenant('default')
    .acceptLogoutRequest(challenge);
  return res.redirect(redirectTo);
}
```

For user-declined logouts, call `rejectLogoutRequest(challenge)` — Hydra then keeps the session alive.

## Reject bodies

Every `reject*` accepts an RFC 6749 error shape:

```ts
await this.consent.forTenant('default').rejectLoginRequest(challenge, {
  error: 'access_denied',
  errorDescription: 'Account is disabled',
  statusCode: 403,
});
```
