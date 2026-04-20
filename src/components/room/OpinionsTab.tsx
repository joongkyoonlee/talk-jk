import { useState } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { OpinionRow } from "@/pages/Room";
import { formatKoDate, type RoomSession } from "@/lib/session";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = ["질문", "건의", "느낀점"] as const;

const CATEGORY_STYLE: Record<string, string> = {
  질문: "bg-primary/10 text-primary border-primary/20",
  건의: "bg-accent/15 text-accent-foreground border-accent/30",
  느낀점: "bg-muted text-muted-foreground border-border",
};

export default function OpinionsTab({
  opinions,
  session,
}: {
  opinions: OpinionRow[];
  session: RoomSession;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("질문");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return toast({ title: "의견 내용을 입력하세요." });
    setSubmitting(true);
    const { error } = await supabase.from("opinions").insert({
      room_id: session.roomId,
      nickname: session.nickname,
      role: session.role,
      client_id: session.clientId,
      category,
      body: body.trim(),
    });
    setSubmitting(false);
    if (error) return toast({ title: "등록 실패", description: error.message });
    setBody("");
    toast({ title: "의견을 등록했습니다." });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={handleSubmit} className="surface-card p-6 space-y-4 lg:sticky lg:top-44 self-start">
        <h3 className="font-serif text-xl">의견 등록</h3>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-2 text-sm transition ${
                category === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          placeholder="의견을 남겨주세요"
          className="rounded-2xl"
        />
        <button disabled={submitting} className="pill-dark w-full disabled:opacity-60">
          {submitting ? "등록 중..." : "의견 등록"} <Send className="h-4 w-4" />
        </button>
      </form>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">등록된 의견</h3>
          <span className="text-xs text-muted-foreground">{opinions.length}건</span>
        </div>
        {opinions.length === 0 ? (
          <div className="surface-card p-12 text-center text-sm text-muted-foreground">
            아직 등록된 의견이 없습니다. 첫 번째 의견을 남겨보세요.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {opinions.map((o) => (
              <article key={o.id} className="surface-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] uppercase tracking-wider rounded-full border px-2.5 py-1 ${
                      CATEGORY_STYLE[o.category || "질문"]
                    }`}
                  >
                    {o.category || "일반"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatKoDate(o.created_at)}</span>
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{o.body}</p>
                {o.nickname && (
                  <p className="mt-3 text-xs text-muted-foreground">— {o.nickname}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
