import type { CategoryOption, DayMenu, MealType } from "@proj/shared";

/** Static reference data. In production this would live in a CMS or admin UI. */

export const MAINTENANCE_CATEGORIES: CategoryOption[] = [
  {
    id: "electrical",
    label: "Electrical",
    subCategories: [
      { id: "tubelight", label: "Tubelight replacement" },
      { id: "ac", label: "AC not working" },
      { id: "fan", label: "Fan not working" },
      { id: "socket", label: "Switch or socket faulty" },
      { id: "geyser", label: "Geyser not heating" },
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    subCategories: [
      { id: "tap-leak", label: "Tap is leaking" },
      { id: "drain", label: "Drain is blocked" },
      { id: "flush", label: "Flush not working" },
      { id: "no-water", label: "No water supply" },
    ],
  },
  {
    id: "furniture",
    label: "Furniture and fittings",
    subCategories: [
      { id: "mirror", label: "Mirror is broken" },
      { id: "door-latch", label: "Door latch needs replacement" },
      { id: "cupboard", label: "Cupboard door damaged" },
      { id: "bed", label: "Bed or mattress issue" },
      { id: "study-table", label: "Study table damaged" },
    ],
  },
  {
    id: "access",
    label: "Room access",
    subCategories: [
      { id: "key-lost", label: "Room key lost" },
      { id: "lock-jam", label: "Lock is jammed" },
      { id: "access-card", label: "Access card not working" },
    ],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    subCategories: [
      { id: "deep-clean", label: "Deep cleaning needed" },
      { id: "pest", label: "Pest control" },
      { id: "garbage", label: "Garbage not collected" },
    ],
  },
];

export const COMPLAINT_CATEGORIES: CategoryOption[] = [
  {
    id: "laundry",
    label: "Laundry",
    subCategories: [
      { id: "missing", label: "Clothes missing" },
      { id: "damaged", label: "Clothes damaged" },
      { id: "late", label: "Delivered late" },
      { id: "not-clean", label: "Not cleaned properly" },
    ],
  },
  {
    id: "mess",
    label: "Mess and food",
    subCategories: [
      { id: "quality", label: "Food quality" },
      { id: "hygiene", label: "Hygiene" },
      { id: "quantity", label: "Portion size" },
      { id: "timing", label: "Serving timings" },
    ],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    subCategories: [
      { id: "room-clean", label: "Room not cleaned" },
      { id: "washroom", label: "Common washroom unclean" },
      { id: "corridor", label: "Corridor unclean" },
    ],
  },
  {
    id: "security",
    label: "Security",
    subCategories: [
      { id: "gate", label: "Gate access issue" },
      { id: "unknown-visitor", label: "Unknown visitor" },
      { id: "cctv", label: "CCTV not working" },
    ],
  },
  {
    id: "staff",
    label: "Staff behaviour",
    subCategories: [
      { id: "rude", label: "Rude behaviour" },
      { id: "unresponsive", label: "Unresponsive to request" },
    ],
  },
];

export const FEEDBACK_CATEGORIES: CategoryOption[] = [
  {
    id: "mess",
    label: "Mess",
    subCategories: [
      { id: "food", label: "Food" },
      { id: "cleanliness", label: "Cleanliness" },
      { id: "water", label: "Availability of water" },
      { id: "staff", label: "Staff" },
    ],
  },
  {
    id: "room",
    label: "Room",
    subCategories: [
      { id: "cleanliness", label: "Cleanliness" },
      { id: "maintenance", label: "Maintenance response" },
      { id: "comfort", label: "Comfort" },
    ],
  },
  {
    id: "laundry",
    label: "Laundry",
    subCategories: [
      { id: "quality", label: "Wash quality" },
      { id: "turnaround", label: "Turnaround time" },
    ],
  },
  {
    id: "facilities",
    label: "Facilities",
    subCategories: [
      { id: "wifi", label: "Wi-Fi" },
      { id: "gym", label: "Gym" },
      { id: "common-area", label: "Common area" },
      { id: "security", label: "Security" },
    ],
  },
];

export const LAUNDRY_SLOTS = [
  "Today, 7:00 am - 9:00 am",
  "Today, 5:00 pm - 7:00 pm",
  "Tomorrow, 7:00 am - 9:00 am",
  "Tomorrow, 5:00 pm - 7:00 pm",
];

const MENU_ROTATION: Record<MealType, { servingWindow: string; items: { name: string; veg: boolean }[] }[]> = {
  breakfast: [
    {
      servingWindow: "7:30 am - 9:30 am",
      items: [
        { name: "Poha", veg: true },
        { name: "Boiled eggs", veg: false },
        { name: "Banana", veg: true },
        { name: "Tea or coffee", veg: true },
      ],
    },
    {
      servingWindow: "7:30 am - 9:30 am",
      items: [
        { name: "Aloo paratha", veg: true },
        { name: "Curd", veg: true },
        { name: "Omelette", veg: false },
        { name: "Tea or coffee", veg: true },
      ],
    },
    {
      servingWindow: "7:30 am - 9:30 am",
      items: [
        { name: "Idli and sambar", veg: true },
        { name: "Coconut chutney", veg: true },
        { name: "Tea or coffee", veg: true },
      ],
    },
  ],
  lunch: [
    {
      servingWindow: "12:30 pm - 2:30 pm",
      items: [
        { name: "Rajma", veg: true },
        { name: "Jeera rice", veg: true },
        { name: "Roti", veg: true },
        { name: "Salad", veg: true },
      ],
    },
    {
      servingWindow: "12:30 pm - 2:30 pm",
      items: [
        { name: "Chole", veg: true },
        { name: "Steamed rice", veg: true },
        { name: "Roti", veg: true },
        { name: "Curd", veg: true },
      ],
    },
    {
      servingWindow: "12:30 pm - 2:30 pm",
      items: [
        { name: "Chicken curry", veg: false },
        { name: "Paneer butter masala", veg: true },
        { name: "Roti", veg: true },
        { name: "Rice", veg: true },
      ],
    },
  ],
  snacks: [
    {
      servingWindow: "5:00 pm - 6:00 pm",
      items: [
        { name: "Samosa", veg: true },
        { name: "Tea", veg: true },
      ],
    },
    {
      servingWindow: "5:00 pm - 6:00 pm",
      items: [
        { name: "Veg sandwich", veg: true },
        { name: "Coffee", veg: true },
      ],
    },
    {
      servingWindow: "5:00 pm - 6:00 pm",
      items: [
        { name: "Pakora", veg: true },
        { name: "Tea", veg: true },
      ],
    },
  ],
  dinner: [
    {
      servingWindow: "7:30 pm - 9:30 pm",
      items: [
        { name: "Dal tadka", veg: true },
        { name: "Mixed veg", veg: true },
        { name: "Roti", veg: true },
        { name: "Rice", veg: true },
        { name: "Gulab jamun", veg: true },
      ],
    },
    {
      servingWindow: "7:30 pm - 9:30 pm",
      items: [
        { name: "Egg curry", veg: false },
        { name: "Aloo gobi", veg: true },
        { name: "Roti", veg: true },
        { name: "Rice", veg: true },
      ],
    },
    {
      servingWindow: "7:30 pm - 9:30 pm",
      items: [
        { name: "Paneer bhurji", veg: true },
        { name: "Dal fry", veg: true },
        { name: "Roti", veg: true },
        { name: "Rice", veg: true },
      ],
    },
  ],
};

/** Deterministic menu so the same date always returns the same meals. */
export function menuForDate(date: string): DayMenu {
  const dayIndex = Math.abs(
    [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );

  const pick = <T,>(arr: T[]): T => arr[dayIndex % arr.length] as T;

  return {
    date,
    meals: {
      breakfast: pick(MENU_ROTATION.breakfast),
      lunch: pick(MENU_ROTATION.lunch),
      snacks: pick(MENU_ROTATION.snacks),
      dinner: pick(MENU_ROTATION.dinner),
    },
  };
}
