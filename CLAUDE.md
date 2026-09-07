# nestjs-service-template

A working NestJS 12 service used to work out the architecture for sklv-labs services. TypeScript 7,
oxlint, Vitest, pnpm 11, drizzle + Postgres.

**The architecture here is provisional.** Nothing in the layering is decided, and this repo is not
a template to generate services from. When asked to change the structure, change it — do not defend
the current shape on the grounds that it is the convention, because it is not one yet. The open
questions are listed in the README; if a change settles one, update that list.

What follows is a description of how the code currently works, not a rulebook.

## The shared runtime code is a package, not a folder

It lives in `packages/nestjs-core` as `@sklv-labs/nestjs-core`, consumed over `workspace:*` through
an exports map with no root export — `@sklv-labs/nestjs-core/logger`, `/http`, `/cls` and so on.
Deep imports past those subpaths do not resolve, so the surface is the map rather than the file
tree. Migrating it to sklv-labs/ts is then a directory move plus a published version range.

Consequences that are easy to get wrong:

- **Never import from the service inside the package.** No `src/config`, no reading this service's
  `package.json`. Composition — anything that reads the environment — stays in `src/`, which is why
  the pino instance lives in `src/config/logger.ts` while `createLogger` is exported by the package.
- **New dependencies go in the package's own manifest**, as a peer plus a devDependency. A runtime
  library the consumer must share a single copy of (`nestjs-cls`, `pino`, `zod`, NestJS itself) is
  always a peer: two copies of `nestjs-cls` means two async local storages and an empty context.
- **`tsc -b`, not `tsc`.** Project references build the package first; the service then compiles
  against `dist/*.d.ts` like any installed consumer. `type-check` is `tsc -b --force`, because
  `--noEmit` is rejected for composite projects (TS6304/TS6310) and a plain `tsc -b` silently
  short-circuits when everything is up to date.
- **A new package needs its manifest copied in the Dockerfile.** `node_modules/@sklv-labs/*` is a
  symlink into `packages/`, so the image needs each package's `package.json` and `dist` or the
  service will not boot.

Fastify only. Nothing in the package imports Fastify or Express types — middleware types against
Node's `IncomingMessage`, filters reply through `HttpAdapterHost`.

**`cls`** wraps `nestjs-cls`. The wrapper exists to add what the library does not do: an
inbound `x-request-id` becomes the context id, that id is echoed on the response, ids are on by
default because the logger and the error filters read them, and `RequestContext` makes the context
readable without repeating its guards. **The store stays empty** — anything an app wants in it goes
through the `setup` option and its shape is the app's own `ClsStore`. Never add a field to the store
from inside the package.

**The correlation id policy lives in `cls/correlation-id.ts`, never at a call site.** Which
header carries it, which inbound values are trusted, and how one is minted are one unit, because
they are one decision. Accepting an inbound id is a security boundary: the header is
caller-controlled and its value is stamped on every line for that request, so only a UUID is
adopted and anything else is replaced. That check existed twice before — validated at the Fastify
adapter, unvalidated in this module's `idGenerator` — and only one copy was reachable.

**The id is created at the transport edge and adopted by the context, not the other way round.**
Fastify assigns `req.id` from `genReqId` before any Nest middleware runs, and it is what Fastify's
own machinery logs, so the id cannot originate inside CLS. `main.ts` therefore spreads
`fastifyCorrelationOptions()` into the adapter — that is wiring, and it is all that belongs there.
`idGenerator` prefers `req.id` and falls back to the same policy, so a non-HTTP transport still
gets a valid id from one implementation.

Read the context through `RequestContext`, not `ClsService`:

```ts
@InjectRequestContext() private readonly context: RequestContext;
```

`getId()` throws outside a context — which a startup task, a cron tick or a test driving a service
directly legitimately is — and the context is optional besides. Both guards are written once there;
every accessor returns `undefined` rather than throwing. Read app fields off `context.store`, whose
shape is the app's `ClsStore`, rather than by key.

**Both filters put `requestId` in the response body.** Every error contract documents that field;
it went unpopulated for a while, which made the contract describe something no response ever
contained.

**`logger`** is pino. The design rule is what happens _per line_: one property merge, nothing
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

`src/config/logger.ts` holds the single pino instance as a module-level const, because Fastify
needs it before Nest exists (`loggerInstance` is an adapter option). It is the one file in
the service rather than the package: everything in `logger` is library code, and an instance built
from this service's environment and its own `package.json` is not. `LoggerModule.forRoot({ instance })`
then reuses it, so the framework's access log and application logs share one stream, one format and
one redaction policy. Do not let `LoggerModule` build a second instance.

The correlation field is `reqId`, matching Fastify's own. Fastify's `requestIdLogLabel` could rename
its side instead, but it is deprecated and removed in Fastify 6. It is configurable via
`requestIdKey`.

**Two exception filters, both narrow.** `DomainExceptionFilter` is `@Catch(DomainError)`;
`UnhandledExceptionFilter` is `@Catch()` and logs the real cause while returning a body that reveals
no internals. A single catch-all would silently take over Nest's `HttpException` handling. They are
registered as `APP_FILTER` in the package's `http/http.module.ts`, so they get DI.

**An inbound `x-request-id` is honoured only when it is a UUID.** The header is caller-controlled,
so an arbitrary value would be stamped on every log line for that request — a way to inject
newlines or kilobytes into log storage. `requestIdHeader` is therefore `false` on the adapter, so
`genReqId` always runs and validates before accepting. Contract examples for that header must be
real UUIDs, or the docs page sends its example value and it gets rejected on every try-it-out.

**Request logging is a Fastify `onResponse` hook**, not a Nest interceptor — so it also covers
requests Nest never routes (404s, malformed bodies, plugin rejections), which is where detail is
most wanted. Fastify's own two-line access log is turned off via `disableRequestLogging` in favour
of one detailed line per request carrying method, url, headers, query, params, status and duration.

**Bodies are logged outside production and not in it** — `LOG_REQUEST_BODY` and
`LOG_RESPONSE_BODY` default to `!isProduction()`, so local runs show them without configuration
while production keeps personal data out of log storage. Redaction is the only thing between
that and credentials sitting in log storage permanently. Redaction paths must match the _logged
shape_, not the bare field name — pino matches paths and `*.password` covers one level, so request
logging needs `req.body.password` spelled out. **Adding a secret-bearing field to a contract means
adding a redact path.** Nothing can un-log a value.

The response side carries `statusCode`, `durationMs`, `bytes`, headers and — with
`LOG_RESPONSE_BODY=true` — the payload. **A 5xx logs at `error` level**, everything else at the
configured level, so the error log is failures rather than traffic.

**Response headers are an allowlist**, not everything: security middleware sets a dozen constant
headers on every response, which is pure volume. Pass an array or `'all'` to override.

**Response payloads are parsed back to objects before logging.** A serialized body is a string and
pino's redaction matches object paths, so logging the raw string would bypass redaction entirely.
Streams and Buffers are logged as a marker rather than consumed.

Bodies over `maxBodyBytes` (4096) are replaced with a marker in both directions; the `ignore`
predicate uses substring matching, because a global prefix turns `/health` into `/api/v1/health` and
a prefix check silently stops ignoring it.

Expected failures log at **debug**, bugs at **error**. A 409 is the system working.

## API documentation is generated, never written

```
zod contracts  →  OpenAPI document  →  openapi.json  →  bruno/ collection
   (source)         (in process)        (committed)       (committed)
```

`pnpm openapi` writes `openapi.json` by booting Nest **without listening**; `pnpm bruno:generate`
converts it into `.bru` files; `pnpm bruno:run` executes them against a running service.

Both artefacts are committed, and CI regenerates and diffs them. A failure there means someone
changed the API without the change appearing in review — that diff is the point, not a nuisance.

**Bruno request files are generated and overwritten.** Never edit one, and never add scripts or
assertions to one. Hand-written content goes in files the generator does not touch:
`bruno/collection.bru` for assertions applying to every request, and `bruno/environments/*.bru`.

The generator also wires a flow: a `POST` publishes the id it created via `vars:post-response`, and
a later path `:id` reads it back as `{{userId}}` — so a run exercises create-then-fetch rather than
unrelated calls. That wiring is derived from endpoint shape; do not hand-maintain it.

Requests arrive prefilled with the examples declared on the contract fields, which is the concrete
reason those examples belong on fields rather than beside schemas.

`openapi/document.ts` is shared by the running service and the generator, so the served
document and the committed one cannot describe different APIs. It takes plain metadata rather than
`ConfigService`, because **nothing about the current environment may reach the document** — the
environment name once appeared in its description, which made the artefact differ between a laptop
and the CI runner. For the same reason the title and version are imported from `package.json` at
compile time: `npm_package_*` is empty unless a package script started the process, and it silently
produced a document titled `unknown`.

`openapi.json` is in `.prettierignore`. The generator writes `JSON.stringify(…, 2)`, so formatting
it reintroduces a diff that CI reports as a stale contract.

The generator gets its environment from `.env.example` via `node --env-file-if-exists`, never from
`.env`: building the module graph runs config validation, and real environment variables still take
precedence because Node does not let the file override them. A new required variable therefore
breaks generation until `.env.example` documents it, which is the point.

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

**Request schemas are declared in the endpoint's own file and not exported.** A request shape
belongs to exactly one endpoint, so a shared `requests.ts` would grow with every route and split an
endpoint's definition across files. Name them `bodySchema` / `paramsSchema` / `querySchema` — `body`,
`params` and `query` would shadow what `toInput` destructures.

**Response schemas stay shared in `ui/http/responses.ts`**, because they scale with representations
rather than endpoints: a dozen routes still share one user shape. `userResponse` is used by two
endpoints and is what `$ref` points at, so inlining it would fork the component.

Headers that every endpoint accepts live in the package's `http` (`correlationHeaders`), not redeclared per
feature — they are transport plumbing, identical everywhere.

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

Use the field builders in `contracts/fields.ts` (`id`, `email`, `str`, `int`, `bool`,
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
- **Error responses cannot use the serializer.** Exception filters run outside the interceptor
  chain, and `@SerializeOptions` carries the handler's _success_ schema anyway. `DomainExceptionFilter`
  therefore parses its own body against the documented error contract and replies with the **parsed
  result**, so unknown keys are stripped exactly as they are for success responses. A parse failure
  is logged loudly and the unparsed body still goes out — the drift is our bug, and withholding the
  response would turn it into the caller's outage.
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
- **`npm_package_*` are absent under `node dist/src/main.js`.** Service identity comes from
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
LOG_JSON=true node dist/src/main.js
```

If a run genuinely needs a full environment and none exists, use a throwaway path and point at it
explicitly rather than writing `.env`.

## Mechanical constraints — these are not stylistic

These are runtime facts, and they hold whatever the architecture turns into.

**The entrypoint is `dist/src/main.js`, not `dist/main.js`.** `scripts/` is a sibling of `src/`, so
`rootDir` is the repo root and the output mirrors it. `rootDir` is set explicitly because the Docker
build copies only `src`, and an inferred root would collapse that image's layout to `dist/main.js`.
Root-level `src/` files are limited to `app.module.ts`, `load-env.ts` and `main.ts`.

**`import './load-env'` must stay the first import in `main.ts`.** TypeScript compiles imports
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
