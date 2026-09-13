/**
 * Hashing is infrastructure: it is slow by design, it will change algorithm at least once, and a
 * test needs a fake that does not burn 19 MiB per call.
 */
export abstract class PasswordHasher {
  abstract hash(plaintext: string): Promise<string>;

  abstract verify(hash: string, plaintext: string): Promise<boolean>;

  /**
   * Whether a stored hash was made with weaker parameters than current policy. A successful
   * sign-in is the only moment the plaintext is available to upgrade it.
   */
  abstract needsRehash(hash: string): boolean;

  /**
   * Verifies against a throwaway hash, for the path where no user exists. Without it, a wrong
   * address answers measurably faster than a wrong password and the endpoint enumerates accounts.
   */
  abstract verifyDummy(plaintext: string): Promise<void>;
}
