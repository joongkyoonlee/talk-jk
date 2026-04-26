import { useState } from "react";
import { Check, X, Star, Sparkles, ThumbsUp, Heart, Flame, Lock, Unlock, Trash2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Poll } from "@/pages/Room";
import type { RoomSession } from "@/lib/session";
import { formatKoDate } from "@/lib/session";
import { toast } from "@/hooks/use-toast";

const palette = [
  { from: "from-emerald-400", to: "to-teal-500", icon: Check },
  { from: "from-amber-400", to: "to-orange-500", icon: Star },
  { from: "from-rose-400", to: "to-red-500", icon: X },
  { from: "from-violet-400", to: "to-purple-500", icon: Sparkles },
  { from: "from-sky-400", to: "to-blue-500", icon: ThumbsUp },
  { from: "from-pink-400", to: "to-fuchsia-500", icon: Heart },
  { from: "from-orange-400", to: "to-rose-500", icon: Flame },
];

interface Props {
  poll: Poll;
  session: RoomSession;
  isInstructor: boolean;
  compact?: boolean;
}

export default function PollCard({ poll, session, isInstructor, compact }: Props) {
  const [voting, setVoting] = useState(false);

  const participants = new Set(poll.votes.map((v) => v.voter_client_id)).size;
  const myVote = poll.votes.find((v) => v.voter_client_id === session.clientId);
  const voted = !!myVote;
  const counts: Record<string, number> = {};
  poll.votes.forEach((v) => {
    counts[v.poll_option_id] = (counts[v.poll_option_id] || 0) + 1;
  });

  async function handleVote(optionId: string) {
    setVoting(true);
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: poll.id,
      poll_option_id: optionId,
      voter_client_id: session.clientId,
    });
    setVoting(false);
    if (error) {
      if (error.code === "23505") return toast({ title: "이미 투표하셨습니다." });
      return toast({ title: "투표 실패", description: error.message });
    }
    toast({ title: "투표가 반영되었습니다." });
  }

  async function toggleClose() {
    const { error } = await supabase.from("polls").update({ is_closed: !poll.is_closed }).eq("id", poll.id);
    if (error) toast({ title: "상태 변경 실패", description: error.message });
  }

  async function deletePoll() {
    if (!confirm("이 투표를 삭제할까요?")) return;
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);
    if (error) toast({ title: "삭제 실패", description: error.message });
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-[10px]">익명투표</p>
            <h4 className="font-serif text-base leading-tight break-words">{poll.question}</h4>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${
              poll.is_closed ? "bg-muted text-muted-foreground" : "bg-accent/20 text-accent-foreground"
            }`}
          >
            {poll.is_closed ? "마감" : "진행중"}
          </span>
          {isInstructor && (
            <>
              <button
                onClick={toggleClose}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground transition"
                title={poll.is_closed ? "마감 해제" : "투표 종료"}
              >
                {poll.is_closed ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              </button>
              <button
                onClick={deletePoll}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
                title="삭제"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="mt-3 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(poll.options.length, compact ? 2 : 3)}, minmax(0, 1fr))`,
        }}
      >
        {poll.options.map((opt, idx) => {
          const c = counts[opt.id] || 0;
          const pct = participants ? Math.round((c / participants) * 100) : 0;
          const isMyChoice = myVote?.poll_option_id === opt.id;
          const disabled = poll.is_closed || voted || voting;
          const tone = palette[idx % palette.length];
          const Icon = tone.icon;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => handleVote(opt.id)}
              className={`group relative text-left rounded-xl p-3 text-white shadow-md transition-all bg-gradient-to-br ${tone.from} ${tone.to} ${
                isMyChoice
                  ? "ring-4 ring-foreground/70 scale-[1.02]"
                  : "ring-1 ring-white/20 hover:-translate-y-0.5"
              } ${disabled ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug break-words">
                {opt.option_text}
              </p>
              <p className="mt-1.5 text-xs text-white/90 tabular-nums">
                {c}표 · {pct}%
              </p>
              <div className="mt-1 h-1 rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>참여 {participants}명 {voted && !poll.is_closed && "· 참여 완료"}</span>
        <span>{formatKoDate(poll.created_at)}</span>
      </div>
    </div>
  );
}
