import type { ParameterObject } from '@nestjs/swagger';

import type { ContextFields, ContextRegistry, Trust } from '../context';

/** `addGlobalParameters` rejects examples, which is the right call — see below. */
export type GlobalParameter = Omit<ParameterObject, 'example' | 'examples'>;

/**
 * The context headers a service accepts, as parameters for every operation.
 *
 * Document-level rather than per-endpoint, for two reasons.
 *
 * The header applies to the whole service — it is transport plumbing, honoured on every route —
 * so declaring it in each endpoint's contract is a per-route restatement of a service-wide fact,
 * and one an endpoint can forget. Two of three endpoints had forgotten it.
 *
 * More decisively, an endpoint contract is *validated*, and validating these would contradict the
 * declaration. A field says what happens to an unacceptable inbound value — for a correlation id,
 * replace it with a fresh one — while a validation pipe would answer 400 instead. The registry
 * already applied the field's contract when the context was created; documenting is all that is
 * left to do here.
 *
 * No example is emitted, and the API forbids one anyway: a constant would be prefilled by Swagger
 * UI and by the generated Bruno requests, making every call share one correlation id. `format`
 * tells a caller the shape without handing them a value to reuse.
 */
export const contextHeaderParameters = <F extends ContextFields>(
  registry: ContextRegistry<F>,
  options: { trust?: Trust } = {},
): GlobalParameter[] => {
  const trust = options.trust ?? 'edge';

  return Object.values(registry.fields)
    .filter(
      (field) =>
        field.carrier !== undefined &&
        field.trust !== 'never' &&
        (field.trust === 'edge' || trust === 'internal'),
    )
    .map((field) => ({
      name: field.carrier as string,
      in: 'header',
      required: false,
      description: field.description,
      schema: { type: 'string', ...(field.example !== undefined ? { format: 'uuid' } : {}) },
    }));
};
