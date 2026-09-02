# nestjs-service-template

A working NestJS 12 service used to work out the architecture for sklv-labs services. TypeScript 7,
oxlint, Vitest, pnpm 11, drizzle + Postgres.

**The architecture here is provisional.** Nothing in the layering is decided, and this repo is not
a template to generate services from. When asked to change the structure, change it — do not defend
the current shape on the grounds that it is the convention, because it is not one yet. The open
questions are listed in the README; if a change settles one, update that list.

What follows is a description of how the code currently works, not a rulebook.

## Current layering

One directory per feature, four layers, dependencies pointing inward:
`ui` → `operation` → `service` → `domain`.

`domain/` currently has no `@nestjs/*` imports. `operation/` is a pass-through with no use cases in
it. The repository port is an `abstract class` so it doubles as a DI token, and there is exactly one
adapter. Whether any of that is worth keeping is an open question — see the README.

The `users` feature is a specimen for judging the layering, not a reference to copy verbatim. It
has a deliberate placeholder: the controller passes a raw password through as `passwordHash`,
standing in for a hashing decision that has not been made.

## Mechanical constraints — these are not stylistic

These are runtime facts, and they hold whatever the architecture turns into.

**`import './bootstrap-env'` must stay the first import in `main.ts`.** TypeScript compiles imports
to `require` calls in source order, so that side-effect import is what guarantees `.env` is loaded
before `app.module.ts` is evaluated — and `ConfigModule.forRoot` validates `process.env` during
that evaluation. Reordering it, or converting it to a dynamic import, breaks boot. Its
`no-unassigned-import` suppression is deliberate.

**`typescript/consistent-type-imports` is off.** Nest reads constructor parameter types from
`design:paramtypes` at runtime, and `ValidationPipe` needs the DTO class itself for class-validator.
The rule sees injected classes and DTOs as type-only, and its fix erases the metadata — dependency
injection and request validation break with no compile error.

**Anything injected under a symbol needs `@Inject`.** `DRIZZLE` and `PG_POOL` are symbols, so
`constructor(@Inject(PG_POOL) private pool: Pool)`. A bare `Pool` parameter fails at boot with
`Nest can't resolve dependencies`.

**The dev loop is `tsc --watch` plus `node --watch`,** not tsx or `@swc-node/register`. esbuild does
not emit decorator metadata, which breaks Nest DI, and `@swc-node/register` declares
`typescript@< 7`.

**`allowBuilds` in `pnpm-workspace.yaml` must list `esbuild`.** pnpm 10+ skips dependency build
scripts, and without it Vitest and drizzle-kit have no binary.

**`typescript-editor` is an alias for typescript@6, for editors only.** TypeScript 7 ships no
tsserver, so Zed's vtsls cannot drive it; `.zed/settings.json` points `tsdk` at the alias. The build
uses typescript@7. Remove both once the editor supports TS 7.

There is no `nest-cli.json`, and no path aliases — plain tsc does not rewrite them at runtime.

## Database

Tables live in `<feature>/domain/schemas/*.schema.ts` and are globbed by `drizzle.config.ts`.

`casing: 'snake_case'` is set in both the drizzle client and the kit config. Both must agree, or
generated SQL will not match the queries.

`db:push` is local-only. Shared environments get `db:generate` + `db:migrate`.

There is no `@Transactional()` — that lived in a retired package. Use `db.transaction(tx => ...)`.

## Writing

Conventional Commits, enforced by commitlint. Prose is plain — no emoji, no feature bullets.
Comments explain why, not what.
