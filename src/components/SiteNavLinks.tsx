import { Home, UserRound, MessageSquareText } from "lucide-react";

type Site = {
  key: "home" | "profile" | "jtalk";
  label: string;
  href: string;
  icon: typeof Home;
  external: boolean;
};

const sites: Site[] = [
  {
    key: "home",
    label: "홈페이지 · Lab Notes",
    href: "https://joongkyoon-home.lovable.app/",
    icon: Home,
    external: true,
  },
  {
    key: "profile",
    label: "전문가 프로필",
    href: "https://joongkyoonlee.org/",
    icon: UserRound,
    external: true,
  },
  {
    key: "jtalk",
    label: "J talk",
    href: "/",
    icon: MessageSquareText,
    external: false,
  },
];

export default function SiteNavLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="사이트 이동"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 normal-case tracking-[0.12em] ${className}`}
    >
      {sites.map(({ key, label, href, icon: Icon, external }) => {
        const isCurrent = key === "jtalk";
        return (
          <a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            aria-current={isCurrent ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap transition hover:text-foreground ${
              isCurrent ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
            {isCurrent && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-1 w-1 shrink-0 rounded-full bg-current"
              />
            )}
          </a>
        );
      })}
    </nav>
  );
}
