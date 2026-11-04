UPDATE "prospects"
SET "status" = 'disqualified', "updated_at" = now()
WHERE "status" IN (
  'vercel_customer',
  'not_nextjs',
  'robots_disallowed',
  'unreachable',
  'blocked',
  'expired'
);
--> statement-breakpoint
UPDATE "opportunities"
SET "status" = 'expired', "approval_token" = NULL, "updated_at" = now()
WHERE "status" = 'suppressed';
