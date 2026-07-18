import type { SVGProps } from "react";

// Line icon set (24×24, stroke-based) — the app's visual language is clean
// fintech, so navigation and list tiles use these instead of emoji.
function Svg(props: SVGProps<SVGSVGElement>) {
  const { children, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      width="1em"
      height="1em"
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="m3 9.5 9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M9 22v-7h6v7" />
  </Svg>
);

export const IconListChecks = (p: P) => (
  <Svg {...p}>
    <path d="M11 6h10M11 12h10M11 18h10" />
    <path d="m3 6 1.8 1.8L8.2 4.4" />
    <path d="m3 12 1.8 1.8L8.2 10.4" />
    <path d="m3 18 1.8 1.8L8.2 16.4" />
  </Svg>
);

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9.5h18" />
  </Svg>
);

export const IconCheckCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.2 12.4 2.6 2.6 5-5.6" />
  </Svg>
);

export const IconReceipt = (p: P) => (
  <Svg {...p}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7.5h8M8 11.5h8M8 15.5h5" />
  </Svg>
);

export const IconGift = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </Svg>
);

export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M3 3v18h18" />
    <path d="m7 14 4-4 3 3 5-6" />
  </Svg>
);

export const IconUsers = (p: P) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    <path d="M16 3.1a4 4 0 0 1 0 7.8" />
  </Svg>
);

export const IconClipboard = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6M9 16h6" />
  </Svg>
);

export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 22s8-3.5 8-10V5.5L12 2 4 5.5V12c0 6.5 8 10 8 10Z" />
  </Svg>
);

export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 8.5a6 6 0 0 1 12 0c0 5.5 2.5 7.5 2.5 7.5h-17S6 14 6 8.5" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </Svg>
);

export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Svg>
);

export const IconArrowDownRight = (p: P) => (
  <Svg {...p}>
    <path d="m7 7 10 10" />
    <path d="M17 8v9H8" />
  </Svg>
);

export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconDots = (p: P) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="0.9" />
    <circle cx="12" cy="12" r="0.9" />
    <circle cx="19" cy="12" r="0.9" />
  </Svg>
);

export const IconGrid = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

export const IconZap = (p: P) => (
  <Svg {...p}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
  </Svg>
);

export const IconSkip = (p: P) => (
  <Svg {...p}>
    <path d="m5 4 10 8-10 8V4Z" />
    <path d="M19 5v14" />
  </Svg>
);
