import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Set by the session middleware after a valid `bh_session` cookie. */
      user?: {
        readonly id: string;
        readonly email: string;
      };
    }
  }
}

export {};
