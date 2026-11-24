import { z } from 'zod';

export const requestCodeSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').max(254),
  challengeId: z.string().trim().min(1, 'The arithmetic check is missing. Reload the page.'),
  challengeAnswer: z.string().trim().min(1, 'Answer the arithmetic check.')
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').max(254),
  code: z.string().trim().min(6, 'Enter the 6-character code.').max(6)
});
