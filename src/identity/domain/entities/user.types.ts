import type { Email } from '../value-objects/email';
import type { OAuthAccountId, UserId } from '../value-objects/user-id';

export type UserStatus = 'active' | 'suspended';

/** What a provider tells us about someone, once a code has been exchanged. */
export type ProviderProfile = {
  provider: string;
  /** The provider's stable subject id. Never the email. */
  externalId: string;
  email: Email | null;
  /** Whether the *provider* asserts the address is verified. Load-bearing: see the linking rules. */
  emailVerified: boolean;
  displayName: string | null;
};

export type PasswordCredentialSnapshot = {
  hash: string;
  updatedAt: Date;
};

export type OAuthAccountSnapshot = {
  id: OAuthAccountId;
  provider: string;
  providerAccountId: string;
  email: Email | null;
  linkedAt: Date;
};

/** The aggregate's whole state, and the only shape persistence sees. */
export type UserSnapshot = {
  id: UserId;
  email: Email;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  password: PasswordCredentialSnapshot | null;
  oauthAccounts: OAuthAccountSnapshot[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

/** Names a sign-in method without exposing the aggregate's internals. */
export type MethodRef = { kind: 'password' } | { kind: 'oauth'; id: OAuthAccountId };
