---
sidebar_position: 12
---

# Scenario A — Single-tenant marketplace

You are running a marketplace. All actors authenticate against one Kratos project. The actor types are:

- **Customer** — end user. Has sub-roles `buyer`, `seller` (can hold both simultaneously).
- **Platform Admin** — internal employee. Has sub-roles `admin`, `developer`, `sales`, `support`.
- **Vendor** — external partner. Has a **type** (`logistics`, `finance`, `rto`, `insurance`) and a **role within the type** (`admin` or `staff`).

## Role modeling

Roles are set by administrators and travel on the identity's `metadataPublic`. Traits stay user-editable (name, email, phone), metadata stays server-only. We encode the model like this:

```ts
// Identity.metadataPublic (server-set, surfaced to services but NOT self-editable)
type UkkiMetadataPublic = {
  actorType: 'customer' | 'platform_admin' | 'vendor';
  roles: string[];              // see below
  vendor?: {
    type: 'logistics' | 'finance' | 'rto' | 'insurance';
  };
};
```

**Role name convention** — flatten the hierarchy into a single array the library can OR-match against. Use colon-separated namespaces:

| Actor | Example `roles` |
|---|---|
| Customer who buys | `['customer:buyer']` |
| Customer who buys and sells | `['customer:buyer', 'customer:seller']` |
| Platform admin (full) | `['platform:admin']` |
| Platform developer | `['platform:developer']` |
| Logistics vendor — admin | `['vendor:logistics:admin']` |
| Logistics vendor — staff | `['vendor:logistics:staff']` |
| Finance vendor — staff | `['vendor:finance:staff']` |

The library's `@RequireRole` compares strings literally, so this encoding gives you:

- A single check for "any customer" — you can't do it directly with OR, so you gate the whole controller with `@Tenant('default')` and let routes under it choose specific sub-roles.
- "Any platform admin" — `@RequireRole('platform:admin', 'platform:developer', 'platform:sales', 'platform:support')`.
- "Logistics admin specifically" — `@RequireRole('vendor:logistics:admin')`.
- "Any vendor admin" — `@RequireRole('vendor:logistics:admin', 'vendor:finance:admin', 'vendor:rto:admin', 'vendor:insurance:admin')`.

If you find yourself writing the same long OR list repeatedly, factor it into a custom decorator:

```ts
// decorators/platform-staff.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { RequireRole } from 'ory-nestjs';

export const PlatformStaff = () =>
  RequireRole('platform:admin', 'platform:developer', 'platform:sales', 'platform:support');

export const VendorAdmin = (type?: 'logistics' | 'finance' | 'rto' | 'insurance') =>
  type
    ? RequireRole(`vendor:${type}:admin`)
    : RequireRole('vendor:logistics:admin', 'vendor:finance:admin', 'vendor:rto:admin', 'vendor:insurance:admin');
```

## Module setup (single tenant)

```ts
UkkiIamModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cs: ConfigService) => ({
    tenants: {
      default: {
        mode: 'self-hosted',
        transport: 'cookie-or-bearer',
        kratos: {
          publicUrl: cs.get('KRATOS_PUBLIC_URL'),
          adminUrl: cs.get('KRATOS_ADMIN_URL'),
          adminToken: cs.get('KRATOS_ADMIN_TOKEN'),
        },
        keto: {
          readUrl: cs.get('KETO_READ_URL'),
          writeUrl: cs.get('KETO_WRITE_URL'),
        },
        trustProxy: true,
      },
    },
    // defaultTenant: 'default',   // auto-derived since there's only one tenant
  }),
});
```

No `@Tenant()` needed on controllers — everything resolves to `default`.

## Customer routes

```ts
@Controller('listings')
export class ListingsController {
  // Any customer can browse.
  @Get()
  @RequireRole('customer:buyer', 'customer:seller')
  list() { /* … */ }

  // Only sellers can create listings.
  @Post()
  @RequireRole('customer:seller')
  create(@CurrentUser() user: UkkiIdentity, @Body() body: CreateListingDto) { /* … */ }

  // Only the seller who owns this listing can edit it — Keto check.
  @Put(':id')
  @RequireRole('customer:seller')
  @RequirePermission({
    namespace: 'listings',
    relation: 'owner',
    object: (req) => `listings:${req.params.id}`,
  })
  edit(@Param('id') id: string, @Body() body: EditListingDto) { /* … */ }

  // Buyers place offers.
  @Post(':id/offers')
  @RequireRole('customer:buyer')
  makeOffer(@Param('id') id: string, @CurrentUser() user: UkkiIdentity) { /* … */ }
}
```

Seed Keto on listing creation so the owner check in `PUT /listings/:id` works:

```ts
await permissionService.forTenant('default').grant({
  namespace: 'listings',
  object: `listings:${newListingId}`,
  relation: 'owner',
  subject: `user:${user.id}`,
  tenant: 'default',
});
```

## Platform admin routes

```ts
@Controller('admin')
export class AdminController {
  // Support agents and above can look up users.
  @Get('users/:id')
  @RequireRole('platform:admin', 'platform:support')
  async getUser(@Param('id') id: string) {
    return this.identity.forTenant('default').get(id);
  }

  // Only full admins can delete.
  @Delete('users/:id')
  @RequireRole('platform:admin')
  async deleteUser(@Param('id') id: string) {
    await this.identity.forTenant('default').delete(id);
  }

  // Developers only — feature flag toggles, etc.
  @Post('feature-flags/:key')
  @RequireRole('platform:developer')
  flip(@Param('key') key: string, @Body() body: { enabled: boolean }) { /* … */ }

  // Sales dashboard.
  @Get('leads')
  @PlatformStaff()                // the custom decorator from §11.1
  leads() { /* … */ }
}
```

## Vendor routes — type + role matrix

The library's `@RequireRole` doesn't know about "vendor type". Encode both type and role in the role string (`vendor:logistics:admin`) and use a controller-level `@RequireRole` or guard to narrow by type, then method-level for role within type.

```ts
@Controller('vendor/logistics')
@RequireRole(
  'vendor:logistics:admin',
  'vendor:logistics:staff',
)
export class LogisticsVendorController {
  @Get('shipments')
  // inherits controller-level OR — either role passes
  listShipments(@CurrentUser() user: UkkiIdentity) { /* … */ }

  @Post('shipments/:id/cancel')
  @RequireRole('vendor:logistics:admin')          // admin only; tightens at method level
  cancelShipment(@Param('id') id: string) { /* … */ }
}
```

Repeat the pattern per vendor type (`/vendor/finance`, `/vendor/rto`, `/vendor/insurance`). If several vendor types share endpoints, parameterize:

```ts
// vendor-type.guard.ts — optional custom guard that validates route param against role
@Injectable()
export class VendorTypeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as UkkiIdentity;
    const routeType = req.params.type as string;
    const allowed = user.metadataPublic?.vendor?.type === routeType;
    if (!allowed) throw new ForbiddenException();
    return true;
  }
}

@Controller('vendor/:type')
@RequireRole(
  'vendor:logistics:admin', 'vendor:logistics:staff',
  'vendor:finance:admin',   'vendor:finance:staff',
  'vendor:rto:admin',       'vendor:rto:staff',
  'vendor:insurance:admin', 'vendor:insurance:staff',
)
@UseGuards(VendorTypeGuard)
export class VendorController {
  @Get('invoices')
  invoices(@Param('type') type: string) { /* … */ }
}
```
