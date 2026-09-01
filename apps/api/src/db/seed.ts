import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./client";
import * as t from "./schema";
import { DEMO_MOBILE, DEMO_RESIDENT_ID, isoDate } from "../data/db";
import { hashPassword } from "../admin-auth";

/**
 * Idempotent demo seed. Safe to re-run: it clears only the demo resident's rows
 * (everything cascades from `residents`) and never touches other residents.
 *
 *   npm run db:seed --workspace @proj/api
 */

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed(): Promise<void> {
  console.log("Seeding demo resident…");

  // Cascade deletes rooms, payments, requests, attendance, notifications.
  await db.delete(t.residents).where(eq(t.residents.id, DEMO_RESIDENT_ID));

  await db.insert(t.residents).values({
    id: DEMO_RESIDENT_ID,
    fullName: "Arjun Mehta",
    dob: "2004-03-18",
    gender: "male",
    kycType: "aadhaar",
    kycNumber: "987654321234",
    mobile: DEMO_MOBILE,
    accountStatus: "approved",
    mpin: null,
    biometricEnabled: false,
  });

  await db.insert(t.rooms).values({
    residentId: DEMO_RESIDENT_ID,
    roomNumber: "902",
    floor: "9th floor",
    wing: "B wing",
    buildingName: "Uniliv Block B",
    propertyName: "Uniliv Thapar",
    propertyAddress: "Thapar Institute Campus, Bhadson Road, Patiala 147004",
    roomType: "Twin sharing AC",
    occupancy: "2 of 2 beds occupied",
  });

  await db.insert(t.paymentPlans).values({
    residentId: DEMO_RESIDENT_ID,
    plan: "6 monthly",
    paidUpTo: "2027-02-28",
    nextDueOn: "2027-03-01",
    nextDueAmount: 110000,
  });

  await db.insert(t.paymentEntries).values([
    {
      id: "PAY-9001",
      residentId: DEMO_RESIDENT_ID,
      paidOn: "2026-08-28",
      amount: 110000,
      mode: "cash",
      periodFrom: "2026-09-01",
      periodTo: "2027-02-28",
      receiptNo: "RCPT/2026/9001",
    },
    {
      id: "PAY-8721",
      residentId: DEMO_RESIDENT_ID,
      paidOn: "2026-02-26",
      amount: 104000,
      mode: "upi",
      periodFrom: "2026-03-01",
      periodTo: "2026-08-31",
      receiptNo: "RCPT/2026/8721",
    },
  ]);

  await db.insert(t.foodPreferences).values({
    residentId: DEMO_RESIDENT_ID,
    breakfast: true,
    lunch: true,
    snacks: false,
    dinner: true,
  });

  /* ---------------------------------------------------------- requests */

  await db.insert(t.maintenanceRequests).values([
    {
      id: "MNT-1032",
      residentId: DEMO_RESIDENT_ID,
      title: "AC not working",
      status: "in_progress",
      categoryId: "electrical",
      categoryLabel: "Electrical",
      subCategoryId: "ac",
      subCategoryLabel: "AC not working",
      remarks: "AC is running but not cooling since last night.",
      photoUris: [],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: "MNT-1018",
      residentId: DEMO_RESIDENT_ID,
      title: "Tubelight replacement",
      status: "resolved",
      categoryId: "electrical",
      categoryLabel: "Electrical",
      subCategoryId: "tubelight",
      subCategoryLabel: "Tubelight replacement",
      remarks: "Study table light flickering.",
      photoUris: [],
      createdAt: daysAgo(9),
      updatedAt: daysAgo(8),
    },
  ]);

  await db.insert(t.laundryRequests).values({
    id: "LDY-1027",
    residentId: DEMO_RESIDENT_ID,
    title: "7 pieces",
    status: "in_progress",
    items: [
      { type: "shirt", count: 3, pressing: true },
      { type: "trouser", count: 2, pressing: true },
      { type: "tshirt", count: 2, pressing: false },
    ],
    totalPieces: 7,
    pickupSlot: "Today, 7:00 am - 9:00 am",
    photoUris: [],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  });

  await db.insert(t.complaints).values({
    id: "CMP-1009",
    residentId: DEMO_RESIDENT_ID,
    title: "Food quality",
    status: "resolved",
    categoryId: "mess",
    categoryLabel: "Mess and food",
    subCategoryId: "quality",
    subCategoryLabel: "Food quality",
    remarks: "Dinner dal was too watery on Tuesday.",
    againstRequestId: null,
    createdAt: daysAgo(12),
    updatedAt: daysAgo(10),
  });

  await db.insert(t.visitRequests).values({
    id: "VST-1004",
    residentId: DEMO_RESIDENT_ID,
    title: "Sunita Mehta · Parent",
    status: "resolved",
    visitorName: "Sunita Mehta",
    relation: "parent",
    visitDate: isoDate(daysAgo(20)),
    durationHours: 4,
    foodRequired: true,
    foodSelections: [{ meal: "lunch", items: ["Rajma", "Jeera rice", "Roti"] }],
    createdAt: daysAgo(24),
    updatedAt: daysAgo(22),
  });

  await db.insert(t.trackingEvents).values([
    { requestId: "MNT-1032", status: "submitted", note: "Request received", at: daysAgo(2) },
    { requestId: "MNT-1032", status: "in_progress", note: "Technician assigned, visiting today", at: daysAgo(1) },
    { requestId: "MNT-1018", status: "submitted", note: "Request received", at: daysAgo(9) },
    { requestId: "MNT-1018", status: "resolved", note: "Tubelight replaced", at: daysAgo(8) },
    { requestId: "LDY-1027", status: "submitted", note: "Pickup scheduled", at: daysAgo(1) },
    { requestId: "LDY-1027", status: "in_progress", note: "Clothes picked up and sent for wash", at: daysAgo(1) },
    { requestId: "CMP-1009", status: "submitted", note: "Complaint registered", at: daysAgo(12) },
    { requestId: "CMP-1009", status: "resolved", note: "Discussed with mess vendor, recipe corrected", at: daysAgo(10) },
    { requestId: "VST-1004", status: "submitted", note: "Visit request submitted", at: daysAgo(24) },
    { requestId: "VST-1004", status: "resolved", note: "Approved by warden", at: daysAgo(22) },
  ]);

  /* ------------------------------------------------ attendance + rest */

  await db.insert(t.attendanceRecords).values(
    Array.from({ length: 12 }, (_, i) => {
      const day = daysAgo(i + 1);
      const markedAt = new Date(day);
      markedAt.setHours(21, 12, 0, 0);

      return {
        id: `ATT-${900 + i}`,
        residentId: DEMO_RESIDENT_ID,
        date: isoDate(day),
        markedAt,
        method: (i % 3 === 0 ? "biometric" : "facial") as
          | "biometric"
          | "facial",
        latitude: 30.3549,
        longitude: 76.3626,
        locationLabel: "Uniliv Thapar, Block B",
        photoUri: null,
        withinGeofence: true,
      };
    })
  );

  await db.insert(t.feedbackEntries).values({
    id: "FBK-1002",
    residentId: DEMO_RESIDENT_ID,
    categoryId: "mess",
    categoryLabel: "Mess",
    subCategoryId: "cleanliness",
    subCategoryLabel: "Cleanliness",
    rating: 4,
    remarks: "Dining hall is kept clean, tables wiped between batches.",
    photoUris: [],
    createdAt: daysAgo(5),
  });

  await db.insert(t.notifications).values([
    {
      id: randomUUID(),
      residentId: DEMO_RESIDENT_ID,
      title: "Technician assigned",
      body: "Your AC complaint MNT-1032 has a technician assigned for today.",
      kind: "info",
      href: "/maintenance/MNT-1032",
      read: false,
      createdAt: daysAgo(1),
    },
    {
      id: randomUUID(),
      residentId: DEMO_RESIDENT_ID,
      title: "Laundry picked up",
      body: "7 pieces collected. Expected delivery in 2 days.",
      kind: "success",
      href: "/laundry/LDY-1027",
      read: false,
      createdAt: daysAgo(1),
    },
    {
      id: randomUUID(),
      residentId: DEMO_RESIDENT_ID,
      title: "Mark today's attendance",
      body: "Attendance closes at 10:00 pm. It takes about 20 seconds.",
      kind: "warning",
      href: "/attendance",
      read: true,
      createdAt: daysAgo(0),
    },
  ]);

  await seedAdmins();
  await seedPendingRegistrations();

  console.log(`Seeded ${DEMO_RESIDENT_ID} (${DEMO_MOBILE}). OTP in dev is 123456.`);
  console.log("Admin sign-in: ops@uniliv.test / uniliv123");
}

/** Two reviewers so the "reviewed by" column shows something meaningful. */
async function seedAdmins(): Promise<void> {
  const users = [
    {
      id: "ADM-001",
      name: "Priya Nair",
      email: "ops@uniliv.test",
      role: "ops_excellence" as const,
    },
    {
      id: "ADM-002",
      name: "Rakesh Bhatia",
      email: "warden@uniliv.test",
      role: "warden" as const,
    },
  ];

  for (const user of users) {
    const passwordHash = await hashPassword("uniliv123");
    await db
      .insert(t.adminUsers)
      .values({ ...user, passwordHash, active: true })
      .onConflictDoUpdate({
        target: t.adminUsers.email,
        set: { name: user.name, role: user.role, passwordHash, active: true },
      });
  }
}

/** A queue to review, plus one already-decided pair for the history tabs. */
async function seedPendingRegistrations(): Promise<void> {
  const pending = [
    {
      id: "RES-2026-1101",
      fullName: "Neha Sharma",
      dob: "2005-07-22",
      gender: "female" as const,
      kycType: "aadhaar" as const,
      kycNumber: "432198765012",
      mobile: "9811100011",
      accountStatus: "pending_approval" as const,
      createdAt: daysAgo(1),
    },
    {
      id: "RES-2026-1102",
      fullName: "Karan Gill",
      dob: "2004-11-09",
      gender: "male" as const,
      kycType: "pan" as const,
      kycNumber: "AXQPG4471M",
      mobile: "9811100022",
      accountStatus: "pending_approval" as const,
      createdAt: daysAgo(0),
    },
    {
      id: "RES-2026-1103",
      fullName: "Ishaan Verma",
      dob: "2005-01-30",
      gender: "male" as const,
      kycType: "aadhaar" as const,
      kycNumber: "778812340099",
      mobile: "9811100033",
      accountStatus: "pending_approval" as const,
      createdAt: daysAgo(3),
    },
    {
      id: "RES-2026-1090",
      fullName: "Aditi Rao",
      dob: "2004-05-14",
      gender: "female" as const,
      kycType: "aadhaar" as const,
      kycNumber: "665544332211",
      mobile: "9811100044",
      accountStatus: "rejected" as const,
      createdAt: daysAgo(8),
      reviewedAt: daysAgo(7),
      reviewedBy: "Priya Nair",
      reviewNote: "Aadhaar number didn't match the document provided.",
    },
  ];

  for (const row of pending) {
    await db.delete(t.residents).where(eq(t.residents.id, row.id));
    await db.insert(t.residents).values(row);
  }
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
