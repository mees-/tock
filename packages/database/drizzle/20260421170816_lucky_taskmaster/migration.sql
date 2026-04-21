ALTER TABLE "users" ADD COLUMN "subscription_status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscription_tier";