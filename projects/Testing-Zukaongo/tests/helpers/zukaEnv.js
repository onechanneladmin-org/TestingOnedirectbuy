/**
 * ZUKAongo sites, test accounts and run flags.
 * Passwords come only from .env / CI secrets (see .env.example).
 */
export const CUSTOMER_URL = (process.env.ZUKA_CUSTOMER_URL || "https://zukaongo.com").replace(/\/$/, "");
export const ADMIN_URL = (process.env.ZUKA_ADMIN_URL || "https://admin.zukaongo.com").replace(/\/$/, "");
export const PARTNER_URL = (process.env.ZUKA_PARTNER_URL || "https://drivers.zukaongo.com").replace(/\/$/, "");
export const PARTNER_ALIAS_URL = (process.env.ZUKA_PARTNER_ALIAS_URL || "https://partners.zukaongo.com").replace(/\/$/, "");

/** Grand Cayman postal code used to set the delivery pin (doc §3.1 step 1). */
export const DELIVERY_POSTAL_CODE = process.env.ZUKA_DELIVERY_ADDRESS || "KY1-1201";

/** George Town, Grand Cayman — browser geolocation for "Use current location". */
export const CAYMAN_GEO = { latitude: 19.2958, longitude: -81.3812 };

const testPassword = process.env.ZUKA_TEST_PASSWORD || "";

/**
 * portal: which site the account signs in to.
 * vendors: restaurants a reception login is scoped to (doc §1).
 */
export const ACCOUNTS = {
  admin: {
    label: "Superadmin",
    portal: "admin",
    email: process.env.ZUKA_ADMIN_EMAIL || "admin@onechanneladmin.com",
    password: process.env.ZUKA_ADMIN_PASSWORD || "",
    role: "superadmin",
  },
  driver: {
    label: "Driver",
    portal: "partner",
    email: process.env.ZUKA_DRIVER_EMAIL || "test-driver@zuka.test",
    password: process.env.ZUKA_DRIVER_PASSWORD || testPassword,
    role: "delivery",
  },
  driver2: {
    label: "Driver 2",
    portal: "partner",
    email: process.env.ZUKA_DRIVER2_EMAIL || "test-driver-2@zuka.test",
    password: process.env.ZUKA_DRIVER2_PASSWORD || testPassword,
    role: "delivery",
  },
  kitchen: {
    label: "Kitchen (Burger House)",
    portal: "admin",
    email: process.env.ZUKA_KITCHEN_EMAIL || "test-kitchen@zuka.test",
    password: process.env.ZUKA_KITCHEN_PASSWORD || testPassword,
    role: "reception",
    vendors: ["Burger House"],
  },
  grocery: {
    label: "Grocery (Fresh Mart)",
    portal: "admin",
    email: process.env.ZUKA_GROCERY_EMAIL || "test-grocery@zuka.test",
    password: process.env.ZUKA_GROCERY_PASSWORD || testPassword,
    role: "reception",
    vendors: ["Fresh Mart"],
  },
  kitchenMulti: {
    label: "Kitchen multi (Pizza + Ramen)",
    portal: "admin",
    email: process.env.ZUKA_KITCHEN_MULTI_EMAIL || "test-kitchen-multi@zuka.test",
    password: process.env.ZUKA_KITCHEN_MULTI_PASSWORD || testPassword,
    role: "reception",
    vendors: ["Mama's Pizza", "Tokyo Ramen"],
  },
  customer: {
    label: "Customer",
    portal: "customer",
    email: process.env.ZUKA_CUSTOMER_EMAIL || "test-customer@zuka.test",
    password: process.env.ZUKA_CUSTOMER_PASSWORD || testPassword,
    role: "customer",
  },
  customer2: {
    label: "Customer 2",
    portal: "customer",
    email: process.env.ZUKA_CUSTOMER2_EMAIL || "test-customer-2@zuka.test",
    password: process.env.ZUKA_CUSTOMER2_PASSWORD || testPassword,
    role: "customer",
  },
};

export const PORTAL_URL = {
  customer: CUSTOMER_URL,
  admin: ADMIN_URL,
  partner: PARTNER_URL,
};

/** Superadmin console sections (left nav) and their routes. */
export const ADMIN_SECTIONS = [
  { id: "ZUKA-ADM-NAV-01", nav: "Vendors", path: "/", heading: "Vendors" },
  { id: "ZUKA-ADM-NAV-02", nav: "Orders", path: "/orders", heading: "Orders" },
  { id: "ZUKA-ADM-NAV-03", nav: "Reservations", path: "/reservations", heading: "Reservations" },
  { id: "ZUKA-ADM-NAV-04", nav: "People", path: "/people", heading: "People" },
  { id: "ZUKA-ADM-NAV-05", nav: "Customers", path: "/customers", heading: "Customers" },
  { id: "ZUKA-ADM-NAV-06", nav: "Support", path: "/support", heading: "Support" },
  { id: "ZUKA-ADM-NAV-07", nav: "Partners", path: "/partners", heading: "Partners" },
  { id: "ZUKA-ADM-NAV-08", nav: "Meal pass", path: "/meal-pass", heading: "Meal Pass" },
  { id: "ZUKA-ADM-NAV-09", nav: "Coupons", path: "/coupons", heading: "Coupons & discounts" },
  { id: "ZUKA-ADM-NAV-10", nav: "Kitchen", path: "/kitchen", heading: "Kitchen board" },
  { id: "ZUKA-ADM-NAV-11", nav: "Desk", path: "/desk", heading: "Kitchen desk" },
  { id: "ZUKA-ADM-NAV-12", nav: "Drive", path: "/drive", heading: "Deliveries" },
  { id: "ZUKA-ADM-NAV-13", nav: "Analytics", path: "/analytics", heading: "Platform analytics" },
  { id: "ZUKA-ADM-NAV-14", nav: "Settings", path: "/settings", heading: "Marketplace settings" },
];

/** Sections a reception (restaurant) login sees; the rest are superadmin-only. */
export const RECEPTION_NAV = ["Vendors", "Orders", "Reservations", "Meal pass", "Kitchen", "Drive", "Analytics"];
export const SUPERADMIN_ONLY_NAV = ["People", "Customers", "Support", "Partners", "Coupons", "Desk", "Settings"];

/** The restaurant the order lifecycle uses: open 00:00–23:59 and owned by the kitchen login. */
export const E2E_VENDOR = { id: "burger-house", name: "Burger House" };

function flag(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

/** Live order lifecycle (pays with Zuka Credit on the test customer). On by default. */
export const ALLOW_ORDER_E2E = flag("ZUKA_ALLOW_ORDER_E2E", true);
/** Submitting partner applications emails the support inbox. Off by default. */
export const ALLOW_PARTNER_SUBMIT = flag("ZUKA_ALLOW_PARTNER_SUBMIT", false);

export function hasPassword(accountKey) {
  return Boolean(ACCOUNTS[accountKey]?.password);
}

export const STEP_TIMEOUT = 30_000;
