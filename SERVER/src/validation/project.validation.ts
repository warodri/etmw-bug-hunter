import { z } from 'zod';

const ignoreGlobs = z
  .array(z.string().trim().min(1).max(200))
  .max(200, 'That is a lot of ignore patterns.')
  .transform((values) => [...new Set(values)]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Give the project a name.').max(120, 'Keep the name under 120 characters.'),
  path: z.string().trim().min(1, 'Give the absolute path of the code folder.'),
  description: z.string().trim().max(1000, 'Keep the description under 1000 characters.').optional().default(''),
  ignoreGlobs: ignoreGlobs.optional().default([]),
  enabled: z.boolean().optional().default(true),
  mode: z.enum(['local', 'agent']).optional().default('local'),
  agentId: z.union([z.string().trim().min(1), z.null()]).optional().default(null)
});

/**
 * A PATCH schema must not carry `.default()`: a default injects a value into a partial update and
 * erases stored data. Every field is genuinely optional here.
 */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the project a name.').max(120).optional(),
    path: z.string().trim().min(1, 'Give the absolute path of the code folder.').optional(),
    description: z.string().trim().max(1000).optional(),
    ignoreGlobs: ignoreGlobs.optional(),
    enabled: z.boolean().optional(),
    mode: z.enum(['local', 'agent']).optional(),
    agentId: z.union([z.string().trim().min(1), z.null()]).optional()
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
