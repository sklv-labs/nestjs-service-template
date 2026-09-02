import { z } from 'zod';

/**
 * The input contract. `.strict()` makes unknown keys a validation error rather than silently
 * dropping them, which is the schema equivalent of `forbidNonWhitelisted`.
 */
export const CreateUserRequestSchema = z
  .object({
    email: z.email().describe("The user's primary email address"),
    password: z.string().min(12).max(256).describe('Plaintext password, at least 12 characters'),
  })
  .strict();

/**
 * `z.infer` is the *output* type — what the handler receives after the pipe has parsed and
 * transformed. Use `z.input` when you need the shape a client actually sends; the two differ
 * wherever a schema coerces or defaults.
 */
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type CreateUserRequestInput = z.input<typeof CreateUserRequestSchema>;
