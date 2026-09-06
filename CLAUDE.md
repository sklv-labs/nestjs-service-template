# nestjs-service-template

A working NestJS 12 service used to work out the architecture for sklv-labs services. TypeScript 7,
oxlint, Vitest, pnpm 11, drizzle + Postgres.

**The architecture here is provisional.** Nothing in the layering is decided, and this repo is not
a template to generate services from. When asked to change the structure, change it — do not defend
the current shape on the grounds that it is the convention, because it is not one yet. The open
questions are listed in the README; if a change settles one, update that list.

What follows is a description of how the code currently works, not a rulebook.

## Core components in shared/

Fastify only. Nothing in `shared/` imports Fastify or Express types — middleware types against
Node's `IncomingMessage`, filters reply through `HttpAdapterHost`.

**`shared/cls`** wraps `nestjs-cls`. The wrapper exists to add three things the library does not do:
an inbound `x-request-id` becomes the context id, that id is echoed on the response, and ids are on
by default because `cls.getId()` is what the logger reads. **The store stays empty** — anything an
app wants in it goes through the `setup` option and its shape is the app's own `ClsStore`. Never add
a field to the store from inside the package.

**`shared/logger`** is pino. The design rule is what happens _per line_: one property merge, nothing
else. Static fields (`service`, `env`, `version`) live in pino's bindings, bound once. A class
context is a **child logger created once** by `logger.forContext(name)`. Never reintroduce
stack-trace inspection to guess the calling class, a context object rebuilt per call, or per-key
validation — that is what made the retired logger slow.

Inject it as a property, never with a constructor and never `new Logger()` from `@nestjs/common`:

```ts
@Injectable()
export class UsersService {
  @InjectLogger() private readonly logger: Logger;
}
```

No `!` is needed — the NestJS tsconfig preset sets `strictPropertyInitialization: false`, because
DI assigns the property. `Logger` is the class-bound logger application code injects; `LoggerService`
is the root, used only by `app.useLogger()` and as the factory behind the decorator.

The context comes from Nest's `INQUIRER` token, so a class never names itself. The provider is
`Scope.TRANSIENT`, which gives each consumer its own child logger at bootstrap — one per class, not
per request, and transient does not bubble, so consumers stay singletons. `new Logger(Name)` works
only because `app.useLogger` reroutes Nest's static logger, and it is untestable.

`src/logger.ts` holds the single pino instance as a module-level const, because Fastify needs it
before Nest exists (`loggerInstance` is an adapter option). `LoggerModule.forRoot({ instance })`
then reuses it, so the framework's access log and application logs share one stream, one format and
one redaction policy. Do not let `LoggerModule` build a second instance.

The correlation field is `reqId`, matching Fastify's own. Fastify's `requestIdLogLabel` could rename
its side instead, but it is deprecated and removed in Fastify 6. It is configurable via
`requestIdKey`.

**Two exception filters, both narrow.** `DomainExceptionFilter` is `@Catch(DomainError)`;
`UnhandledExceptionFilter` is `@Catch()` and logs the real cause while returning a body that reveals
no internals. A single catch-all would silently take over Nest's `HttpException` handling. They are
registered as `APP_FILTER` in `shared/http/http.module.ts`, so they get DI.

**Request logging is a Fastify `onResponse` hook**, not a Nest interceptor — so it also covers
requests Nest never routes (404s, malformed bodies, plugin rejections), which is where detail is
most wanted. Fastify's own two-line access log is turned off via `disableRequestLogging` in favour
of one detailed line per request carrying method, url, headers, query, params, status and duration.

**Bodies are logged only when `LOG_REQUEST_BODY=true`,** and redaction is the only thing between
that and credentials sitting in log storage permanently. Redaction paths must match the _logged
shape_, not the bare field name — pino matches paths and `*.password` covers one level, so request
logging needs `req.body.password` spelled out. **Adding a secret-bearing field to a contract means
adding a redact path.** Nothing can un-log a value.

Bodies over `maxBodyBytes` (4096) are replaced with a marker; the `ignore` predicate uses substring
matching, because a global prefix turns `/health` into `/api/v1/health` and a prefix check silently
stops ignoring it.

Expected failures log at **debug**, bugs at **error**. A 409 is the system working.

## Operation layer

`<feature>/operation/*.handler.ts` — one handler per scenario, implementing
`Handler<Input, Output>`. A handler must not import from `ui/`, must not know about HTTP status
codes or message envelopes, and must not receive a request object. Input and output are plain
types, not schemas: a handler runs inside the trust boundary, so re-validating what a transport
already parsed is wasted work.

Transports never orchestrate. A controller method validates, calls `endpoint.toInput(...)`,
executes the handler, and calls `endpoint.toResponse(...)`. If a controller contains an `if` about
business state, it belongs in a handler or a service.

## UI layer is transport-shaped

`ui/http/` holds the HTTP contracts; `ui/rmq/` and `ui/queue/` belong beside it. Contracts are not
a layer — they describe a boundary and belong to the transport that owns it. Do not reintroduce a
top-level `contracts/` directory per feature.

An endpoint is described once in `ui/http/endpoints/<name>.ts` as a plain object passed to
`endpoint({ … })`: `summary`, `request`, `toInput`, `toResponse`, `success`, `errors`.

`success` is its own field, not an entry in a response array. It is the contract of the handler's
output, which is what lets `toResponse` be typed `z.input<S>` — a mapper that stops matching the
contract is a compile error, not a runtime 500. Its schema must be a `ZodObject`, because the
serializer skips anything that is not a non-null object. Controllers read
schemas, types and docs from it via `UseEndpoint`, `ReqBody`/`ReqQuery`/`ReqParams`/`ReqHeaders`
and `BodyOf`/`QueryOf`/`ParamsOf`/`HeadersOf`. Do not inline a zod schema in a controller or repeat
one in an `@Api*` decorator.

`UseEndpoint` applies the documentation **and** derives `@SerializeOptions` and `@HttpCode` from the
endpoint's success response — the first 2xx entry in `responses`. A handler therefore carries two
decorators: the route and `UseEndpoint`. Never restate the response schema or the status on the
controller; that is how they drift. Declaring more than one 2xx response makes the choice
ambiguous, and the first wins.

A builder-chain version of this was tried and reverted: it accumulates a generic per call, which
forces `declaration: false` (TS7056 — inferred type exceeds what the compiler will serialize) and
needs type extraction routed around its own type parameters. Do not reintroduce it.

`httpError` generates an example per reason from the error declaration, so never hand-write them.
Hoist shared ones into `ui/http/error-responses.ts` and reference them — `httpError()` returns a
plain value, so two endpoints raising the same error restate nothing.

**Error statuses are registered at boot, not at import.** `UseEndpoint` attaches the endpoint as
route metadata and `EndpointScanner` walks every mounted controller on `onApplicationBootstrap` to
build the code→status map. It also warns, naming them, about business errors no endpoint documents
— those return 500 if raised over HTTP. Do not reintroduce registration as an import side effect:
it made the map process-global and dependent on module evaluation order.

**Name every shared contract** with `.meta({ id: 'User' })`. Zod emits `$ref` + `definitions`, which
Nest hoists into `components.schemas`; without an id the shape is inlined at every endpoint that
uses it. `businessErrorResponse` and `paginated` name theirs too, because `.extend()` and wrapper
helpers produce new anonymous schemas. Request bodies stay inlined — `@ApiBody` takes a raw schema,
not a standard schema, so there is no hoisting path for them.

Use the field builders in `shared/contracts/fields.ts` (`id`, `email`, `str`, `int`, `bool`,
`isoDate`, `oneOf`) rather than raw zod in contracts. The description is the first argument. Request
parts use `req.body` / `req.query` / `req.params` / `req.headers`; the namespace exists so the
builders do not collide with the part names `toInput` destructures.

**Examples belong on the field**, via the builders' `example` option. Zod emits them into the JSON
Schema, so OpenAPI composes request and response examples from the fields — one definition, sitting
next to the type and constraints it has to agree with. Do not write a whole-object example next to
a schema that already has per-field ones; that is a second copy waiting to drift.

The whole-object `example` on `success()` and `request` is for a _scenario_ per-field examples
cannot express — a pending resource shown beside a completed one. `success()` type-checks it against
the schema; `request.example` does not.

Every endpoint declares `toInput` and `toResponse`. They are the only place a transport shape meets
an operation shape; do not map fields inside a controller.

Business error messages live on the reason declaration in `<feature>/domain/*.errors.ts`, so
`raise(reason, details)` takes no message. Adding a reason is not a breaking change; adding a code
is.

Business errors are declared in `<feature>/domain/*.errors.ts` via `businessError` and carry no HTTP
status. `httpError(status, error, …)` in an endpoint both documents the response and registers the
code→status mapping the `DomainErrorFilter` uses, so the two cannot drift. Services `throw
SomeError.raise(reason, details)` — never an `HttpException`.

An error raised with no endpoint documenting it degrades to a 500 with a logged warning. Because
`httpError` returns a plain value, hoist shared ones into a module-level const and reuse them across
endpoints rather than repeating the status, example and description.

## Current layering

One directory per feature, four layers, dependencies pointing inward:
`ui` → `operation` → `service` → `domain`.

`domain/` currently has no `@nestjs/*` imports. `operation/` is a pass-through with no use cases in
it. The repository port is an `abstract class` so it doubles as a DI token, and there is exactly one
adapter. Whether any of that is worth keeping is an open question — see the README.

The `users` feature is a specimen for judging the layering, not a reference to copy verbatim. It
has a deliberate placeholder: the controller passes a raw password through as `passwordHash`,
standing in for a hashing decision that has not been made.

## Schema contracts

The UI layer uses Zod schemas as contracts, one per boundary, projected as runtime validation
(`@Body({ schema })` + `StandardSchemaValidationPipe`), TypeScript types (`z.infer`) and OpenAPI
(Nest reads `~standard.jsonSchema` — no converter needed). There are no DTO classes and no
class-validator. The reasoning is in
[the guideline](https://github.com/sklv-labs/guidelines/blob/main/ts/patterns/schema-contracts.md).

Constraints that will bite if you forget them:

- **`z.date()` throws** during OpenAPI generation. Boundary timestamps are `z.iso.datetime()`.
- **`.transform()` breaks the output projection**, so it is safe on request contracts and fatal on
  response contracts. Branded ids therefore use the `brandedUuid()` cast in `src/contracts/branded.ts`,
  not `.transform(asUuid)`.
- **`z.infer` is the output type.** Request examples must be typed `z.input`.
- **Error responses skip the serializer**, so `DomainExceptionFilter` parses its own body against
  the documented contract and logs on mismatch. That is the only place an error contract can be
  enforced rather than merely asserted.
- **`@ApiBody` needs a raw schema** via `openApiSchema(...)`; `@ApiResponse` takes `standardSchema`.
- **`ApiHeaders` builds its own parameter object and ignores the contract.** Without an explicit
  `schema: openApiSchema(field, 'input')` every header documents as a bare string, losing its
  constraints and example. Path and query params do not need this — Nest derives those from the
  `@Param`/`@Query` schema metadata.
- **Response validation stops at non-objects.** A handler returning a primitive or `null` bypasses
  the serializer, so the contract is not enforced — while the documentation still claims it. Always
  return an object; raise a domain error instead of returning `null`.
- **For a handler returning a top-level array, the serialization schema is the ITEM contract.** The
  interceptor maps over the array and validates each element against the schema it was given, so
  `z.array(item)` makes every item get checked against an array contract and fails with a 500.
- **`@Headers` cannot take a schema.** Only `Body`, `Param`, `Query` and `RawBody` do. Header
  contracts ride on a custom param decorator, which requires
  `validateCustomDecorators: true` on the pipe — remove that and header validation silently stops.
- **A method returning `never` does not narrow control flow.** `businessError().raise()` therefore
  returns the error and the caller writes `throw`.
- **Nest's context heuristic must not leak into our own logger API.** Nest passes context as a
  trailing string, so `Logger` strips it. `ContextLogger` must not — its context is already bound,
  and stripping there swallows the message of `log(fields, 'message')`.
- **Do not declare `fastify` as a direct dependency.** `@nestjs/platform-fastify` resolves its own,
  and two copies make `@fastify/helmet`'s peer types disagree with the app's.
- **Swagger on Fastify needs `@fastify/static`**, or docs fail at boot with a PackageLoader error.
- **`npm_package_*` are absent under `node dist/main.js`.** Service identity comes from
  `SERVICE_NAME` / `SERVICE_VERSION`, which is what a container sets.
- **Type examples as `z.input`, not `z.infer`.** Examples are wire JSON, and a branded id's input
  type is a plain string — `z.infer` would demand a cast in every example.
- **`BusinessError` is not usable as a parameter type.** `raise` accepts only that error's own
  reasons, so a specific error is not assignable to a wider one. Anything that documents rather
  than raises takes `BusinessErrorShape`, which drops `raise`.
- Strictness lives in the schema (`.strict()`), not in pipe options.

## Never touch .env

`.env` is the developer's own file: gitignored, untracked, and holding real local values. Do not
create it, copy over it, edit it, or delete it — there is no way to recover what was there.

To run the service while testing, pass the environment inline instead; `dotenv` does not override
variables already present in `process.env`, so this composes with an existing `.env`:

```bash
LOG_JSON=true node dist/main.js
```

If a run genuinely needs a full environment and none exists, use a throwaway path and point at it
explicitly rather than writing `.env`.

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
