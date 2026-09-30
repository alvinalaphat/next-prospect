import { defineHook } from 'workflow';
import { approvalSchema } from '@/lib/types';

/**
 * Human-in-the-loop approval. The workflow suspends on this hook (no compute
 * while waiting) until Slack or the dashboard calls approvalHook.resume().
 */
export const approvalHook = defineHook({ schema: approvalSchema });

export const approvalToken = (domain: string, runId: string) => `approval:${domain}:${runId}`;
