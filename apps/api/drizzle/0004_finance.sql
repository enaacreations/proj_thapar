CREATE TABLE "deposit_deductions" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"inventory_item_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"held_since" date NOT NULL,
	"refund_initiated_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_reference" text
);
--> statement-breakpoint
CREATE TABLE "instalment_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"principal" integer NOT NULL,
	"fee_amount" integer NOT NULL,
	"total_payable" integer NOT NULL,
	"count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instalments" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"seq" integer NOT NULL,
	"due_on" date NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"resident_id" text NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_on" date NOT NULL,
	"lines" jsonb NOT NULL,
	"total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"max_amount" integer NOT NULL,
	"day_of_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"invoice_id" text,
	"split_share_id" text,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'created' NOT NULL,
	"failure_reason" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "split_bills" (
	"id" text PRIMARY KEY NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"total_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "split_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"resident_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalment_plans" ADD CONSTRAINT "instalment_plans_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_plan_id_instalment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."instalment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_bills" ADD CONSTRAINT "split_bills_created_by_residents_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_shares" ADD CONSTRAINT "split_shares_bill_id_split_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."split_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_shares" ADD CONSTRAINT "split_shares_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deduction_resident_idx" ON "deposit_deductions" USING btree ("resident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instalment_plan_invoice_key" ON "instalment_plans" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "instalment_plan_idx" ON "instalments" USING btree ("plan_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_period_key" ON "invoices" USING btree ("resident_id","period_from");--> statement-breakpoint
CREATE INDEX "invoice_resident_idx" ON "invoices" USING btree ("resident_id","issued_at");--> statement-breakpoint
CREATE INDEX "mandate_resident_idx" ON "mandates" USING btree ("resident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_key" ON "payment_orders" USING btree ("resident_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_ref" ON "payment_orders" USING btree ("provider_ref");--> statement-breakpoint
CREATE INDEX "payment_resident_idx" ON "payment_orders" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "split_creator_idx" ON "split_bills" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "split_share_key" ON "split_shares" USING btree ("bill_id","resident_id");--> statement-breakpoint
CREATE INDEX "split_share_resident_idx" ON "split_shares" USING btree ("resident_id","status");