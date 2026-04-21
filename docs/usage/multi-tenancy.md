# Multi-tenancy

`ory-nestjs` supports multiple isolated Ory projects from a single service. This is useful for building multi-tenant SaaS applications where each tenant has its own identity pool and access control rules.

### Configuration

Define multiple tenants in the `IamModule` configuration:

```ts
IamModule.forRoot({
  defaultTenant: 'customer',
  tenants: {
    customer: { /* ... */ },
    admin: { /* ... */ },
    dealer: { /* ... */ },
  },
});
```

### Routing Requests

Use the `@Tenant()` decorator to scope a controller or route to a specific tenant:

```ts
@Controller('admin')
@Tenant('admin')
export class AdminController { /* ... */ }
```

### Cross-tenant calls

Services can be scoped to a specific tenant using the `.forTenant(name)` method:

```ts
@Injectable()
export class SupportService {
  constructor(private readonly identities: IdentityService) {}

  async getCustomer(id: string) {
    return this.identities.forTenant('customer').get(id);
  }
}
```
