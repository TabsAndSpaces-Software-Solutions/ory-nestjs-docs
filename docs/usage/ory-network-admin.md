---
sidebar_position: 14
---

# Ory Network admin

For Ory Cloud deployments, `ory-nestjs` exposes the control-plane APIs at `api.console.ory.sh` — project, workspace, and event-stream admin. Use these to automate tenant provisioning, rotate keys, or wire event forwarding.

:::note
These services are **only available in cloud mode** and need a workspace-scoped API key (distinct from the project API key). Self-hosted tenants get `IamConfigurationError`.
:::

## Tenant config

```ts
IamModule.forRoot({
  tenants: {
    default: {
      mode: 'cloud',
      transport: 'cookie-or-bearer',
      cloud: {
        projectSlug: process.env.ORY_PROJECT_SLUG!,
        apiKey: process.env.ORY_PROJECT_API_KEY!,        // data plane
        workspaceApiKey: process.env.ORY_WORKSPACE_KEY!, // control plane
      },
    },
  },
});
```

`apiKey` scopes to one project's data (Kratos/Keto/Hydra). `workspaceApiKey` scopes to the workspace and lets you manage projects themselves.

## Projects

```ts
import { ProjectAdminService } from 'ory-nestjs';

@Injectable()
export class Onboarding {
  constructor(private readonly projects: ProjectAdminService) {}

  async provision(customerName: string, workspaceId: string) {
    const project = await this.projects.forTenant('default').create({
      name: customerName,
      workspaceId,
    });
    return project.id;
  }

  async listForWorkspace() {
    return this.projects.forTenant('default').list();
  }

  async decommission(id: string) {
    await this.projects.forTenant('default').purge(id); // async, hard delete
  }
}
```

### Project API keys

```ts
const key = await this.projects.forTenant('default').createApiKey(projectId, {
  name: 'ci-deploy-2026',
});
// key.value is returned ONCE — store securely.

await this.projects.forTenant('default').deleteApiKey(projectId, key.id);
```

### Members

```ts
const members = await this.projects.forTenant('default').listMembers(projectId);
```

## Workspaces

```ts
import { WorkspaceAdminService } from 'ory-nestjs';

const ws = await this.workspaces.forTenant('default').create({ name: 'prod-eu' });

await this.workspaces.forTenant('default').update(ws.id, {
  name: 'prod-eu-frankfurt',
});

const projects = await this.workspaces
  .forTenant('default')
  .listProjects(ws.id);
```

Workspace API keys follow the same shape as project API keys (`createApiKey` / `listApiKeys` / `deleteApiKey`).

## Event streams

Ory Network can forward identity + authorization events to a consumer-owned sink (AWS SNS, etc.):

```ts
import { EventsService } from 'ory-nestjs';

await this.events.forTenant('default').create(projectId, {
  type: 'sns',
  topicArn: 'arn:aws:sns:us-east-1:123456789012:ory-events',
  roleArn: 'arn:aws:iam::123456789012:role/ory-events-publisher',
});

const streams = await this.events.forTenant('default').list(projectId);
```

Keep at most a couple of streams per project — downstream aggregation is cheaper than running parallel consumers on the Ory side.

## Purge semantics

`purge(id)` is **asynchronous and irreversible** once it reaches the platform. The call returns when Ory accepts the request; actual teardown happens in the background. Guard this behind an interactive confirmation in any operator tool — there is no undo.
