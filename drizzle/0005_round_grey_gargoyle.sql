ALTER TABLE "prospects" ADD COLUMN "planning_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "prospects"
SET "planning_complete" = true
WHERE "fit_score" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "opportunities"
    WHERE "opportunities"."domain" = "prospects"."domain"
      AND "opportunities"."run_id" = "prospects"."run_id"
  );
