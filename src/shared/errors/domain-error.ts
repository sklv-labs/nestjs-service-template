import { z } from 'zod';

/**
 * A business failure, raised by the domain and service layers. It carries no HTTP status —
 * mapping a code to a status is a transport decision and lives in `ui/http`.
 *
 * `code` is the client's contract and must stay stable. `reason` narrows which of several
 * situations behind that code occurred, so a newly discovered cause adds a reason rather than
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

/** Reason identifier mapped to the human explanation for that case. */
export type Reasons = Record<string, string>;

export type BusinessError<
  Code extends string = string,
  R extends Reasons = Reasons,
  Details extends z.ZodType = z.ZodType,
> = {
  readonly code: Code;
  readonly reasons: R;
  readonly details: Details;
  /**
   * Builds the error for the caller to `throw`. The message comes from the reason declaration, so
   * the same situation reads the same way everywhere and documentation cannot contradict it.
   *
   * It does not throw itself: TypeScript narrows control flow for a `throw` statement, but not for
   * a method call that returns `never`.
   */
  raise(reason: keyof R & string, details: z.infer<Details>): DomainError<Code, keyof R & string>;
};

/**
 * Declares a business error once — its stable code, every reason it can carry with the message for
 * that reason, and the shape of its details. Services raise it, and the HTTP layer documents it
 * from the same declaration.
 */
export const businessError = <
  const Code extends string,
  const R extends Reasons,
  Details extends z.ZodType,
>(def: {
  code: Code;
  reasons: R;
  details: Details;
}): BusinessError<Code, R, Details> => ({
  code: def.code,
  reasons: def.reasons,
  details: def.details,
  raise(reason, details) {
    return new DomainError(
      def.code,
      reason,
      details as Record<string, unknown>,
      def.reasons[reason] ?? def.code,
    );
  },
});

/**
 * The read-only view of a business error, for anything that documents rather than raises one.
 *
 * `BusinessError` itself is not usable as a parameter type: `raise` accepts only that error's own
 * reasons, so a specific error is not assignable to a wider one. Dropping `raise` makes the shape
 * plainly covariant.
 */
export type BusinessErrorShape<Details extends z.ZodType = z.ZodType> = {
  readonly code: string;
  readonly reasons: Reasons;
  readonly details: Details;
};

export const reasonsOf = (error: BusinessErrorShape): [string, ...string[]] =>
  Object.keys(error.reasons) as [string, ...string[]];
