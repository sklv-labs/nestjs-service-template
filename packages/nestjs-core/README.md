# @sklv-labs/nestjs-core

Transport-agnostic building blocks for NestJS services: request context, logging, domain errors,
schema contracts and HTTP endpoint descriptors.

Developed inside `nestjs-service-template` as a workspace package so the boundary is enforced while
the design is still moving. Not published yet.

## Subpaths

| Import                             | Contents                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `@sklv-labs/nestjs-core/contracts` | Zod field builders (`id`, `email`, `str`, `int`, `bool`, `isoDate`, `oneOf`), pagination |
| `@sklv-labs/nestjs-core/errors`    | `DomainError`, `businessError` declaration                                               |
| `@sklv-labs/nestjs-core/operation` | `Handler` — one scenario, no transport                                                   |
| `@sklv-labs/nestjs-core/cls`       | Request context, correlation id policy, `nestjs-cls` wrapper                             |
| `@sklv-labs/nestjs-core/logger`    | pino: `createLogger`, `LoggerService`, `@InjectLogger()`                                 |
| `@sklv-labs/nestjs-core/http`      | Endpoint descriptor, request builders, exception filters, request logging                |
| `@sklv-labs/nestjs-core/openapi`   | Document builder, contract-to-schema rendering                                           |

There is no root export. A consumer names the area it depends on, which keeps the areas from
growing into each other.

## Layout

An area per subpath, and within it one file per role:

```
context/
├── context.constants.ts     DI tokens and store keys
├── context.types.ts         the area's contract: ContextRegistry, StoreOf, Trust
├── context.registry.ts      defineContext
├── context.module.ts
├── context.service.ts       Context
├── carriers/                carrier.types.ts, object.carrier.ts   (rmq, bullmq next)
├── fields/                  field.types.ts, field.builders.ts
└── testing/                 run-with-context.ts
http/
├── http.module.ts
├── endpoint/                types, factory, decorator, scanner, constants
├── errors/                  error.contract.ts, error.registry.ts, filters/
├── request/                 request.builders.ts, request.decorator.ts
├── logging/                 request-logging.ts
└── fastify/                 fastify.context.ts
```

Three rules produce that:

**A role suffix when a folder mixes roles** — `.module`, `.service`, `.types`, `.constants`,
`.factory`, `.decorator`, `.filter`, `.writer`. Where every file in a folder does the same kind of
thing, the noun stands alone: `openapi/{document,context-headers,schema}.ts` are all builders, and
suffixing them would add letters, not information.

**A sub-folder when an area holds more than one concern**, or when it is about to. `carriers/` has
one implementation today and will have one per transport; `http/` had nine files spanning endpoint
description, error rendering, request parsing, logging and the Fastify binding.

**Tokens live in `*.constants.ts`.** They are the injectable surface, so they belong somewhere
discoverable — and a module that imports a service only to reach a symbol it declared has a
dependency it does not need.

**Internal structure is not the public surface.** Every import above resolves through the area
barrel named in `exports`, so this whole layout changed without a single consumer edit.

## Rules

**Nothing here imports from the service.** This project has its own `tsconfig.json`, so the
compiler enforces it — but the rule that matters is the intent: anything reading a service's
environment, config or `package.json` is composition and belongs in that service.

**Shared runtime libraries are peers.** NestJS, pino, zod and `nestjs-cls` must resolve to the
consumer's single copy — two copies of `nestjs-cls` means two async local storages and a context
that silently reads empty. `@nestjs/platform-fastify` is optional; only request logging uses it,
for types.

**Declaration emit is part of the build.** `composite: true` means consumers compile against
`dist/*.d.ts` rather than these sources, so a type that cannot be serialized fails here instead of
at publish time. An earlier builder-pattern API died exactly that way (TS7056).
