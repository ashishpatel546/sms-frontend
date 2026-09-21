/**
 * The one place a parent-portal section becomes a colour and a glyph.
 *
 * Two things live here that are deliberately kept apart everywhere else:
 *
 * 1. **Fixed gradients, written out in full.** Every other colour in this app
 *    comes from the semantic tokens, which `[data-palette='assembly']` re-tints
 *    wholesale. These chips must NOT re-tint — they are app icons, and a parent
 *    learns them by colour, so orange has to stay orange whichever palette and
 *    theme the school picked.
 *
 *    They are single arbitrary values rather than `bg-linear-to-br from-blue-500`
 *    pairs for a concrete reason: the legacy bridge in `globals.css` matches
 *    exactly those compound selectors and flattens blue, indigo, violet and
 *    purple gradients to brass with `!important`, to stop old pages inventing a
 *    second brand colour. Written this way the chips carry their own value and
 *    the bridge has nothing to match, so Homework stays blue instead of
 *    silently turning gold.
 *
 *    Each gradient runs saturated-mid to deep, never from a pale 400 step: the
 *    midpoint has to clear 3:1 against the white glyph (WCAG's floor for
 *    graphical objects), and a pale chip reads as disabled next to its
 *    neighbours.
 *
 * 2. **Vendored Material Symbols glyphs** (Rounded, filled, weight 400).
 *    DESIGN.md says lucide, and lucide is still the rule everywhere else — but
 *    lucide is stroke-only, and a white outline on a vivid chip reads as a
 *    sticker rather than an app icon. The twelve paths below are inlined rather
 *    than pulled from `@material-symbols-svg/react` or
 *    `@nine-thirty-five/material-symbols-react`, both of which ship 30–55 MB to
 *    node_modules to deliver these same twelve shapes.
 *
 *    Material Symbols are Apache-2.0 (Google); see NOTICE at the bottom.
 */

export type SectionKey =
  | 'attendance'
  | 'homework'
  | 'fees'
  | 'results'
  | 'ai-tutor'
  | 'library'
  | 'exam-schedule'
  | 'leaves'
  | 'pickup'
  | 'id-card'
  | 'holidays'
  | 'activities'
  | 'info';

export interface SectionStyle {
  label: string;
  /** Raw SVG path data, 24×24 viewBox. */
  path: string;
  /** Static class string — Tailwind's scanner needs to see it spelled out. */
  gradient: string;
}

/**
 * The seven a parent opens on an ordinary day. The rest sit behind "More" so
 * the grid is two calm rows rather than three busy ones.
 */
export const QUICK_ACCESS_PRIMARY: SectionKey[] = [
  'attendance',
  'homework',
  'fees',
  'results',
  'ai-tutor',
  'library',
  'exam-schedule',
];

export const QUICK_ACCESS_SECONDARY: SectionKey[] = [
  'leaves',
  'pickup',
  'id-card',
  'holidays',
  'activities',
  'info',
];

export const SECTION_STYLE: Record<SectionKey, SectionStyle> = {
  attendance: {
    label: 'Attendance',
    gradient: 'bg-[linear-gradient(135deg,#10b981_0%,#047857_100%)]', // emerald 500→700
    path: 'm10.95 15.45l3.475-3.475q.3-.3.725-.3t.725.3t.3.725t-.3.725L11.65 17.65q-.3.3-.7.3t-.7-.3l-2.125-2.125q-.3-.3-.3-.725t.3-.725t.725-.3t.725.3zM5 22q-.825 0-1.412-.587T3 20V6q0-.825.588-1.412T5 4h1V3q0-.425.288-.712T7 2t.713.288T8 3v1h8V3q0-.425.288-.712T17 2t.713.288T18 3v1h1q.825 0 1.413.588T21 6v14q0 .825-.587 1.413T19 22zm0-2h14V10H5z',
  },
  homework: {
    label: 'Homework',
    gradient: 'bg-[linear-gradient(135deg,#3b82f6_0%,#1d4ed8_100%)]', // blue 500→700
    path: 'M13 17.05q1.1-.525 2.213-.788T17.5 16q.9 0 1.763.15T21 16.6V6.7q-.825-.35-1.713-.525T17.5 6q-1.175 0-2.325.3T13 7.2zm-1.662 2.338q-.313-.088-.588-.238q-.975-.575-2.05-.862T6.5 18q-1.05 0-2.062.275T2.5 19.05q-.525.275-1.012-.025T1 18.15V6.1q0-.275.138-.525T1.55 5.2q1.175-.575 2.413-.888T6.5 4q1.45 0 2.838.375T12 5.5q1.275-.75 2.663-1.125T17.5 4q1.3 0 2.538.313t2.412.887q.275.125.413.375T23 6.1v12.05q0 .575-.487.875t-1.013.025q-.925-.5-1.937-.775T17.5 18q-1.125 0-2.2.288t-2.05.862q-.275.15-.587.238t-.663.087t-.663-.088M14 8.776q0-.225.163-.462T14.525 8q.725-.25 1.45-.375T17.5 7.5q.5 0 .988.063t.962.162q.225.05.388.25t.162.45q0 .425-.275.625t-.7.1q-.35-.075-.737-.112T17.5 9q-.65 0-1.275.125t-1.2.325q-.45.175-.737-.025T14 8.775m0 5.5q0-.225.163-.462t.362-.313q.725-.25 1.45-.375T17.5 13q.5 0 .988.063t.962.162q.225.05.388.25t.162.45q0 .425-.275.625t-.7.1q-.35-.075-.737-.112T17.5 14.5q-.65 0-1.275.113t-1.2.312q-.45.175-.737-.012T14 14.275m0-2.75q0-.225.163-.462t.362-.313q.725-.25 1.45-.375t1.525-.125q.5 0 .988.063t.962.162q.225.05.388.25t.162.45q0 .425-.275.625t-.7.1q-.35-.075-.737-.112t-.788-.038q-.65 0-1.275.125t-1.2.325q-.45.175-.737-.025t-.288-.65',
  },
  fees: {
    label: 'Fees',
    gradient: 'bg-[linear-gradient(135deg,#f97316_0%,#c2410c_100%)]', // orange 500→700
    path: 'm13.425 20.7l-6.15-6.4q-.125-.125-.2-.312T7 13.6V13q0-.425.288-.712T8 12h2.5q1.325 0 2.288-.862T13.95 9H7q-.425 0-.712-.288T6 8t.288-.712T7 7h6.65q-.425-.875-1.263-1.437T10.5 5H7q-.425 0-.712-.288T6 4t.288-.712T7 3h10q.425 0 .713.288T18 4t-.288.713T17 5h-2.25q.35.425.625.925T15.8 7H17q.425 0 .713.288T18 8t-.288.713T17 9h-1.025q-.2 2.125-1.75 3.563T10.5 14h-.725l5.1 5.3q.45.475.188 1.088T14.15 21q-.2 0-.387-.075t-.338-.225',
  },
  results: {
    label: 'Results',
    gradient: 'bg-[linear-gradient(135deg,#8b5cf6_0%,#6d28d9_100%)]', // violet 500→700
    path: 'M17 20q-.425 0-.712-.288T16 19v-5q0-.425.288-.712T17 13h2q.425 0 .713.288T20 14v5q0 .425-.288.713T19 20zm-6 0q-.425 0-.712-.288T10 19V5q0-.425.288-.712T11 4h2q.425 0 .713.288T14 5v14q0 .425-.288.713T13 20zm-6 0q-.425 0-.712-.288T4 19v-9q0-.425.288-.712T5 9h2q.425 0 .713.288T8 10v9q0 .425-.288.713T7 20z',
  },
  'ai-tutor': {
    label: 'AI tutor',
    gradient: 'bg-[linear-gradient(135deg,#d946ef_0%,#a21caf_100%)]', // fuchsia 500→700
    path: 'M5 21q-.425 0-.712-.288T4 20v-4q0-.825.588-1.412T6 14h12q.825 0 1.413.588T20 16v4q0 .425-.288.713T19 21zm4-8q-2.075 0-3.537-1.463T4 8t1.463-3.537T9 3h6q2.075 0 3.538 1.463T20 8t-1.463 3.538T15 13zm.713-4.288Q10 8.425 10 8t-.288-.712T9 7t-.712.288T8 8t.288.713T9 9t.713-.288m6 0Q16 8.426 16 8t-.288-.712T15 7t-.712.288T14 8t.288.713T15 9t.713-.288',
  },
  library: {
    label: 'Library',
    gradient: 'bg-[linear-gradient(135deg,#0d9488_0%,#115e59_100%)]', // teal 600→800
    path: 'M3 17.15V10q0-.8.588-1.35t1.387-.5q1.975.3 3.763 1.163T12 11.55q1.475-1.375 3.263-2.238t3.762-1.162q.8-.05 1.388.5T21 10v7.15q0 .8-.525 1.363t-1.325.612q-1.6.25-3.1.825t-2.8 1.525q-.275.225-.587.337t-.663.113t-.663-.112t-.587-.338q-1.3-.95-2.8-1.525t-3.1-.825q-.8-.05-1.325-.612T3 17.15m6.175-9.325Q8 6.65 8 5t1.175-2.825T12 1t2.825 1.175T16 5t-1.175 2.825T12 9T9.175 7.825',
  },
  'exam-schedule': {
    label: 'Schedule',
    gradient: 'bg-[linear-gradient(135deg,#6366f1_0%,#4338ca_100%)]', // indigo 500→700
    path: 'M5 22q-.825 0-1.412-.587T3 20V6q0-.825.588-1.412T5 4h1V3q0-.425.288-.712T7 2t.713.288T8 3v1h8V3q0-.425.288-.712T17 2t.713.288T18 3v1h1q.825 0 1.413.588T21 6v4.675q0 .425-.288.713t-.712.287t-.712-.288t-.288-.712V10H5v10h5.8q.425 0 .713.288T11.8 21t-.288.713T10.8 22zm9.463-.462Q13 20.075 13 18t1.463-3.537T18 13t3.538 1.463T23 18t-1.463 3.538T18 23t-3.537-1.463M18.5 17.8v-2.3q0-.2-.15-.35T18 15t-.35.15t-.15.35v2.275q0 .2.075.388t.225.337l1.525 1.525q.15.15.35.15t.35-.15t.15-.35t-.15-.35z',
  },
  leaves: {
    label: 'Leaves',
    gradient: 'bg-[linear-gradient(135deg,#0891b2_0%,#0e7490_100%)]', // cyan 600→700
    path: 'M12 16.4L10.4 18q-.275.275-.7.275T9 18t-.275-.7t.275-.7l1.6-1.6L9 13.4q-.275-.275-.275-.7T9 12t.7-.275t.7.275l1.6 1.6l1.6-1.6q.275-.275.7-.275T15 12t.275.7t-.275.7L13.4 15l1.6 1.6q.275.275.275.7T15 18t-.7.275t-.7-.275zM5 22q-.825 0-1.412-.587T3 20V6q0-.825.588-1.412T5 4h1V3q0-.425.288-.712T7 2t.713.288T8 3v1h8V3q0-.425.288-.712T17 2t.713.288T18 3v1h1q.825 0 1.413.588T21 6v14q0 .825-.587 1.413T19 22zm0-2h14V10H5z',
  },
  pickup: {
    label: 'QR codes',
    gradient: 'bg-[linear-gradient(135deg,#f43f5e_0%,#be123c_100%)]', // rose 500→700
    path: 'M13 21v-2h2v2zm-2-2v-5h2v5zm8-3v-4h2v4zm-2-4v-2h2v2zM5 14v-2h2v2zm-2-2v-2h2v2zm9-7V3h2v2zM4.5 7.5h3v-3h-3zM3 8V4q0-.425.288-.712T4 3h4q.425 0 .713.288T9 4v4q0 .425-.288.713T8 9H4q-.425 0-.712-.288T3 8m1.5 11.5h3v-3h-3zM3 20v-4q0-.425.288-.712T4 15h4q.425 0 .713.288T9 16v4q0 .425-.288.713T8 21H4q-.425 0-.712-.288T3 20M16.5 7.5h3v-3h-3zM15 8V4q0-.425.288-.712T16 3h4q.425 0 .713.288T21 4v4q0 .425-.288.713T20 9h-4q-.425 0-.712-.288T15 8m2 13v-3h-2v-2h4v3h2v2zm-4-7v-2h4v2zm-4 0v-2H7v-2h6v2h-2v2zm1-5V5h2v2h2v2zM5.25 6.75v-1.5h1.5v1.5zm0 12v-1.5h1.5v1.5zm12-12v-1.5h1.5v1.5z',
  },
  'id-card': {
    label: 'ID card',
    gradient: 'bg-[linear-gradient(135deg,#d97706_0%,#92400e_100%)]', // amber 600→800
    path: 'M6 18h6v-.45q0-.425-.238-.788T11.1 16.2q-.5-.225-1.012-.337T9 15.75t-1.088.113T6.9 16.2q-.425.2-.663.563T6 17.55zm8.75-1.5h2.5q.325 0 .538-.213T18 15.75t-.213-.537T17.25 15h-2.5q-.325 0-.537.213T14 15.75t.213.538t.537.212m-4.687-1.937q.437-.438.437-1.063t-.437-1.062T9 12t-1.062.438T7.5 13.5t.438 1.063T9 15t1.063-.437M14.75 13.5h2.5q.325 0 .538-.213T18 12.75t-.213-.537T17.25 12h-2.5q-.325 0-.537.213T14 12.75t.213.538t.537.212M4 22q-.825 0-1.412-.587T2 20V9q0-.825.588-1.412T4 7h5V4q0-.825.588-1.412T11 2h2q.825 0 1.413.588T15 4v3h5q.825 0 1.413.588T22 9v11q0 .825-.587 1.413T20 22zm7-13h2V4h-2z',
  },
  holidays: {
    label: 'Holidays',
    gradient: 'bg-[linear-gradient(135deg,#0284c7_0%,#075985_100%)]', // sky 600→800
    path: 'M18.95 20.3L14 15.35q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l4.95 4.95q.275.275.275.7t-.275.7t-.7.275t-.7-.275M7.625 18.675q-.7.7-1.638.663t-1.437-.813q-1.5-2.325-1.588-5.037T4.2 8.375q.075.85.425 1.913t.963 2.237t1.462 2.413t1.875 2.437zM10.3 16q-1.2-1.2-2.1-2.613T6.788 10.65t-.575-2.412t.462-1.613q.525-.55 1.613-.5t2.425.563t2.75 1.425t2.612 2.112zm8.25-11.475q.775.5.825 1.425t-.65 1.625L17.45 8.85Q16.275 7.825 15.038 7t-2.4-1.45t-2.226-.988T8.5 4.125Q10.875 2.9 13.575 3t4.975 1.525',
  },
  activities: {
    label: 'Activities',
    gradient: 'bg-[linear-gradient(135deg,#65a30d_0%,#3f6212_100%)]', // lime 600→900
    // A plain five-point star, NOT from Material Symbols like the other paths
    // in this file — kept simple on purpose so it needs no attribution.
    path: 'M12 2l2.9 6.26L22 9.27l-5 4.87L18.2 21 12 17.77 5.8 21 7 14.14 2 9.27l7.1-1.01z',
  },
  info: {
    label: 'Profile',
    gradient: 'bg-[linear-gradient(135deg,#ec4899_0%,#9d174d_100%)]', // pink 500→800
    path: 'M5.85 17.1q1.275-.975 2.85-1.537T12 15t3.3.563t2.85 1.537q.875-1.025 1.363-2.325T20 12q0-3.325-2.337-5.663T12 4T6.337 6.338T4 12q0 1.475.488 2.775T5.85 17.1m3.663-5.113Q8.5 10.976 8.5 9.5t1.013-2.488T12 6t2.488 1.013T15.5 9.5t-1.012 2.488T12 13t-2.488-1.012M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22',
  },
};

/**
 * "More" is the only chip that isn't a section, so it gets the only treatment
 * that isn't a single hue: a sweep through the others, reading as "everything
 * else". A grey chip was tried first and looked disabled.
 */
export const MORE_CHIP = {
  gradient:
    'bg-[conic-gradient(from_210deg,#3b82f6,#8b5cf6,#ec4899,#f97316,#10b981,#3b82f6)]',
  path: 'M4.588 19.413Q4 18.825 4 18t.588-1.412T6 16t1.413.588T8 18t-.587 1.413T6 20t-1.412-.587m6 0Q10 18.825 10 18t.588-1.412T12 16t1.413.588T14 18t-.587 1.413T12 20t-1.412-.587m6 0Q16 18.825 16 18t.588-1.412T18 16t1.413.588T20 18t-.587 1.413T18 20t-1.412-.587m-12-6Q4 12.825 4 12t.588-1.412T6 10t1.413.588T8 12t-.587 1.413T6 14t-1.412-.587m6 0Q10 12.825 10 12t.588-1.412T12 10t1.413.588T14 12t-.587 1.413T12 14t-1.412-.587m6 0Q16 12.825 16 12t.588-1.412T18 10t1.413.588T20 12t-.587 1.413T18 14t-1.412-.587m-12-6Q4 6.825 4 6t.588-1.412T6 4t1.413.588T8 6t-.587 1.413T6 8t-1.412-.587m6 0Q10 6.825 10 6t.588-1.412T12 4t1.413.588T14 6t-.587 1.413T12 8t-1.412-.587m6 0Q16 6.825 16 6t.588-1.412T18 4t1.413.588T20 6t-.587 1.413T18 8t-1.412-.587',
};

/*
 * NOTICE
 * The `path` values above are from Material Symbols (Rounded, filled, w400),
 * Copyright Google LLC, licensed under the Apache License 2.0:
 * https://github.com/google/material-design-icons/blob/master/LICENSE
 */
