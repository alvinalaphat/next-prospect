DROP TABLE "maintenance_runs" CASCADE;--> statement-breakpoint
DROP TABLE "proof_records" CASCADE;--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "proof_ids";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "competitive_context_ids";