import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  AttendanceMethod,
  LaundryItem,
  MealType,
  PaymentMode,
  RequestStatus,
  ResidentAccountStatus,
  VisitorRelation,
} from "@proj/shared";

/**
 * Schema for the resident app. Status/enum columns are stored as text and typed
 * with `$type<>()` so the union lives in @proj/shared and stays the single
 * source of truth for both sides.
 */

/**
 * Human-readable request ids (MNT-1042, LDY-1043…) come off one shared
 * sequence, so a number is never reused across modules and concurrent inserts
 * can't collide.
 */
export const requestSeq = pgSequence("request_seq", { startWith: 1041 });

export const residents = pgTable(
  "residents",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    dob: date("dob").notNull(),
    gender: text("gender").$type<"male" | "female" | "other">().notNull(),
    kycType: text("kyc_type").$type<"pan" | "aadhaar">().notNull(),
    kycNumber: text("kyc_number").notNull(),
    mobile: text("mobile").notNull(),
    accountStatus: text("account_status")
      .$type<ResidentAccountStatus>()
      .notNull()
      .default("pending_approval"),
    // Demo-grade: replace with an Argon2/bcrypt hash before any real use.
    mpin: text("mpin"),
    biometricEnabled: boolean("biometric_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Who approved or rejected this registration, when, and why.
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    reviewNote: text("review_note"),
  },
  (t) => [
    uniqueIndex("residents_mobile_key").on(t.mobile),
    index("residents_status_idx").on(t.accountStatus, t.createdAt),
  ]
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").$type<"ops_excellence" | "warden">().notNull(),
    /** scrypt: "<salt-hex>:<derived-key-hex>". Never the password itself. */
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("admin_users_email_key").on(t.email)]
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    // Opaque random token, not a guessable id like the resident tokens.
    token: text("token").primaryKey(),
    adminId: text("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("admin_sessions_admin_idx").on(t.adminId)]
);

export const otps = pgTable("otps", {
  mobile: text("mobile").primaryKey(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const rooms = pgTable("rooms", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  roomNumber: text("room_number").notNull(),
  floor: text("floor").notNull(),
  wing: text("wing").notNull(),
  buildingName: text("building_name").notNull(),
  propertyName: text("property_name").notNull(),
  propertyAddress: text("property_address").notNull(),
  roomType: text("room_type").notNull(),
  occupancy: text("occupancy").notNull(),
});

export const paymentPlans = pgTable("payment_plans", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  paidUpTo: date("paid_up_to").notNull(),
  nextDueOn: date("next_due_on"),
  // Rupees, stored in whole units — no sub-rupee amounts exist in this domain.
  nextDueAmount: integer("next_due_amount"),
});

export const paymentEntries = pgTable(
  "payment_entries",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    paidOn: date("paid_on").notNull(),
    amount: integer("amount").notNull(),
    mode: text("mode").$type<PaymentMode>().notNull(),
    periodFrom: date("period_from").notNull(),
    periodTo: date("period_to").notNull(),
    receiptNo: text("receipt_no").notNull(),
  },
  (t) => [index("payment_entries_resident_idx").on(t.residentId)]
);

export const foodPreferences = pgTable("food_preferences", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  breakfast: boolean("breakfast").notNull().default(true),
  lunch: boolean("lunch").notNull().default(true),
  snacks: boolean("snacks").notNull().default(true),
  dinner: boolean("dinner").notNull().default(true),
  pauseFrom: date("pause_from"),
  pauseTo: date("pause_to"),
});

export const maintenanceRequests = pgTable(
  "maintenance_requests",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").$type<RequestStatus>().notNull(),
    categoryId: text("category_id").notNull(),
    categoryLabel: text("category_label").notNull(),
    subCategoryId: text("sub_category_id").notNull(),
    subCategoryLabel: text("sub_category_label").notNull(),
    remarks: text("remarks").notNull(),
    photoUris: jsonb("photo_uris").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("maintenance_resident_idx").on(t.residentId, t.createdAt)]
);

export const laundryRequests = pgTable(
  "laundry_requests",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").$type<RequestStatus>().notNull(),
    // Line items are only ever read as a whole bag, so jsonb beats a join table.
    items: jsonb("items").$type<LaundryItem[]>().notNull(),
    totalPieces: integer("total_pieces").notNull(),
    pickupSlot: text("pickup_slot").notNull(),
    photoUris: jsonb("photo_uris").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("laundry_resident_idx").on(t.residentId, t.createdAt)]
);

export const complaints = pgTable(
  "complaints",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").$type<RequestStatus>().notNull(),
    categoryId: text("category_id").notNull(),
    categoryLabel: text("category_label").notNull(),
    subCategoryId: text("sub_category_id").notNull(),
    subCategoryLabel: text("sub_category_label").notNull(),
    remarks: text("remarks").notNull(),
    /** Free-form on purpose: may point at a laundry or maintenance request. */
    againstRequestId: text("against_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("complaints_resident_idx").on(t.residentId, t.createdAt)]
);

export const visitRequests = pgTable(
  "visit_requests",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").$type<RequestStatus>().notNull(),
    visitorName: text("visitor_name").notNull(),
    relation: text("relation").$type<VisitorRelation>().notNull(),
    visitDate: date("visit_date").notNull(),
    durationHours: integer("duration_hours").notNull(),
    foodRequired: boolean("food_required").notNull().default(false),
    foodSelections: jsonb("food_selections")
      .$type<{ meal: MealType; items: string[] }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("visits_resident_idx").on(t.residentId, t.createdAt)]
);

/** One timeline table for every request kind — same shape, same queries. */
export const trackingEvents = pgTable(
  "tracking_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    requestId: text("request_id").notNull(),
    status: text("status").$type<RequestStatus>().notNull(),
    note: text("note").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tracking_request_idx").on(t.requestId, t.at)]
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    markedAt: timestamp("marked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    method: text("method").$type<AttendanceMethod>().notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    locationLabel: text("location_label").notNull(),
    photoUri: text("photo_uri"),
    withinGeofence: boolean("within_geofence").notNull(),
  },
  // One mark per resident per day is a hard rule, so the DB enforces it too.
  (t) => [uniqueIndex("attendance_resident_date_key").on(t.residentId, t.date)]
);

export const feedbackEntries = pgTable(
  "feedback_entries",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
    categoryLabel: text("category_label").notNull(),
    subCategoryId: text("sub_category_id").notNull(),
    subCategoryLabel: text("sub_category_label").notNull(),
    rating: integer("rating").notNull(),
    remarks: text("remarks").notNull().default(""),
    photoUris: jsonb("photo_uris").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feedback_resident_idx").on(t.residentId, t.createdAt)]
);

export const messEntries = pgTable(
  "mess_entries",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    meal: text("meal").$type<MealType>().notNull(),
    method: text("method").$type<AttendanceMethod>().notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mess_resident_idx").on(t.residentId, t.enteredAt)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind")
      .$type<"info" | "success" | "warning" | "danger">()
      .notNull(),
    href: text("href"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_resident_idx").on(t.residentId, t.createdAt)]
);


/* ------------------------------------------------- onboarding & move-in */

export const kycRecords = pgTable("kyc_records", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  status: text("status")
    .$type<
      "not_started" | "awaiting_documents" | "under_review" | "verified" | "rejected"
    >()
    .notNull()
    .default("not_started"),
  /** "manual" until a licensed Aadhaar AUA/KUA or DigiLocker is wired up. */
  provider: text("provider").notNull().default("manual"),
  reference: text("reference"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
});

export const kycDocuments = pgTable(
  "kyc_documents",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<"aadhaar_front" | "aadhaar_back" | "pan" | "photo" | "other">()
      .notNull(),
    uri: text("uri").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("kyc_documents_resident_idx").on(t.residentId)]
);

export const leaseAgreements = pgTable(
  "lease_agreements",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"none" | "issued" | "signed" | "cancelled">()
      .notNull()
      .default("issued"),
    // Snapshot at issue time so the agreement stays true even if the room changes.
    terms: jsonb("terms").$type<Record<string, unknown>>().notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    issuedBy: text("issued_by").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerName: text("signer_name"),
    /** SVG path data captured from the on-screen signature pad. */
    signaturePath: text("signature_path"),
  },
  (t) => [index("lease_resident_idx").on(t.residentId, t.issuedAt)]
);

export const roommateProfiles = pgTable("roommate_profiles", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  sleepSchedule: text("sleep_schedule")
    .$type<"early" | "late" | "flexible">()
    .notNull(),
  cleanliness: integer("cleanliness").notNull(),
  noiseTolerance: integer("noise_tolerance").notNull(),
  socialLevel: integer("social_level").notNull(),
  studyLocation: text("study_location")
    .$type<"in_room" | "outside" | "flexible">()
    .notNull(),
  guestFrequency: integer("guest_frequency").notNull(),
  smoking: boolean("smoking").notNull().default(false),
  foodPreference: text("food_preference")
    .$type<"veg" | "non_veg" | "either">()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const moveInTasks = pgTable(
  "move_in_tasks",
  {
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("move_in_task_key").on(t.residentId, t.key)]
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    condition: text("condition")
      .$type<"good" | "fair" | "damaged" | "missing">()
      .notNull(),
    notes: text("notes").notNull().default(""),
    photoUris: jsonb("photo_uris").$type<string[]>().notNull().default([]),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("inventory_resident_idx").on(t.residentId)]
);

export const moveInState = pgTable("move_in_state", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  /** Once set, the inventory is frozen — it's the move-out reference. */
  inventorySubmittedAt: timestamp("inventory_submitted_at", {
    withTimezone: true,
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/* -------------------------------------------------- finance and leasing */

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    periodFrom: date("period_from").notNull(),
    periodTo: date("period_to").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dueOn: date("due_on").notNull(),
    lines: jsonb("lines")
      .$type<{ description: string; amount: number }[]>()
      .notNull(),
    // Whole rupees throughout: this domain has no paise, and integers dodge
    // every floating-point rounding problem currency otherwise brings.
    total: integer("total").notNull(),
    amountPaid: integer("amount_paid").notNull().default(0),
    status: text("status")
      .$type<"issued" | "part_paid" | "paid" | "overdue" | "void">()
      .notNull()
      .default("issued"),
  },
  (t) => [
    // One invoice per resident per billing period; the generator relies on this.
    uniqueIndex("invoice_period_key").on(t.residentId, t.periodFrom),
    index("invoice_resident_idx").on(t.residentId, t.issuedAt),
  ]
);

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id"),
    splitShareId: text("split_share_id"),
    amount: integer("amount").notNull(),
    method: text("method")
      .$type<"upi" | "card" | "netbanking" | "mandate">()
      .notNull(),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: text("status")
      .$type<"created" | "pending" | "succeeded" | "failed" | "cancelled">()
      .notNull()
      .default("created"),
    failureReason: text("failure_reason"),
    /** Retrying with the same key returns the original order, never a re-charge. */
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payment_idempotency_key").on(t.residentId, t.idempotencyKey),
    uniqueIndex("payment_provider_ref").on(t.providerRef),
    index("payment_resident_idx").on(t.residentId, t.createdAt),
  ]
);

export const mandates = pgTable(
  "mandates",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: text("status")
      .$type<"pending" | "active" | "paused" | "revoked" | "failed">()
      .notNull()
      .default("pending"),
    maxAmount: integer("max_amount").notNull(),
    dayOfMonth: integer("day_of_month").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mandate_resident_idx").on(t.residentId)]
);

export const instalmentPlans = pgTable(
  "instalment_plans",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull(),
    principal: integer("principal").notNull(),
    feeAmount: integer("fee_amount").notNull(),
    totalPayable: integer("total_payable").notNull(),
    count: integer("count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("instalment_plan_invoice_key").on(t.invoiceId)]
);

export const instalments = pgTable(
  "instalments",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => instalmentPlans.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    dueOn: date("due_on").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").$type<"due" | "paid" | "overdue">().notNull().default("due"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("instalment_plan_idx").on(t.planId, t.seq)]
);

export const deposits = pgTable("deposits", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  status: text("status")
    .$type<"held" | "refund_initiated" | "refunded" | "forfeited">()
    .notNull()
    .default("held"),
  heldSince: date("held_since").notNull(),
  refundInitiatedAt: timestamp("refund_initiated_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundReference: text("refund_reference"),
});

export const depositDeductions = pgTable(
  "deposit_deductions",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    /** Ties a deduction back to what was recorded at move-in, when relevant. */
    inventoryItemId: text("inventory_item_id"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("deduction_resident_idx").on(t.residentId)]
);

export const splitBills = pgTable(
  "split_bills",
  {
    id: text("id").primaryKey(),
    createdBy: text("created_by")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category")
      .$type<"utilities" | "groceries" | "event" | "cleaning" | "other">()
      .notNull(),
    note: text("note").notNull().default(""),
    totalAmount: integer("total_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [index("split_creator_idx").on(t.createdBy, t.createdAt)]
);

export const splitShares = pgTable(
  "split_shares",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => splitBills.id, { onDelete: "cascade" }),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    status: text("status").$type<"pending" | "settled">().notNull().default("pending"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("split_share_key").on(t.billId, t.residentId),
    index("split_share_resident_idx").on(t.residentId, t.status),
  ]
);
