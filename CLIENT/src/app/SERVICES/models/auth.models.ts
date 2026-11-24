export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

export interface AuthChallenge {
  readonly id: string;
  readonly question: string;
}

export interface ChallengeResponse {
  readonly challenge: AuthChallenge;
}

export interface RequestCodeResponse {
  readonly success: boolean;
  readonly message: string;
}

export interface VerifyCodeResponse {
  readonly success: boolean;
  readonly user: AuthUser;
}

export interface MeResponse {
  readonly user: AuthUser;
}
