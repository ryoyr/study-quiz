import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "home"
  | "learn"
  | "records"
  | "manage"
  | "more"
  | "statistics"
  | "history"
  | "timer"
  | "alert"
  | "questions"
  | "sparkles"
  | "star"
  | "edit"
  | "shield-check"
  | "settings"
  | "backup"
  | "ai"
  | "help"
  | "close"
  | "chevron-right"
  | "palette"
  | "sun"
  | "moon"
  | "monitor"
  | "logo";

type Props = SVGProps<SVGSVGElement> & {
  name: AppIconName;
  title?: string;
};

const paths: Record<AppIconName, ReactNode> = {
  home: <><path d="M3.5 10.7 12 3.5l8.5 7.2"/><path d="M5.5 9.8v10.1h13V9.8"/><path d="M9.2 19.9v-5.8h5.6v5.8"/></>,
  learn: <><path d="M4.5 5.2A2.7 2.7 0 0 1 7.2 2.5H20v16H7.2a2.7 2.7 0 1 1 0-5.4H20"/><path d="M8.4 7h7.2M8.4 10.4h5.1"/></>,
  records: <><path d="M4 19.5V11M10 19.5V5M16 19.5v-8M22 19.5H2"/><path d="m3.5 8.2 5.8-4.1 5.5 5.2 5.7-4.6"/></>,
  manage: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  more: <><circle cx="5" cy="12" r="1.45" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.45" fill="currentColor" stroke="none"/></>,
  statistics: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 16v-3M12 16V8M17 16v-6"/></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.3-5.8L3.5 8.5"/><path d="M3.5 4.5v4h4M12 7.5V12l3 2"/></>,
  timer: <><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5v3M12 13l3-2"/></>,
  alert: <><path d="M10.3 3.6 2.4 17.3A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 8v5M12 16.7h.01"/></>,
  questions: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 8h7M7 12h10M7 16h6"/><path d="m16.5 7.5 1 1 2-2"/></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5 13l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
  edit: <><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4M4 20h16"/></>,
  "shield-check": <><path d="M12 2.8 20 6v5.3c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3.2Z"/><path d="m8.2 12 2.5 2.5 5.2-5.2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  backup: <><path d="M12 3v11M8 10l4 4 4-4"/><path d="M4 14v5h16v-5"/></>,
  ai: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M9 2v3M15 2v3M8 11h.01M16 11h.01M8.5 15.5c2.2 1.7 4.8 1.7 7 0"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4 2c-1 .7-1.7 1.2-1.7 2.5M12 17h.01"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  "chevron-right": <path d="m9 5 7 7-7 7"/>,
  palette: <><path d="M12 3a9 9 0 0 0 0 18h1.5a1.7 1.7 0 0 0 0-3.4h-1a1.6 1.6 0 0 1 0-3.2H14a7 7 0 0 0 0-14h-2Z"/><circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.8" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6.8" r="1" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.6 8.6 0 1 0 20.2 15.2Z"/>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  logo: <><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 1 1 7.5 13H19"/><path d="m9 8 2 2 4-4"/></>,
};

export default function AppIcon({ name, title, className, ...props }: Props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}

