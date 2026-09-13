import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

import { PasswordHasher } from '../../domain/ports';

/**
 * OWASP's argon2id baseline. Stored inside the hash itself — a PHC string carries the algorithm
 * and every parameter — so there is no second copy to disagree with it, and `needsRehash` reads
 * the policy the hash was actually made under.
 */
const POLICY = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** `$argon2id$v=19$m=19456,t=2,p=1$…` */
const PARAMS = /\$m=(\d+),t=(\d+),p=(\d+)\$/;

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  /**
   * A hash of a value nobody knows, used to spend the same time on an address that does not exist
   * as on one that does. Built once, lazily, because it costs a real hash.
   */
  private dummy: Promise<string> | null = null;

  hash(plaintext: string): Promise<string> {
    return hash(plaintext, POLICY);
  }

  async verify(stored: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(stored, plaintext, POLICY);
    } catch {
      // A malformed or truncated hash is a corrupt row, not a correct password.
      return false;
    }
  }

  needsRehash(stored: string): boolean {
    const parsed = PARAMS.exec(stored);

    if (parsed === null) {
      return true;
    }

    const [, memory, time, parallelism] = parsed;

    return (
      Number(memory) < POLICY.memoryCost ||
      Number(time) < POLICY.timeCost ||
      Number(parallelism) < POLICY.parallelism
    );
  }

  /**
   * Runs a real verification against a throwaway hash.
   *
   * Without it, "no such user" returns in microseconds while "wrong password" takes ~50ms, and the
   * difference enumerates accounts regardless of how careful the response body is.
   */
  async verifyDummy(plaintext: string): Promise<void> {
    this.dummy ??= hash('there is no user with this address', POLICY);

    await this.verify(await this.dummy, plaintext);
  }
}
