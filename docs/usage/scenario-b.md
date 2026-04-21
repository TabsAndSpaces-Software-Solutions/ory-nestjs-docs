---
sidebar_position: 13
---

# Scenario B — Multi-tenant

Three separate Ory projects — one per tenant — in a single process. This is the recommended shape when the actor populations are genuinely disjoint and you want project-level isolation (separate identity schemas, separate admin tokens, separate audit trails).

## Module setup

```ts
IamModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cs: ConfigService) => ({
    defaultTenant: 'customer',
    tenants: {
      customer: {
        mode: 'cloud',
        transport: 'cookie-or-bearer',
        kratos: { publicUrl: cs.get('CUSTOMER_KRATOS_URL') },
        keto:   { readUrl: cs.get('CUSTOMER_KETO_URL'), writeUrl: cs.get('CUSTOMER_KETO_URL') },
        cloud:  { projectSlug: cs.get('CUSTOMER_PROJECT'), apiKey: cs.get('CUSTOMER_API_KEY') },
      },
      admin: {
        mode: 'self-hosted',
        transport: 'bearer',                         // admin tools call APIs directly
        kratos: {
          publicUrl: cs.get('ADMIN_KRATOS_URL'),
          adminUrl: cs.get('ADMIN_KRATOS_ADMIN_URL'),
          adminToken: cs.get('ADMIN_KRATOS_TOKEN'),
        },
      },
      dealer: {
        mode: 'self-hosted',
        transport: 'cookie-or-bearer',
        kratos: {
          publicUrl: cs.get('DEALER_KRATOS_URL'),
          adminUrl: cs.get('DEALER_KRATOS_ADMIN_URL'),
          adminToken: cs.get('DEALER_KRATOS_TOKEN'),
        },
        hydra: {                                      // dealers use OAuth2 for partner APIs
          publicUrl: cs.get('DEALER_HYDRA_URL'),
          adminUrl: cs.get('DEALER_HYDRA_ADMIN_URL'),
          adminToken: cs.get('DEALER_HYDRA_TOKEN'),
        },
      },
    },
  }),
});
```

## Routing requests to the right tenant

Pick one of two strategies:

**Strategy 1 — route prefix per tenant (recommended).** Each controller declares its tenant at the class level.

```ts
@Controller('customer')
@Tenant('customer')
export class CustomerController { /* resolves against 'customer' */ }

@Controller('admin')
@Tenant('admin')
@UseGuards(SessionGuard)             // global is still on, but admin tools might prefer explicit
@RequireRole('platform:admin')
export class AdminController { /* resolves against 'admin' */ }

@Controller('dealer')
@Tenant('dealer')
export class DealerController { /* resolves against 'dealer' */ }
```

**Strategy 2 — subdomain/host resolver.** Write a small middleware that maps `admin.example.com` → `admin` tenant and stamps `TENANT_KEY` metadata dynamically. More work; only pick this if route prefixes aren't acceptable.

## Cross-tenant calls (admin tool auditing a customer)

Admin routes authenticate against the `admin` tenant (their own Ory project) but need to **read** a customer identity from the `customer` tenant:

```ts
@Controller('admin/customers')
@Tenant('admin')                     // session validation uses admin Ory
@RequireRole('platform:admin', 'platform:support')
export class CustomerLookupController {
  constructor(private readonly identities: IdentityService) {}

  @Get(':id')
  async get(@Param('id') id: string) {
    // The admin is already authenticated. Use the customer tenant's services.
    return this.identities.forTenant('customer').get(id);
  }
}
```

This is the canonical pattern: authenticate against one tenant, service-call into another. Cross-tenant session bleed is still impossible — the guard always rejects a session whose `tenant` doesn't match the route's `@Tenant`.

## OAuth2 machine-to-machine for dealers

Dealers' partner APIs accept M2M tokens:

```ts
@Controller('dealer/partner-api')
@Tenant('dealer')
@UseGuards(OAuth2Guard)              // instead of SessionGuard
export class PartnerApiController {
  @Get('inventory')
  @RequireRole('inventory:read')     // scope doubles as role for machine principals
  listInventory(@CurrentUser() principal: IamMachinePrincipal) {
    // principal.kind === 'machine'
    // principal.clientId = 'dealer-123'
    // principal.scope = ['inventory:read']
  }
}
```

Issuing tokens from the dealer's own service (if they hold your `client_id` + `client_secret`):

```ts
const token = await tokenService.forTenant('dealer').clientCredentials(['inventory:read']);
// { accessToken, tokenType: 'Bearer', expiresIn: 3600, scope: [...] }
```

## Typed tenant names (optional)

If you want TypeScript to catch tenant-name typos:

```ts
// types/tenants.ts
export const TENANTS = ['customer', 'admin', 'dealer'] as const;
export type TenantName = (typeof TENANTS)[number];
```

Nothing in the library forces this — `TenantName` is `string` — but adopting the pattern in your own app code prevents class of bugs where `@Tenant('customr')` silently resolves wrong.
