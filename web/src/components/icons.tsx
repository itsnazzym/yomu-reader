export function FeatureIcon({ name }: { name: string }) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" />
          <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "devices":
      return (
        <svg {...common}>
          <rect x="2" y="4" width="15" height="12" rx="2" />
          <path d="M7 20h5M9.5 16v4" />
          <rect x="16.5" y="9" width="5.5" height="10" rx="1.5" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
          <path d="m9 11.5 2 2 4-4.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 text-accent-hover"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
