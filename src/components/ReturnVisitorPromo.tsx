import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Youtube, ArrowUpRight } from "lucide-react";
import { dismissPromo, evaluatePromo, isExcludedPath } from "@/lib/returnVisitorPromo";

const YOUTUBE_URL = "https://www.youtube.com/@joongkyoonlee3757?sub_confirmation=1";
const HOME_URL = "https://joongkyoon-home.lovable.app/";

const ReturnVisitorPromo = () => {
  const { pathname, search } = useLocation();
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);
  const evaluated = useRef(false);
  const excluded = isExcludedPath(pathname);

  // Record first visit once per page load; decide eligibility.
  useEffect(() => {
    if (evaluated.current) return;
    evaluated.current = true;
    const force = new URLSearchParams(search).get("promo") === "1";
    const show = evaluatePromo(window.localStorage);
    setEligible(force || show);
  }, [search]);

  // Slide in ~1.5s after entering an allowed page.
  useEffect(() => {
    if (!eligible || excluded) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(t);
  }, [eligible, excluded, pathname]);

  const close = () => {
    dismissPromo(window.localStorage);
    setVisible(false);
    setEligible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!eligible || excluded) return null;

  return (
    <aside
      role="complementary"
      aria-label="구독 안내"
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-50 p-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:p-0 sm:w-[380px] transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-8"
      }`}
    >
      <div className="surface-card relative p-6 shadow-pill">
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          tabIndex={visible ? 0 : -1}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="eyebrow text-accent">다시 찾아주셔서 반가워요</p>
        <h2 className="mt-2 pr-8 font-serif text-xl leading-snug text-foreground">
          강의 이후의 이야기를 계속 나눠요
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          AI·데이터·업무자동화 실험 노트와 새 강의 소식을 홈페이지와 유튜브 'AI Studio &amp; Lab'에서 먼저 공개합니다.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <a
            href={YOUTUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            tabIndex={visible ? 0 : -1}
            className="pill-dark w-full gap-2"
          >
            <Youtube className="h-4 w-4" /> YouTube 구독하기
          </a>
          <a
            href={HOME_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            tabIndex={visible ? 0 : -1}
            className="pill-outline w-full gap-1"
          >
            홈페이지 · Lab Notes 보기 <ArrowUpRight className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={close}
            tabIndex={visible ? 0 : -1}
            className="mt-1 self-center text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
          >
            다음에 볼게요
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ReturnVisitorPromo;
