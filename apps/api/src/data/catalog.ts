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

/* ------------------------------------------------- onboarding reference */

/**
 * The move-in checklist template. `blockedBy` ties a step to another flow, so
 * a resident can't tick "keys collected" before the lease is actually signed.
 */
export const MOVE_IN_TASKS: {
  key: string;
  label: string;
  description: string;
  blockedBy: "kyc" | "lease" | "inventory" | null;
}[] = [
  {
    key: "documents",
    label: "Upload your ID documents",
    description: "Aadhaar and a passport photo. Takes about two minutes.",
    blockedBy: "kyc",
  },
  {
    key: "agreement",
    label: "Read and sign the agreement",
    description: "Check the rent, deposit and notice period before signing.",
    blockedBy: "lease",
  },
  {
    key: "roommate_profile",
    label: "Fill in your living habits",
    description: "Used to pair you with a compatible roommate.",
    blockedBy: null,
  },
  {
    key: "inventory",
    label: "Check the room and record its condition",
    description:
      "Photograph anything already damaged. This protects your deposit later.",
    blockedBy: "inventory",
  },
  {
    key: "keys",
    label: "Collect your keys and access card",
    description: "From the front desk, any time between 9 am and 8 pm.",
    blockedBy: null,
  },
  {
    key: "wifi",
    label: "Get on the Wi-Fi",
    description: "The front desk will give you the network name and password.",
    blockedBy: null,
  },
  {
    key: "mess",
    label: "Set your meal preferences",
    description: "Choose which meals you want, so the mess can plan.",
    blockedBy: null,
  },
  {
    key: "house_rules",
    label: "Read the house rules",
    description: "Quiet hours, visitors, and what to do in an emergency.",
    blockedBy: null,
  },
];

/** Standard fittings checked at move-in. */
export const INVENTORY_TEMPLATE = [
  "Bed frame",
  "Mattress",
  "Study table",
  "Chair",
  "Wardrobe",
  "Tubelight",
  "Ceiling fan",
  "Air conditioner",
  "Window and latch",
  "Curtains",
  "Door lock",
  "Mirror",
  "Washroom fittings",
  "Power sockets",
];

/**
 * Tour spaces: what the hostel is made of, which doesn't change. The pictures
 * of them do, and live in `tour_media` — `withTourMedia` lays whatever has
 * been uploaded over this list. `panoramaUri` here is the fallback for a space
 * with nothing uploaded, and the viewer shows a placeholder for those.
 */
export const TOUR_SPACES = [
  {
    id: "room-twin",
    name: "Twin sharing room",
    kind: "room" as const,
    description: "Two beds, two study desks, attached washroom, AC.",
    panoramaUri: null as string | null,
    hotspots: [
      { x: 0.25, label: "Washroom", target: "washroom" },
      { x: 0.75, label: "Corridor", target: "corridor" },
    ],
  },
  {
    id: "washroom",
    name: "Attached washroom",
    kind: "room" as const,
    description: "Geyser, shower, western WC.",
    panoramaUri: null as string | null,
    hotspots: [{ x: 0.5, label: "Back to room", target: "room-twin" }],
  },
  {
    id: "corridor",
    name: "Floor corridor",
    kind: "common" as const,
    description: "Lift lobby, water point and housekeeping station.",
    panoramaUri: null as string | null,
    hotspots: [
      { x: 0.2, label: "Common room", target: "common-room" },
      { x: 0.8, label: "Back to room", target: "room-twin" },
    ],
  },
  {
    id: "common-room",
    name: "Common room",
    kind: "amenity" as const,
    description: "TV, board games and seating for about twenty.",
    panoramaUri: null as string | null,
    hotspots: [{ x: 0.5, label: "Mess hall", target: "mess" }],
  },
  {
    id: "mess",
    name: "Mess hall",
    kind: "amenity" as const,
    description: "Seats 120, serves four meals a day.",
    panoramaUri: null as string | null,
    hotspots: [{ x: 0.5, label: "Common room", target: "common-room" }],
  },
];

/** Plan of the twin-sharing room, in centimetres, for the layout planner. */
export const ROOM_PLAN = {
  spaceId: "room-twin",
  name: "Twin sharing room",
  widthCm: 380,
  depthCm: 300,
  fixtures: [
    { name: "Bed A", xCm: 10, yCm: 10, widthCm: 90, depthCm: 190 },
    { name: "Bed B", xCm: 280, yCm: 10, widthCm: 90, depthCm: 190 },
    { name: "Window", xCm: 140, yCm: 0, widthCm: 100, depthCm: 8 },
    { name: "Door", xCm: 0, yCm: 240, widthCm: 8, depthCm: 90 },
    { name: "Wardrobe", xCm: 300, yCm: 210, widthCm: 70, depthCm: 55 },
  ],
};

/** Furniture a resident might bring, sized realistically. */
export const LAYOUT_PIECES = [
  { id: "study-chair", name: "Study chair", widthCm: 50, depthCm: 50 },
  { id: "mini-fridge", name: "Mini fridge", widthCm: 50, depthCm: 50 },
  { id: "bookshelf", name: "Bookshelf", widthCm: 80, depthCm: 30 },
  { id: "floor-lamp", name: "Floor lamp", widthCm: 35, depthCm: 35 },
  { id: "bean-bag", name: "Bean bag", widthCm: 80, depthCm: 80 },
  { id: "drying-rack", name: "Drying rack", widthCm: 60, depthCm: 55 },
  { id: "suitcase", name: "Suitcase", widthCm: 75, depthCm: 30 },
];

/* ------------------------------------------- daily living reference data */

/** Laundry subscription tiers. Prices are whole rupees per month. */
export const LAUNDRY_PLANS = [
  {
    plan: "Light",
    service: "wash_fold" as const,
    piecesPerWeek: 10,
    monthlyPrice: 599,
    description: "Up to 10 pieces a week, washed and folded.",
  },
  {
    plan: "Regular",
    service: "wash_iron" as const,
    piecesPerWeek: 20,
    monthlyPrice: 999,
    description: "Up to 20 pieces a week, washed and ironed.",
  },
  {
    plan: "Heavy",
    service: "wash_iron" as const,
    piecesPerWeek: 35,
    monthlyPrice: 1499,
    description: "Up to 35 pieces a week, plus bedsheets and towels.",
  },
];

/** Per-piece prices for one-off orders outside a subscription. */
export const LAUNDRY_SERVICE_PRICES: Record<string, number> = {
  wash_fold: 15,
  wash_iron: 25,
  iron_only: 10,
  dry_clean: 120,
};

export const HOUSEKEEPING_SERVICES = [
  {
    id: "routine",
    name: "Routine room clean",
    description: "Sweep, mop, dust and bin. Included in your rent.",
    price: 0,
    durationMinutes: 30,
    addOn: false,
  },
  {
    id: "deep-clean",
    name: "Deep cleaning",
    description: "Behind furniture, inside the wardrobe, windows and fans.",
    price: 499,
    durationMinutes: 120,
    addOn: true,
  },
  {
    id: "bathroom",
    name: "Bathroom sanitisation",
    description: "Descaling, disinfecting and drain clearing.",
    price: 299,
    durationMinutes: 45,
    addOn: true,
  },
  {
    id: "upholstery",
    name: "Upholstery and mattress",
    description: "Vacuum and shampoo the mattress and any soft furniture.",
    price: 699,
    durationMinutes: 90,
    addOn: true,
  },
  {
    id: "pest",
    name: "Pest control",
    description: "Cockroach and ant treatment, gel-based and odourless.",
    price: 399,
    durationMinutes: 60,
    addOn: true,
  },
];

/** Housekeeping works in fixed slots so the team can be routed sensibly. */
export const HOUSEKEEPING_SLOTS = [
  "8:00 am - 10:00 am",
  "10:00 am - 12:00 pm",
  "12:00 pm - 2:00 pm",
  "2:00 pm - 4:00 pm",
  "4:00 pm - 6:00 pm",
];

export const AMENITY_SEED = [
  {
    id: "AMN-COWORK",
    name: "Coworking pod",
    kind: "coworking" as const,
    description: "Six-seat quiet pod with power and monitors.",
    capacity: 6,
    slotMinutes: 60,
    openFrom: "08:00",
    openTo: "22:00",
  },
  {
    id: "AMN-STUDY",
    name: "Private study room",
    kind: "study" as const,
    description: "Bookable one at a time, whiteboard included.",
    capacity: 1,
    slotMinutes: 60,
    openFrom: "07:00",
    openTo: "23:00",
  },
  {
    id: "AMN-GAMING",
    name: "Gaming zone",
    kind: "gaming" as const,
    description: "Console, projector and four controllers.",
    capacity: 4,
    slotMinutes: 60,
    openFrom: "16:00",
    openTo: "23:00",
  },
  {
    id: "AMN-BBQ",
    name: "Rooftop BBQ",
    kind: "bbq" as const,
    description: "Grill, seating for twelve. Two-hour slots.",
    capacity: 1,
    slotMinutes: 120,
    openFrom: "17:00",
    openTo: "23:00",
  },
];

/** What a guest pays per meal, charged to the resident. */
export const GUEST_MEAL_PRICES: Record<string, number> = {
  breakfast: 80,
  lunch: 140,
  snacks: 60,
  dinner: 150,
};

/** The quality bar the mess vendor is held to, out of 5. */
export const MESS_SLA_TARGET = 3.5;
export const MESS_SLA_WINDOW_DAYS = 30;
