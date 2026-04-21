# Multi-tenancy

`ory-nestjs` supports multiple isolated Ory projects from a single service. This is useful for building multi-tenant SaaS applications where each tenant has its own identity pool and access control rules.

### Configuration

Define multiple tenants in the `IamModule` configuration. Tenants can freely mix Ory Cloud and self-hosted modes in the same deployment — pick per tenant based on where that tenant's Ory stack lives.

```ts
IamModule.forRoot({
  defaultTenant: 'customer',
  tenants: {
    // Ory Cloud tenant — URLs derived from projectSlug.
    customer: {
      mode: 'cloud',
      transport: 'cookie-or-bearer',
      trustProxy: true,
      cloud: {
        projectSlug: 'nifty-blackwell-thv46tbvh5',
        apiKey: process.env.ORY_CUSTOMER_API_KEY!,
      },
    },

    // Self-hosted tenant — explicit Kratos endpoints.
    admin: {
      mode: 'self-hosted',
      transport: 'cookie-or-bearer',
      trustProxy: true,
      kratos: {
        publicUrl: 'https://kratos-admin.internal',
        adminUrl: 'https://kratos-admin-api.internal',
        adminToken: process.env.KRATOS_ADMIN_TOKEN!,
      },
    },

    // Another Ory Cloud tenant on a different project.
    dealer: {
      mode: 'cloud',
      transport: 'bearer',
      cloud: {
        projectSlug: 'brave-bohr-abc123',
        apiKey: process.env.ORY_DEALER_API_KEY!,
      },
    },
  },
});
```

See [Module registration → Tenant config shape](./module-registration#tenant-config-shape) for the full list of per-tenant options.

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
