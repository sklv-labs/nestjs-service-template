import { z } from 'zod';

import { InvalidEmail } from '../errors/invalid-email.error';

const schema = z.email().max(320);

declare const brand: unique symbol;

/** A normalised, syntactically valid address. The only form the domain stores or compares. */
export type Email = string & { readonly [brand]: 'Email' };

export const Email = {
  /**
   * Normalisation is a domain rule, not a storage one: `Alex@Example.com ` and `alex@example.com`
   * are the same person, so they must be the same value before anything compares or indexes them.
   * Doing it here rather than with a case-insensitive column keeps the rule where the rest live.
   */
  of: (raw: string): Email => {
    const normalised = raw.trim().toLowerCase();

    if (!schema.safeParse(normalised).success) {
      throw InvalidEmail.raise('MALFORMED', { email: raw });
    }

    return normalised as Email;
  },

  /** For values already normalised on the way in — a row this application wrote. */
  restore: (value: string): Email => value as Email,
};
