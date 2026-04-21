---
sidebar_position: 14
---

# Scenario C — Custom per-role permissions with Keto

Roles give you coarse gates. Keto gives you fine gates. This section shows how to combine them for a marketplace where ownership, delegation, and team membership all matter.

## Designing the relationship model

Start from the questions you need to answer:

- Can **user X** edit **listing Y**?
- Can **user X** view **order Z**'s internal notes?
- Can **team A** manage **vendor dashboard D**?

Express each as a `(namespace, object, relation, subject)` tuple:

| Question | Namespace | Object | Relation | Subject |
|---|---|---|---|---|
| X owns listing 42 | `listings` | `listings:42` | `owner` | `user:X` |
| X can edit listing 42 | `listings` | `listings:42` | `edit` | `user:X` |
| Team A views dashboard D | `dashboards` | `dashboards:D` | `viewer` | `group:team-A` |
| X is member of team A | `teams` | `teams:A` | `member` | `user:X` |

Keto can traverse these — defining an `edit` relation as "owner of the listing" lets one tuple (ownership) imply another (edit rights) automatically. Configure your Keto namespaces file accordingly.

## Seeding permissions when things happen

```ts
import { Injectable } from '@nestjs/common';
import { PermissionService, IamIdentity } from 'ory-nestjs';

@Injectable()
export class ListingService {
  constructor(private readonly perms: PermissionService) {}

  async create(input: CreateListingDto, user: IamIdentity) {
    const id = await this.repo.insert(input);
    await this.perms.forTenant('default').grant({
      namespace: 'listings',
      object: `listings:${id}`,
      relation: 'owner',
      subject: `user:${user.id}`,
      tenant: 'default',
    });
    return id;
  }

  async transferOwnership(listingId: string, fromUserId: string, toUserId: string) {
    const perms = this.perms.forTenant('default');
    const tuple = (subject: string) => ({
      namespace: 'listings',
      object: `listings:${listingId}`,
      relation: 'owner',
      subject,
      tenant: 'default' as const,
    });
    await perms.revoke(tuple(`user:${fromUserId}`));
    await perms.grant(tuple(`user:${toUserId}`));
    // Both revoke and grant are idempotent — safe to retry on failure.
  }
}
```

## Enforcing at the route

```ts
@Put('listings/:id')
@RequireRole('customer:seller')                          // coarse: must be a seller
@RequirePermission({                                      // fine: must own this listing
  namespace: 'listings',
  relation: 'edit',
  object: (req) => `listings:${req.params.id}`,
})
edit(@Param('id') id: string, @Body() body: EditListingDto) { /* … */ }
```

Both must pass (AND semantics). Deny on either surfaces as a 403 with a targeted audit event (`authz.role.deny` or `authz.permission.deny`) so dashboards can tell you exactly which gate fired.

## Dynamic object keys

The `object` resolver is a pure function of the request — it can pull from params, body, or headers. Use it for anything that's not a literal:

```ts
// From the URL path
object: (req) => `listings:${req.params.id}`

// From the body (for batch endpoints)
object: (req) => `listings:${req.body.listingId}`

// From a computed namespace
object: (req) => `tenant-${req.params.tenantId}:listings:${req.params.id}`

// Returning undefined triggers 400 Bad Request before Keto is called —
// useful for sanity-checking route shape.
object: (req) => req.params.id ? `listings:${req.params.id}` : undefined
```

The resolver must not do I/O — it runs synchronously inside the guard.

## Checking permissions inside services

Beyond the declarative guard, call `PermissionService.check` directly when logic depends on authorization state:

```ts
async canUserViewListing(user: IamIdentity, listingId: string): Promise<boolean> {
  return this.perms.forTenant('default').check({
    namespace: 'listings',
    object: `listings:${listingId}`,
    relation: 'view',
    subject: `user:${user.id}`,
    tenant: 'default',
  });
}
```

Use for: conditional UI rendering, filtering lists in memory, soft checks that shouldn't throw.

## Listing / auditing permissions

```ts
const { items } = await perms.forTenant('default').list({
  namespace: 'listings',
  subject: `user:${userId}`,
  tenant: 'default',
  // limit and pageToken also supported
});
```

Use for: admin tools that show "what can this user see?", bulk off-boarding, compliance reports.

## Combining roles and Keto into "capabilities"

If your consumers want to think in terms of capabilities rather than primitive checks, build a thin wrapper:

```ts
import { applyDecorators } from '@nestjs/common';
import { RequireRole, RequirePermission } from 'ory-nestjs';

// capabilities.ts
export const Capabilities = {
  CanEditListing: (listingId: string) =>
    applyDecorators(
      RequireRole('customer:seller'),
      RequirePermission({
        namespace: 'listings',
        relation: 'edit',
        object: () => `listings:${listingId}`,
      }),
    ),
  CanManageInternally: () =>
    applyDecorators(
      RequireRole('platform:admin', 'platform:support'),
    ),
};

// Usage
@Put('listings/:id')
@Capabilities.CanEditListing(':id')        // pseudo — real shape uses req.params in the resolver
edit() { /* … */ }
```

Keep these thin — they're ergonomic shortcuts, not another layer of abstraction. If a capability needs conditional logic beyond AND-ing decorators, write a custom guard instead.
