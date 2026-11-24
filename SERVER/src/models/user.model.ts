/** An account. The email is the identity; there are no passwords. */
export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

export interface PublicUser {
  readonly id: string;
  readonly email: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email };
}
