# Bruno collection

Executable documentation for this service. Open this folder in [Bruno](https://usebruno.com) and
every request is there, prefilled with the examples declared on the contracts.

## Regenerating

```bash
pnpm openapi          # contracts  → openapi.json
pnpm bruno:generate   # openapi.json → this collection
pnpm bruno:run        # run it against a running service (add --env ci for the CI host)
```

`openapi.json` and this collection are both committed, so a contract change shows up in review as a
diff someone reads rather than as a silent behaviour change.

## What you may edit

**Request files are generated and will be overwritten.** Do not edit them, and do not add scripts or
assertions to them — the contracts in `src/**/ui/http` are the source of truth.

Hand-written content belongs in files the generator never touches:

| File                 | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `collection.bru`     | assertions and scripts that apply to every request |
| `environments/*.bru` | `baseUrl` and any credentials per environment      |

## Request chaining

`bru run` executes a folder in sequence. A `POST` publishes the id it created
(`vars:post-response`), and a path `:id` in a later request reads it back as `{{userId}}` — so a run
exercises a real flow (create, then fetch what was created) rather than three unrelated calls.

That wiring is produced by the generator, deterministically, from the shape of the endpoints.
