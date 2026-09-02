# nestjs-service-template

Template for a NestJS service at sklv-labs. Postgres via drizzle, zod-validated configuration,
OpenAPI docs, a health endpoint, and the layered module structure described below.

Create a repository from this one with **Use this template** on GitHub, or:

```bash
gh repo create sklv-labs/<service> --template sklv-labs/nestjs-service-template --private
```

## Running it

```bash
cp .env.example .env
docker compose up -d          # postgres on 5433
pnpm install
pnpm db:push                  # or: pnpm db:generate && pnpm db:migrate
pnpm start:dev
```

- API — http://localhost:3000/api/v1
- OpenAPI — http://localhost:3000/api/docs
- Health — http://localhost:3000/api/v1/health

Requires Node >= 24 and pnpm 11 (`corepack enable`).

## Module layout

Each feature is one directory with four layers. Dependencies point inward: `ui` → `operation` →
`service` → `domain`, and nothing points back out.

```
src/users/
├── domain/       tables, branded ids, domain types — no framework imports
├── service/
│   ├── abstracts/          the repository port, an abstract class
│   ├── users-repository/   the drizzle adapter implementing it
│   └── users-service/      business logic, depends on the port
├── operation/    use cases spanning several services; empty until one appears
└── ui/           controller and DTOs — the only layer that knows about HTTP
```

The port is an `abstract class` rather than an interface so it can be a DI token directly:

```ts
providers: [{ provide: UsersRepository, useClass: DrizzleUsersRepository }];
```

Swapping the adapter for a fake in a test needs no symbol and no module surgery.

DTOs are the outward boundary. `UserDto.from()` builds the response explicitly, which is what keeps
`passwordHash` out of it — returning entities directly is how that leaks.

## Adding a feature module

Copy `src/users/` and rename. Then register the module in `app.module.ts`, add the table to
`src/db/schema.ts`, and run `pnpm db:generate`.

Keep `domain/` free of `@nestjs/*` imports. It is the layer you will want to reuse or test without
booting Nest.

## Configuration

`src/config/env.schema.ts` extends `baseEnvSchema` from `@sklv-labs/nestjs-config`, which supplies
`NODE_ENV`, `PORT`, `HOST` and the npm package variables. Add your own keys there, then expose them
as grouped properties on `ConfigService` so callers never read `process.env` or an env key by name.

Use `z.coerce` for numbers — environment variables arrive as strings.

Validation runs once while `app.module.ts` is evaluated. A missing or malformed variable kills the
process at boot with every failing key listed, rather than surfacing on the first request.

## Database

drizzle with `casing: 'snake_case'`, so `passwordHash` in TypeScript is `password_hash` in
Postgres. Tables live in `<feature>/domain/schemas/*.schema.ts`; `drizzle.config.ts` globs them, so
a new table is picked up without registering it anywhere.

`primaryUuid()` in `src/db/columns.ts` is a branded UUID v7 primary key — time-ordered, so the
index does not fragment the way v4 does. `timestamps` supplies `created_at` and `updated_at`.

`pnpm db:push` is for local iteration. Use `db:generate` + `db:migrate` for anything shared.

## What is deliberately missing

The structured logger, error taxonomy, transaction propagation, CLS context and OpenAPI helpers
used to come from `@sklv-labs/ts-nestjs-*` packages. Those were retired, so this template uses the
framework directly: Nest's `Logger`, its built-in HTTP exceptions, `@nestjs/swagger` and
`@nestjs/terminus`.

Two consequences worth knowing:

- **No `@Transactional()`.** Use `db.transaction(tx => ...)` and pass the handle through.
- **No request-scoped context**, so log lines carry no correlation id.

Both are the seam to replace when those packages are rewritten.

`.oxlintrc.json` also disables `typescript/consistent-type-imports` locally. That belongs in
`@sklv-labs/dev-configs/oxlint/nestjs.json` and has been fixed there — drop the local override once
`dev-configs` > 0.2.0 is released.

## Container

```bash
docker build -t <service> .
docker run --rm -p 3000:3000 --env-file .env <service>
```

The image runs `node dist/main.js` rather than a package script, and installs with `--prod` in a
separate stage so devDependencies stay out of the runtime layer.

## License

MIT
