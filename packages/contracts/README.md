# @pricectrl/contracts

Shared kernel for PriceCtrl: Zod schemas + inferred TypeScript types + permissions registry. Consumed by `apps/backend` and `apps/frontend` via pnpm workspace protocol.

## Subpath exports

```ts
import { /* types */ } from '@pricectrl/contracts';
import { /* priceCheck schemas */ } from '@pricectrl/contracts/priceCheck';
import { permissionsForRole, uiPermissionsForRole } from '@pricectrl/contracts/permissions';
```

## Usage from another workspace package

`package.json`:
```json
{
  "dependencies": {
    "@pricectrl/contracts": "workspace:*"
  }
}
```

No publish, no registry. Monorepo-internal only.

## Scripts

```bash
pnpm --filter @pricectrl/contracts build       # tsc → dist/
pnpm --filter @pricectrl/contracts watch       # tsc --watch
pnpm --filter @pricectrl/contracts typecheck   # tsc --noEmit
pnpm --filter @pricectrl/contracts test        # vitest
```
