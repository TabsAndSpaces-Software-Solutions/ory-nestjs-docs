# Authorization

There are two independent mechanisms, and you will usually use both.

### 1. Role-based (in-memory)

Roles live on the identity itself, in one of two places:

1. `metadataPublic.roles: string[]` — admin-set, trusted, preferred.
2. `traits.roles: string[]` — self-serve-settable, only use for low-risk roles.

`metadataPublic.roles` wins when both are present.

```ts
@Get('/admin/users')
@Tenant('default')
@RequireRole('admin', 'support')   // admin OR support passes
listUsers() { /* … */ }
```

No network call, no Keto dependency — role checks are a pure function of the identity already on the request.

### 2. Relationship-based (Keto)

For data-scoped checks (can user X edit listing Y?), use `@RequirePermission`:

```ts
@Put('/listings/:id')
@RequirePermission({
  namespace: 'listings',
  relation: 'edit',
  object: (req) => `listings:${req.params.id}`,   // pure function, no I/O
})
updateListing(@Param('id') id: string) { /* … */ }
```

Under the hood the guard calls Keto's `checkPermission` with `subject = 'user:' + user.id`. Keto answers with a `CheckPermissionResult` wrapped in an Axios response (`response.data.allowed`); `false` → 403. The library unwraps that for you — your handler never sees the Axios envelope.

### When to use which

| Decision | Use roles | Use Keto permissions |
|---|---|---|
| Check is global to the service | ✅ | |
| Check depends on a specific object id | | ✅ |
| Role set is small and stable | ✅ | |
| Relationships are dynamic (ownership, sharing) | | ✅ |
| You need an audit trail of grants/revokes | | ✅ |

### Batch checks

When a list endpoint needs to filter rows by permission, fan out in a single call rather than N guard invocations:

```ts
const results = await this.perms.forTenant('default').checkBatch([
  { namespace: 'listings', object: 'listings:1', relation: 'view', subject: `user:${userId}`, tenant: 'default' },
  { namespace: 'listings', object: 'listings:2', relation: 'view', subject: `user:${userId}`, tenant: 'default' },
  { namespace: 'listings', object: 'listings:3', relation: 'view', subject: `user:${userId}`, tenant: 'default' },
]);
// results: [{ tuple, allowed }, { tuple, allowed, error? }, ...]
```

Each check runs concurrently; per-tuple upstream errors surface as `error` rather than failing the whole batch.

### Subject-tree expansion

Answer "who can access X" questions with `expand`:

```ts
const tree = await this.perms.forTenant('default').expand({
  namespace: 'listings',
  object: 'listings:42',
  relation: 'view',
  maxDepth: 3,
});
// tree.root.type === 'union' | 'leaf' | ...
// Walk tree.root.children to collect all subjects with the relation.
```

Use for admin tools, compliance reports, and off-boarding audits — don't put this on a hot request path.
