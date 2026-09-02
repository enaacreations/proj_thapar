import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
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
    photoUrl: text("photo_url"),
    /**
     * The 128-float face-api descriptor the resident enrolled with, used to
     * verify facial attendance. A descriptor is a one-way embedding, not a
     * photo — it can't be turned back into an image of the resident.
     */
    faceDescriptor: jsonb("face_descriptor").$type<number[]>(),
    faceEnrolledAt: timestamp("face_enrolled_at", { withTimezone: true }),
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

/**
 * The recurring mess plan: "every day, these meals, until I say otherwise".
 *
 * Everything here defaults to off. A resident who has never opened the food
 * screen is on no plan and booked for nothing — being counted for four meals a
 * day is a decision, and it has to be one they made.
 */
export const foodPreferences = pgTable("food_preferences", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  /** Whether the recurring plan is switched on at all. */
  recurring: boolean("recurring").notNull().default(false),
  breakfast: boolean("breakfast").notNull().default(false),
  lunch: boolean("lunch").notNull().default(false),
  snacks: boolean("snacks").notNull().default(false),
  dinner: boolean("dinner").notNull().default(false),
  pauseFrom: date("pause_from"),
  pauseTo: date("pause_to"),
});

/**
 * One resident's decision about one meal on one day, which always beats the
 * recurring plan. `booked` false is a real answer, not an absent row: it's how
 * someone on a plan skips Tuesday lunch without coming off the plan.
 *
 * Days with no row fall back to whatever the plan says, so a resident on a
 * plan doesn't have to tick four boxes every morning.
 */
export const mealBookings = pgTable(
  "meal_bookings",
  {
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    meal: text("meal").$type<MealType>().notNull(),
    booked: boolean("booked").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.residentId, t.date, t.meal] }),
    // The mess reads this by day to work out how much to cook.
    index("meal_bookings_day_idx").on(t.date, t.meal),
  ]
);

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
    /** Where the bag actually is; `status` stays for the shared request feed. */
    stage: text("stage")
      .$type<
        | "scheduled"
        | "picked_up"
        | "washing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      >()
      .notNull()
      .default("scheduled"),
    service: text("service")
      .$type<"wash_fold" | "wash_iron" | "iron_only" | "dry_clean">()
      .notNull()
      .default("wash_fold"),
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
    /**
     * How closely the captured face matched the enrolled one. Null for
     * fingerprint and QR marks, and for facial marks made before the face
     * check existed — useful when auditing a disputed attendance.
     */
    faceMatchDistance: doublePrecision("face_match_distance"),
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
    /** Serving day, so the one-plate-per-meal rule has something to key on. */
    date: date("date").notNull(),
    /**
     * Where the counter device was when it scanned. Nullable: a desktop
     * scanner with location blocked still has to be able to serve food, and
     * rows written before this column existed have nothing to backfill from.
     *
     * Recorded, not enforced — a scan from outside the fence is still a plate
     * handed over. It's kept so the office can see a counter that has drifted
     * off site before deciding to act on it.
     */
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    withinGeofence: boolean("within_geofence"),
    locationLabel: text("location_label"),
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mess_resident_idx").on(t.residentId, t.enteredAt),
    // One plate per resident per meal per day, enforced here and not just in
    // code — a double scan at the counter must not inflate the meal count.
    uniqueIndex("mess_resident_meal_date_key").on(t.residentId, t.meal, t.date),
  ]
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

/**
 * Photos and panoramas for the property tour. The spaces themselves are a
 * fixed list in the catalogue — what a hostel is made of doesn't change — but
 * the pictures of them do, so they live here and are merged in on read.
 *
 * Unlike attendance selfies these are pictures of rooms, not of people, so
 * they're served over a plain static route.
 */
export const tourMedia = pgTable(
  "tour_media",
  {
    id: text("id").primaryKey(),
    /** Matches a space id in the tour catalogue. */
    spaceId: text("space_id").notNull(),
    kind: text("kind").$type<"photo" | "panorama">().notNull(),
    /** A path under the media route, or an absolute URL if hosted elsewhere. */
    uri: text("uri").notNull(),
    caption: text("caption").notNull().default(""),
    position: integer("position").notNull().default(0),
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("tour_media_space_idx").on(t.spaceId, t.position)]
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

/* --------------------------------------------- daily living and services */

export const menuMeals = pgTable(
  "menu_meals",
  {
    id: text("id").primaryKey(),
    date: date("date").notNull(),
    meal: text("meal").$type<MealType>().notNull(),
    servingWindow: text("serving_window").notNull(),
    published: boolean("published").notNull().default(true),
  },
  // One entry per meal per day; the editor upserts against this.
  (t) => [uniqueIndex("menu_meal_key").on(t.date, t.meal)]
);

export const menuDishes = pgTable(
  "menu_dishes",
  {
    id: text("id").primaryKey(),
    mealId: text("meal_id")
      .notNull()
      .references(() => menuMeals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("menu_dish_meal_idx").on(t.mealId, t.position)]
);

export const dietPreferences = pgTable("diet_preferences", {
  residentId: text("resident_id")
    .primaryKey()
    .references(() => residents.id, { onDelete: "cascade" }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  allergies: text("allergies").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mealRatings = pgTable(
  "meal_ratings",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    meal: text("meal").$type<MealType>().notNull(),
    rating: integer("rating").notNull(),
    remarks: text("remarks").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // One rating per resident per meal per day — otherwise the vendor score
  // could be swung by one person rating repeatedly.
  (t) => [
    uniqueIndex("meal_rating_key").on(t.residentId, t.date, t.meal),
    index("meal_rating_window_idx").on(t.date),
  ]
);

export const guestMeals = pgTable(
  "guest_meals",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    meal: text("meal").$type<MealType>().notNull(),
    guests: integer("guests").notNull(),
    amount: integer("amount").notNull(),
    status: text("status")
      .$type<"booked" | "served" | "cancelled">()
      .notNull()
      .default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("guest_meal_resident_idx").on(t.residentId, t.date)]
);

export const laundrySubscriptions = pgTable("laundry_subscriptions", {
  id: text("id").primaryKey(),
  residentId: text("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  service: text("service")
    .$type<"wash_fold" | "wash_iron" | "iron_only" | "dry_clean">()
    .notNull(),
  piecesPerWeek: integer("pieces_per_week").notNull(),
  pickupDay: integer("pickup_day").notNull(),
  monthlyPrice: integer("monthly_price").notNull(),
  status: text("status")
    .$type<"active" | "paused" | "cancelled">()
    .notNull()
    .default("active"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const housekeepingBookings = pgTable(
  "housekeeping_bookings",
  {
    id: text("id").primaryKey(),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull(),
    serviceName: text("service_name").notNull(),
    date: date("date").notNull(),
    slot: text("slot").notNull(),
    price: integer("price").notNull().default(0),
    notes: text("notes").notNull().default(""),
    status: text("status")
      .$type<"booked" | "in_progress" | "done" | "cancelled">()
      .notNull()
      .default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // A resident can't hold two cleanings in the same slot.
    uniqueIndex("housekeeping_slot_key").on(t.residentId, t.date, t.slot),
    index("housekeeping_date_idx").on(t.date),
  ]
);

export const amenities = pgTable("amenities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind")
    .$type<"coworking" | "study" | "gaming" | "bbq" | "gym" | "other">()
    .notNull(),
  description: text("description").notNull().default(""),
  capacity: integer("capacity").notNull().default(1),
  slotMinutes: integer("slot_minutes").notNull().default(60),
  openFrom: text("open_from").notNull(),
  openTo: text("open_to").notNull(),
  active: boolean("active").notNull().default(true),
});

export const amenityBookings = pgTable(
  "amenity_bookings",
  {
    id: text("id").primaryKey(),
    amenityId: text("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
    residentId: text("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    status: text("status")
      .$type<"booked" | "in_progress" | "done" | "cancelled">()
      .notNull()
      .default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The same person can't hold one slot twice; capacity is enforced in code
    // because it varies per amenity.
    uniqueIndex("amenity_booking_key").on(
      t.amenityId,
      t.date,
      t.startTime,
      t.residentId
    ),
    index("amenity_booking_slot_idx").on(t.amenityId, t.date, t.startTime),
  ]
);

/**
 * Console-editable settings. One row, keyed "default" — this deployment serves
 * a single property, so a settings table beats a properties table until there
 * is a second campus to scope by.
 */
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey(),
  geofenceLatitude: doublePrecision("geofence_latitude").notNull(),
  geofenceLongitude: doublePrecision("geofence_longitude").notNull(),
  geofenceRadiusMetres: integer("geofence_radius_metres").notNull(),
  geofenceLabel: text("geofence_label").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Admin display name, kept as free text so deleting a user can't blank it. */
  updatedBy: text("updated_by"),
});
