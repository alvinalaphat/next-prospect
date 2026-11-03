CREATE TABLE "maintenance_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_records" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor" text NOT NULL,
	"usage" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"summary" text NOT NULL,
	"product_ids" jsonb NOT NULL,
	"industries" jsonb NOT NULL,
	"workloads" jsonb NOT NULL,
	"candidate_claims" jsonb NOT NULL,
	"published_at" text,
	"last_seen_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "maintenance_runs_kind_created_idx" ON "maintenance_runs" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "proof_records_source_url_idx" ON "proof_records" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "proof_records_vendor_idx" ON "proof_records" USING btree ("vendor");--> statement-breakpoint
CREATE INDEX "proof_records_active_idx" ON "proof_records" USING btree ("active");