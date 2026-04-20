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

Under the hood the guard calls Keto's `checkPermission` with `subject = 'user:' + user.id`. Keto returns `{ allowed: boolean }`; `false` → 403.

### When to use which

| Decision | Use roles | Use Keto permissions |
|---|---|---|
| Check is global to the service | ✅ | |
| Check depends on a specific object id | | ✅ |
| Role set is small and stable | ✅ | |
| Relationships are dynamic (ownership, sharing) | | ✅ |
| You need an audit trail of grants/revokes | | ✅ |
