import { Globe, Youtube, Instagram } from "lucide-react";

const links = [
  { href: "https://joongkyoonlee.org", icon: Globe, label: "joongkyoonlee.org" },
  { href: "https://www.youtube.com/@joongkyoonlee3757", icon: Youtube, label: "YouTube" },
  { href: "https://www.instagram.com/joongkyoon/", icon: Instagram, label: "Instagram" },
];

export default function TopSocialBar({ bordered = true }: { bordered?: boolean }) {
  return (
    <div
      className={`bg-background/80 backdrop-blur ${bordered ? "border-b border-border/60" : ""}`}
    >
      <div className="container flex h-9 items-center justify-end gap-4 sm:gap-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {links.map(({ href, icon: Icon, label }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition"
            aria-label={label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
