import { Globe, Youtube, Mail } from "lucide-react";
import SiteNavLinks from "@/components/SiteNavLinks";

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" />
    </svg>
  );
}

const links = [
  { href: "https://www.youtube.com/@joongkyoonlee3757", icon: Youtube, label: "YouTube" },
  { href: "https://www.threads.com/@joongkyoon?hl=ko", icon: ThreadsIcon, label: "Threads" },
  { href: "https://cdsa.kr/", icon: Globe, label: "CDSA" },
  { href: "mailto:jklee@cdsa.kr", icon: Mail, label: "EMAIL" },
];

export default function TopSocialBar({ bordered = true }: { bordered?: boolean }) {
  return (
    <div
      className={`bg-background/80 backdrop-blur ${bordered ? "border-b border-border/60" : ""}`}
    >
      <div className="container flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-[13px] uppercase tracking-[0.18em] text-muted-foreground">
        <SiteNavLinks />
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:gap-x-6">
          {links.map(({ href, icon: Icon, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap hover:text-foreground transition"
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
