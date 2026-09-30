import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@slack/bolt', '@electric-sql/pglite']
};

export default withWorkflow(nextConfig);
