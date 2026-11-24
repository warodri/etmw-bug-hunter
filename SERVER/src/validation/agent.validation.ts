import { z } from 'zod';

import { ISSUE_CATEGORIES } from '../models/issue.model';
import { SEVERITY_ORDER } from '../constants/severity';

const finding = z.object({
  filePath: z.string().min(1).max(2000),
  line: z.number().int().positive().nullable().optional(),
  column: z.number().int().nonnegative().nullable().optional(),
  detectorId: z.string().min(1).max(120),
  rule: z.string().min(1).max(200),
  category: z.enum(ISSUE_CATEGORIES),
  severity: z.enum(SEVERITY_ORDER),
  message: z.string().min(1).max(2000),
  snippet: z.string().max(2000).optional().default(''),
  aiGenerated: z.boolean().optional().default(false)
});

const progress = z.object({
  type: z.literal('scan.progress'),
  scanId: z.string().min(1),
  cursor: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  filesScanned: z.number().int().nonnegative(),
  filesSkipped: z.number().int().nonnegative().optional().default(0)
});

const findings = z.object({
  type: z.literal('scan.findings'),
  scanId: z.string().min(1),
  findings: z.array(finding).max(500)
});

const done = z.object({
  type: z.literal('scan.done'),
  scanId: z.string().min(1),
  cursor: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  filesScanned: z.number().int().nonnegative(),
  filesSkipped: z.number().int().nonnegative().optional().default(0),
  truncated: z.boolean().optional().default(false)
});

const stopped = z.object({
  type: z.literal('scan.stopped'),
  scanId: z.string().min(1)
});

const failed = z.object({
  type: z.literal('scan.error'),
  scanId: z.string().min(1),
  message: z.string().min(1).max(2000)
});

const heartbeat = z.object({
  type: z.literal('heartbeat')
});

export const agentMessageSchema = z.discriminatedUnion('type', [
  progress,
  findings,
  done,
  stopped,
  failed,
  heartbeat
]);

export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type AgentFinding = z.infer<typeof finding>;
