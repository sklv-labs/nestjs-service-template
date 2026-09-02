# nestjs-service-template

NestJS 12 service template. TypeScript 7, oxlint, Vitest, pnpm 11, drizzle + Postgres.

Repositories generated from this one inherit this file — keep it about the architecture, not about
this repository being a template.

## Layers

One directory per feature, four layers, dependencies pointing inward only:
`ui` → `operation` → `service` → `domain`.

`domain/` must not import `@nestjs/*`. If something there needs a framework decorator, it belongs
in `service/`.

The repository port is an `abstract class`, not an interface, so it doubles as a DI token. Do not
replace it with an interface plus a symbol — that adds a token to maintain and buys nothing.

Controllers depend on `operation/`, never directly on `service/`, even while `operation/` is a
pass-through. That is the seam use cases land in later.

Never return an entity from a controller. `UserDto.from()` exists so `passwordHash` cannot leak
by omission.

## Do not "fix" these

**`import './bootstrap-env'` must stay the first import in `main.ts`.** TypeScript compiles imports
to `require` calls in source order, so that side-effect import is what guarantees `.env` is loaded
before `app.module.ts` is evaluated — and `ConfigModule.forRoot` validates `process.env` during
that evaluation. Reordering it, or converting it to a dynamic import, breaks boot. Its
`no-unassigned-import` suppression is deliberate.

**`typescript/consistent-type-imports` is off.** Nest reads constructor parameter types from
`design:paramtypes` at runtime, and `ValidationPipe` needs the DTO class itself for class-validator.
The rule sees injected classes and DTOs as type-only and its fix erases the metadata — dependency
injection and request validation break with no compile error.

**Anything injected under a symbol needs `@Inject`.** `DRIZZLE` and `PG_POOL` are symbols, so
`constructor(@Inject(PG_POOL) private pool: Pool)`. A bare `Pool` parameter fails at boot with
`Nest can't resolve dependencies`.

## Toolchain

The dev loop is `tsc --watch` plus `node --watch`, not tsx or `@swc-node/register`. esbuild does
not emit decorator metadata, which breaks Nest DI, and `@swc-node/register` declares
`typescript@< 7`. Do not switch the watcher to either.

There is no `nest-cli.json`. `nest build` and `nest start` are replaced by `tsc` and the scripts in
`package.json`.

No path aliases. Plain tsc does not rewrite them at runtime, and adding `tsc-alias` or a loader to
get `@/` back is not worth it — use relative imports.

`pnpm-workspace.yaml` exists only for pnpm 10+ settings: `allowBuilds` must list `esbuild` or
Vitest and drizzle-kit get no binary.

## Database

Tables live in `<feature>/domain/schemas/*.schema.ts` and are globbed by `drizzle.config.ts`; a new
table needs no registration beyond `src/db/schema.ts`.

`casing: 'snake_case'` is set in both the drizzle client and the kit config. Both must agree, or
generated SQL will not match the queries.

Use `primaryUuid()` and `timestamps` from `src/db/columns.ts` for new tables.

`db:push` is local-only. Shared environments get `db:generate` + `db:migrate`.

There is no `@Transactional()` — that lived in a retired package. Use `db.transaction(tx => ...)`.

## Writing

Conventional Commits, enforced by commitlint. READMEs and comments are plain prose — no emoji, no
feature bullets. Comments explain why, not what.
