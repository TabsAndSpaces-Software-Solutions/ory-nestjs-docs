# Installation

```bash
pnpm add ory-nestjs
# peers (you almost certainly already have these):
pnpm add @nestjs/common @nestjs/core reflect-metadata rxjs
```

Node.js LTS + TypeScript strict mode are recommended. The package ships CommonJS with full `.d.ts` declarations; `@ory/client` is an internal dependency (not a peer) so consumer `package.json` files stay free of Ory.
