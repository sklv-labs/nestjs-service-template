# nestjs-service-template

A working NestJS 12 service used to try out the architecture and conventions for sklv-labs
services. Nothing here is settled — the layering, the module boundaries and the rules below are
what is currently being evaluated, and they are expected to change.

This is **not** a template to generate services from yet. Read it, run it, argue with it.

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

## Current shape

One directory per feature, four layers, dependencies pointing inward.

```
src/shared/            reusable across features
├── contracts/         field builders (id, email, str, int, bool, isoDate), pagination
├── errors/            DomainError + businessError declaration
├── operation/         Handler interface
└── http/              endpoint descriptor, request builders, error filter
src/users/
├── domain/            table, branded id, business errors — no framework, no HTTP
├── service/           port, in-memory adapter, business rules
├── operation/         handlers — one scenario each, transport-agnostic
├── ui/
│   └── http/          contracts live *inside* the transport that uses them
│       ├── endpoints/ one file per endpoint: headers, params, query, body, responses
│       ├── responses.ts   base response, composed and extended
│       └── users.controller.ts
└── users.module.ts
```

The UI layer is organised by transport, not by concern. `ui/http/` holds the HTTP contracts;
`ui/rmq/` and `ui/queue/` would sit beside it with their own message contracts. Contracts are not a
layer of their own — they describe a boundary, so they belong to the transport that owns it.

The **operation layer** is where a request is actually handled. One handler per scenario, taking an
input and returning an output, with no knowledge of headers, status codes or message envelopes:

```ts
export type CreateUserInput = { email: string; password: string; correlationId?: string };
export type CreateUserOutput = { user: UserRow };

export class CreateUserHandler implements Handler<CreateUserInput, CreateUserOutput> { … }
```

Each endpoint is described in one object, and owns the translation in both directions:

```ts
export const createUser = endpoint({
  summary: 'Register a user',
  description: 'Validates the body, then applies registration rules.',

  request: {
    headers: req.headers({ 'x-request-id': str('Correlation id, echoed in logs').optional() }),
    body: req.body({
      email: email("The user's primary email address"),
      password: str('Plaintext password, at least 12 characters', { min: 12, max: 256 }),
    }),
    example: { email: 'alex@example.com', password: 'correct-horse-battery-staple' },
  },

  toInput: ({ body, headers }): CreateUserInput => ({ … }),
  toResponse: (out: CreateUserOutput) => toUserResponse(out.user),

  responses: [
    success(201, userResponse, 'User registered', { … }),
    failure(400, 'Body failed contract validation'),
    httpError(409, UserRegistrationFailed, { email: 'alex@example.com' }, 'Registration refused'),
  ],
});
```

`httpError` does three things from one line: documents the response, registers the code→status
mapping the filter uses, and generates one named example per reason using the messages declared on
the business error. Nothing about a reason is written twice.

An RMQ consumer for the same scenario writes its own `toInput` from a message envelope and reuses
the handler untouched.

The `users` feature is a specimen, not a reference implementation. It exists to make the layering
concrete enough to judge, and it is wired to the in-memory repository so it runs with no database.

Its UI layer is built on **schema contracts**: one Zod schema per boundary, projected as runtime
validation, a TypeScript type and OpenAPI. There are no DTO classes and no class-validator.

Each endpoint is described once, in one file — headers, params, query, body, and every response it
can produce. The controller derives its decorators, parameter schemas, handler types and OpenAPI
document from that descriptor:

```ts
@Post()
@ApiEndpoint(createUser)
@SerializeOptions({ schema: userResponse })
async create(
  @ReqBody(createUser) body: BodyOf<typeof createUser>,
  @ReqHeaders(createUser) headers: HeadersOf<typeof createUser>,
) { … }
```

See [the guideline](https://github.com/sklv-labs/guidelines/blob/main/ts/patterns/schema-contracts.md)
for the reasoning and the constraints that shape it.

The port is an `abstract class` rather than an interface so it can be a DI token directly:

```ts
providers: [{ provide: UsersRepository, useClass: DrizzleUsersRepository }];
```

`@SerializeOptions({ schema: userResponse })` is what keeps `passwordHash` out of responses: Zod
strips keys the contract does not name, so the omission is enforced rather than remembered.

Business errors are declared in `domain/users.errors.ts` with a stable code, a set of reasons and a
details shape — and no HTTP status, because that is a transport decision. The endpoint that
documents an error is also what maps its code to a status, so the documented status and the one the
filter returns cannot disagree.

## Open questions

Things worth resolving before any of this hardens into a template:

- The handlers are thin — most are one service call. That is the intended seam for a welcome
  email, a `UserRegistered` event, or provisioning, but until one of those exists the layer is
  mostly indirection. Worth keeping only if those arrive.
- Should `UsersService` survive now that handlers exist? Its rules could move into the handlers,
  leaving `service/` as just the repository port.
- Where does password hashing belong? The controller currently passes the raw value into
  `UsersService.create` as `passwordHash`, which is wrong on purpose — a placeholder for the
  decision.
- Should error responses go through an exception filter that parses them against their contract?
  Today error schemas document and type the shape but do not enforce it, because exceptions bypass
  the serializer.
- Is `toResponse` worth keeping now that the response schema strips fields anyway, or is the
  explicit mapper still the clearer place to convert `Date` to ISO?
- Does the port/adapter split earn itself when there is exactly one adapter?
- Should `domain/` own the drizzle table definitions, or is that infrastructure leaking inward?

## Configuration

`src/config/env.schema.ts` extends `baseEnvSchema` from `@sklv-labs/nestjs-config`, which supplies
`NODE_ENV`, `PORT`, `HOST` and the npm package variables. Add keys there, then expose them as
grouped properties on `ConfigService` so callers never read `process.env` directly.

Use `z.coerce` for numbers — environment variables arrive as strings.

Validation runs once while `app.module.ts` is evaluated. A missing or malformed variable kills the
process at boot with every failing key listed, rather than surfacing on the first request.

## Database

drizzle with `casing: 'snake_case'`, so `passwordHash` in TypeScript is `password_hash` in
Postgres. Tables live in `<feature>/domain/schemas/*.schema.ts`; `drizzle.config.ts` globs them.

`primaryUuid()` in `src/db/columns.ts` is a branded UUID v7 primary key — time-ordered, so the
index does not fragment the way v4 does. `timestamps` supplies `created_at` and `updated_at`.

`pnpm db:push` is for local iteration. Use `db:generate` + `db:migrate` for anything shared.

## What is missing, and why

The structured logger, error taxonomy, transaction propagation, CLS context and OpenAPI helpers
used to come from `@sklv-labs/ts-nestjs-*` packages. Those were retired, so this uses the framework
directly: Nest's `Logger`, its built-in HTTP exceptions, `@nestjs/swagger` and `@nestjs/terminus`.

Two consequences:

- **No `@Transactional()`.** Use `db.transaction(tx => ...)` and pass the handle through.
- **No request-scoped context**, so log lines carry no correlation id.

Both are seams for the rewritten packages, and how they land will change the shape here.

`typescript/consistent-type-imports` is disabled in `@sklv-labs/dev-configs/oxlint/nestjs.json`,
because Nest reads constructor parameter types from `design:paramtypes` at runtime and the rule's
fix erases that metadata.

## Container

```bash
docker build -t service .
docker run --rm -p 3000:3000 --env-file .env service
```

The image runs `node dist/main.js` rather than a package script, and installs with `--prod` in a
separate stage so devDependencies stay out of the runtime layer.

## License

MIT
