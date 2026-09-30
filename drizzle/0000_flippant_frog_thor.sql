CREATE TABLE "prospects" (
	"domain" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"run_id" text,
	"batch" text,
	"host" text,
	"nextjs_confidence" integer,
	"perf_score" integer,
	"fit_score" integer,
	"angle" text,
	"detection" jsonb,
	"perf" jsonb,
	"research" jsonb,
	"qualification" jsonb,
	"draft" jsonb,
	"evidence" jsonb,
	"approval_token" text,
	"approval" jsonb,
	"slack" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psi_cache" (
	"url" text NOT NULL,
	"strategy" text NOT NULL,
	"result" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psi_cache_url_strategy_pk" PRIMARY KEY("url","strategy")
);
--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");