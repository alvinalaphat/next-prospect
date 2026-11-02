CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"run_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"category" text NOT NULL,
	"sales_motion" text DEFAULT 'new_business' NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"angle" text NOT NULL,
	"why_now" text NOT NULL,
	"why_vercel" text NOT NULL,
	"target_role" text NOT NULL,
	"score" integer NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"matched_signals" jsonb NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"contact" jsonb,
	"draft" jsonb,
	"decision" jsonb,
	"approval_token" text,
	"slack" jsonb,
	"gmail_draft" jsonb,
	"gmail_error" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_domain_prospects_domain_fk" FOREIGN KEY ("domain") REFERENCES "public"."prospects"("domain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunities_domain_run_idx" ON "opportunities" USING btree ("domain","run_id");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_score_idx" ON "opportunities" USING btree ("score");