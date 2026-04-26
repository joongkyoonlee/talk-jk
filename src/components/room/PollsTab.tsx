import { useState } from "react";
import { Plus, Trash2, Lock, Unlock, Check, X, Heart, Star, Sparkles, ThumbsUp, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Poll } from "@/pages/Room";
import type { RoomSession } from "@/lib/session";
import { toast } from "@/hooks/use-toast";

interface Props {
  polls: Poll[];
  session: RoomSession;
  isInstructor: boolean;
  roomId: string;
}

export default function PollsTab({ polls, session, isInstructor, roomId }: Props) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q) return toast({ title: "질문을 입력하세요." });
    if (opts.length < 2) return toast({ title: "보기를 2개 이상 입력하세요." });
    setSubmitting(true);
    const { data: poll, error } = await supabase
      .from("polls")
      .insert({ room_id: roomId, question: q, is_closed: false })
      .select()
      .single();
    if (error || !poll) {
      setSubmitting(false);
      return toast({ title: "투표 생성 실패", description: error?.message });
    }
    const { error: optErr } = await supabase
      .from("poll_options")
      .insert(opts.map((option_text) => ({ poll_id: poll.id, option_text })));
    setSubmitting(false);
    if (optErr) return toast({ title: "보기 저장 실패", description: optErr.message });
    setQuestion("");
    setOptions(["", ""]);
    toast({ title: "익명투표를 만들었습니다." });
  }

  async function handleVote(pollId: string, optionId: string) {
    setVoting(pollId);
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      poll_option_id: optionId,
      voter_client_id: session.clientId,
    });
    setVoting(null);
    if (error) {
      if (error.code === "23505") return toast({ title: "이미 투표하셨습니다." });
      return toast({ title: "투표 실패", description: error.message });
    }
    toast({ title: "투표가 반영되었습니다." });
  }

  async function toggleClose(poll: Poll) {
    const { error } = await supabase.from("polls").update({ is_closed: !poll.is_closed }).eq("id", poll.id);
    if (error) toast({ title: "상태 변경 실패", description: error.message });
  }

  async function deletePoll(poll: Poll) {
    if (!confirm("이 투표를 삭제할까요?")) return;
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);
    if (error) toast({ title: "삭제 실패", description: error.message });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4 lg:sticky lg:top-44 self-start">
        {isInstructor ? (
          <form onSubmit={handleCreate} className="surface-card p-6 space-y-4">
            <h3 className="font-serif text-xl">익명투표 만들기</h3>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="투표 질문"
              className="rounded-2xl"
            />
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`보기 ${i + 1}`}
                    className="rounded-2xl"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="pill-outline w-full !py-2 text-sm"
            >
              <Plus className="h-4 w-4" /> 보기 추가
            </button>
            <button disabled={submitting} className="pill-dark w-full disabled:opacity-60">
              {submitting ? "생성 중..." : "투표 생성"}
            </button>
          </form>
        ) : (
          <div className="surface-card p-6">
            <h3 className="font-serif text-xl">학습자 안내</h3>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              강사가 올린 익명 투표에 참여할 수 있습니다. 투표는 1인 1표이며, 결과는 실시간으로 집계됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">진행중인 투표</h3>
          <span className="text-xs text-muted-foreground">{polls.length}건</span>
        </div>
        {polls.length === 0 ? (
          <div className="surface-card p-12 text-center text-sm text-muted-foreground">
            아직 등록된 투표가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((p) => {
              const participants = new Set(p.votes.map((v) => v.voter_client_id)).size;
              const myVote = p.votes.find((v) => v.voter_client_id === session.clientId);
              const voted = !!myVote;
              const counts: Record<string, number> = {};
              p.votes.forEach((v) => {
                counts[v.poll_option_id] = (counts[v.poll_option_id] || 0) + 1;
              });

              return (
                <div key={p.id} className="surface-card p-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="font-serif text-lg">{p.question}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 mr-2 ${
                            p.is_closed
                              ? "bg-muted text-muted-foreground"
                              : "bg-accent/20 text-accent-foreground"
                          }`}
                        >
                          {p.is_closed ? "마감" : "진행중"}
                        </span>
                        참여 {participants}명
                      </p>
                    </div>
                    {isInstructor && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleClose(p)} className="pill-outline !py-2 !px-3 text-xs">
                          {p.is_closed ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {p.is_closed ? "마감 해제" : "투표 마감"}
                        </button>
                        <button
                          onClick={() => deletePoll(p)}
                          className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {p.options.map((opt) => {
                      const c = counts[opt.id] || 0;
                      const pct = participants ? Math.round((c / participants) * 100) : 0;
                      const isMyChoice = myVote?.poll_option_id === opt.id;
                      const disabled = p.is_closed || voted || voting === p.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleVote(p.id, opt.id)}
                          className={`w-full text-left rounded-2xl border p-4 transition group ${
                            isMyChoice
                              ? "border-accent bg-accent/10"
                              : "border-border bg-background hover:border-foreground/30"
                          } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm flex items-center gap-2">
                              {isMyChoice && <Vote className="h-4 w-4 text-accent" />}
                              {opt.option_text}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {c}명 · {pct}%
                            </span>
                          </div>
                          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isMyChoice ? "bg-accent" : "bg-primary/70"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!p.is_closed && !voted && (
                    <p className="text-xs text-muted-foreground mt-4">
                      보기를 클릭하면 즉시 투표됩니다. 1인 1표.
                    </p>
                  )}
                  {voted && !p.is_closed && (
                    <p className="text-xs text-accent-foreground mt-4">이미 참여한 투표입니다.</p>
                  )}
                  {p.is_closed && (
                    <p className="text-xs text-muted-foreground mt-4">마감된 투표입니다.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
