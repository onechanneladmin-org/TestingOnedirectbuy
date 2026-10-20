/**
 * ZUKAongo design tokens, captured from the live sites on 2026-10-17
 * (zukaongo.com :root variables + computed styles of the three apps).
 *
 * Surfaces:
 *   marketing — zukaongo.com landing, /partner and legal pages (HTML/CSS site)
 *   customer  — zukaongo.com web app (Expo / React Native Web)
 *   admin     — admin.zukaongo.com (Expo)
 *   partner   — drivers.zukaongo.com / partners.zukaongo.com (Expo)
 */

/** Brand palette (hex). Names follow the marketing site's CSS variables. */
const PALETTE = {
  action: "#C94E00", // --action: primary CTA
  actionHover: "#A84100", // --action-hover, links/accents in the apps
  sun: "#FF6A00", // --sun
  yellow: "#FFB800", // --yellow
  tint: "#FFF1E5", // selected chip / soft CTA background
  paper: "#FFF7EF", // --paper
  green: "#15803D", // --green
  green2: "#237032", // admin "open" status text
  ink: "#0F172A", // --ink: headings, dark buttons
  ink2: "#334155", // --ink-2
  muted: "#475569", // --muted
  zinc600: "#52525B", // app body text
  zinc500: "#71717A", // app secondary text
  stone400: "#A8A29E", // admin tertiary text
  line: "#E2E8F0", // --line
  surface: "#F5F5F4", // app background
  surface2: "#FAFAF9",
  white: "#FFFFFF",
  onInkMuted: "#CBD5E1", // --on-ink-muted
  // Status badges used across admin / partner
  info: "#1C4ED8",
  violet: "#6D28D9",
  danger: "#B91C1C",
  dangerSoft: "#DC2626",
};

/** Filled button/tab backgrounds that are on-brand. */
const FILLED_CONTROL_BG = [
  PALETTE.action, PALETTE.actionHover, PALETTE.sun, PALETTE.tint, PALETTE.paper,
  PALETTE.ink, PALETTE.white, PALETTE.surface, PALETTE.surface2, PALETTE.line,
  PALETTE.green, "#F0FDF4", "#DCFCE7", "#EFF6FF", "#DBEAFE", "#FEF2F2", "#FEE2E2", "#F5F3FF", "#EDE9FE",
  "#FAFAFA", "#F4F4F5", "#E4E4E7", "#F1F5F9", "#F8FAFC", "#FFFBEB", "#FEF3C7",
];

/** Icon fonts never count as typography. */
const ICON_FONTS = /ionicons|feather|materialicons|material ?icons|fontawesome|anticon|entypo|octicons|simple-line-icons|zocial|foundation|evilicons|antdesign|materialcommunityicons/i;

const SURFACES = {
  marketing: {
    label: "Marketing site",
    fonts: [/^DM Sans$/i, /^Bricolage Grotesque$/i, /^system-ui$/i, /^-apple-system$/i, /^Segoe UI$/i, /^sans-serif$/i],
    headingFont: /Bricolage Grotesque/i,
    radii: ["0px", "4px", "6px", "8px", "10px", "12px", "14px", "16px", "18px", "20px", "24px", "999px", "9999px", "50%"],
  },
  customer: {
    label: "Customer app",
    fonts: [/^DMSans_/i, /^DM Sans$/i, /^-apple-system$/i, /^system-ui$/i],
    radii: ["0px", "4px", "6px", "8px", "10px", "12px", "14px", "16px", "20px", "24px", "999px", "50%"],
  },
  admin: {
    label: "Admin console",
    fonts: [/^Inter_/i, /^Inter$/i, /^-apple-system$/i, /^system-ui$/i],
    radii: ["0px", "4px", "6px", "8px", "9px", "10px", "12px", "14px", "16px", "20px", "999px", "50%"],
  },
  partner: {
    label: "Partner app",
    fonts: [/^Inter_/i, /^Inter$/i, /^-apple-system$/i, /^system-ui$/i],
    radii: ["0px", "4px", "6px", "8px", "9px", "10px", "12px", "14px", "16px", "20px", "999px", "50%"],
  },
};

/** Budgets. */
const BUDGETS = {
  settleMs: 8000, // page usable within 8s
  settleMsCritical: 20000,
  minTouchDesktop: 24, // WCAG 2.2 AA target size (minimum)
  minTouchMobile: 44, // Apple HIG / Material guidance on phones
  contrastNormal: 4.5,
  contrastLarge: 3,
  colorTolerance: 18, // RGB distance treated as "same token"
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

module.exports = { PALETTE, FILLED_CONTROL_BG, ICON_FONTS, SURFACES, BUDGETS, hexToRgb };
