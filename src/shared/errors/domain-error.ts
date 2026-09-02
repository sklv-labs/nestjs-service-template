import { z } from 'zod';

/**
 * A business failure, raised by the domain and service layers. It carries no HTTP status —
 * mapping a code to a status is a transport decision and lives in `ui/http`.
 *
 * `code` is the client's contract and must stay stable. `reason` narrows which of several
 * situations behind that code occurred, so a newly discovered cause adds a reason instead of
 * minting a code, which would be a breaking change.
 */
export class DomainError<
  Code extends string = string,
  Reason extends string = string,
> extends Error {
  constructor(
    readonly code: Code,
    readonly reason: Reason,
    readonly details: Readonly<Record<string, unknown>>,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError;

export type BusinessError<
  Code extends string,
  Reasons extends readonly [string, ...string[]],
  Details extends z.ZodType,
> = {
  readonly code: Code;
  readonly reasons: Reasons;
  readonly details: Details;
  /**
   * Builds the error for the caller to `throw`. It does not throw itself: TypeScript narrows
   * control flow for a `throw` statement, but not for a method call that returns `never`.
   */
  raise(
    reason: Reasons[number],
    details: z.infer<Details>,
    message: string,
  ): DomainError<Code, Reasons[number]>;
};

/**
 * Declares a business error once. The declaration is what the service raises and what the HTTP
 * layer documents, so the code, its reasons and the shape of its details cannot drift apart.
 */
export const businessError = <
  const Code extends string,
  const Reasons extends readonly [string, ...string[]],
  Details extends z.ZodType,
>(def: {
  code: Code;
  reasons: Reasons;
  details: Details;
}): BusinessError<Code, Reasons, Details> => ({
  code: def.code,
  reasons: def.reasons,
  details: def.details,
  raise(reason, details, message) {
    return new DomainError(def.code, reason, details as Record<string, unknown>, message);
  },
});
