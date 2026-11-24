import { z } from 'zod';

export const startScanSchema = z
  .object({
    projectId: z.string().trim().min(1).optional(),
    projectIds: z.array(z.string().trim().min(1)).max(200).optional(),
    all: z.boolean().optional()
  })
  .refine(
    (value) => value.all === true || Boolean(value.projectId) || (value.projectIds?.length ?? 0) > 0,
    { message: 'Choose at least one project to scan.' }
  );

export const updateIssueSchema = z.object({
  status: z.enum(['open', 'ignored', 'fixed'])
});

export type StartScanInput = z.infer<typeof startScanSchema>;
