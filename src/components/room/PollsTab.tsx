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
    const { error } = await supabase.rpc("create_room_poll", {
      p_room_id: roomId,
      p_passcode: session.passcode,
      p_question: q,
      p_options: opts,
    });
    setSubmitting(false);
    if (error) return toast({ title: "투표 생성 실패", description: "권한이 없거나 입력값이 올바르지 않습니다." });
    setQuestion("");
    setOptions(["", ""]);
    toast({ title: "익명투표를 만들었습니다." });
  }

  async function handleVote(pollId: string, optionId: string, existingVoteId?: string, currentOptionId?: string) {
    if (currentOptionId === optionId) return;
    setVoting(pollId);
    const { error } = await supabase.rpc("cast_room_vote", {
      p_room_id: roomId,
      p_passcode: session.passcode,
      p_poll_id: pollId,
      p_option_id: optionId,
      p_client_id: session.clientId,
    });
    setVoting(null);
    if (error) return toast({ title: "투표 실패", description: "투표가 종료되었거나 권한이 없습니다." });
    toast({ title: existingVoteId ? "투표를 변경했습니다." : "투표가 반영되었습니다." });
  }

  async function toggleClose(poll: Poll) {
    const { error } = await supabase.rpc("set_poll_closed", {
      p_room_id: roomId,
      p_passcode: session.passcode,
      p_poll_id: poll.id,
      p_closed: !poll.is_closed,
    });
    if (error) toast({ title: "상태 변경 실패", description: "권한이 없습니다." });
  }

  async function deletePoll(poll: Poll) {
    if (!confirm("이 투표를 삭제할까요?")) return;
    const { error } = await supabase.rpc("delete_room_poll", {
      p_room_id: roomId,
      p_passcode: session.passcode,
      p_poll_id: poll.id,
    });
    if (error) toast({ title: "삭제 실패", description: "권한이 없습니다." });
  }

  const palette = [
    { from: "from-emerald-400", to: "to-teal-500", icon: Check },
    { from: "from-amber-400", to: "to-orange-500", icon: Star },
    { from: "from-rose-400", to: "to-red-500", icon: X },
    { from: "from-violet-400", to: "to-purple-500", icon: Sparkles },
    { from: "from-sky-400", to: "to-blue-500", icon: ThumbsUp },
    { from: "from-pink-400", to: "to-fuchsia-500", icon: Heart },
    { from: "from-orange-400", to: "to-rose-500", icon: Flame },
  ];

  const TEMPLATES: { label: string; question: string; options: string[] }[] = [
    {
      label: "진행상황 체크",
      question: "잘 따라오고 있나요?",
      options: ["이해했어요!", "천천히요", "못 따라가요"],
    },
    {
      label: "강의 속도",
      question: "강의 속도는 어떤가요?",
      options: ["딱 좋아요", "조금 빨라요", "조금 느려요"],
    },
    {
      label: "예/아니오",
      question: "동의하시나요?",
      options: ["예", "아니오"],
    },
  ];

  function applyTemplate(t: { question: string; options: string[] }) {
    setQuestion(t.question);
    setOptions(t.options);
  }

  const previewOptions = options.map((o) => o.trim()).filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4 lg:sticky lg:top-44 self-start">
        {isInstructor ? (
          <form onSubmit={handleCreate} className="surface-card p-6 space-y-5">
            <div>
              <h3 className="font-serif text-xl">익명투표 만들기</h3>
              <p className="text-xs text-muted-foreground mt-1">
                질문과 보기를 입력하면 아래 미리보기 그대로 즉시 게시됩니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="pill-outline !py-1.5 !px-3 text-xs"
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="투표 질문 (예: 잘 따라오고 있나요?)"
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

            {previewOptions.length >= 2 && (
              <div className="rounded-2xl border border-dashed border-border p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">미리보기</p>
                <p className="font-serif text-base">{question || "투표 질문"}</p>
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(previewOptions.length, 2)}, minmax(0, 1fr))`,
                  }}
                >
                  {previewOptions.map((opt, idx) => {
                    const tone = palette[idx % palette.length];
                    const Icon = tone.icon;
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl p-3 text-white shadow-md bg-gradient-to-br ${tone.from} ${tone.to}`}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
                          <Icon className="h-4 w-4" strokeWidth={2.5} />
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-snug break-words">{opt}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button disabled={submitting} className="pill-dark w-full disabled:opacity-60">
              {submitting ? "생성 중..." : "익명투표 게시하기"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              게시하면 모든 참여자에게 실시간으로 표시됩니다. 아래 목록의 <b>투표 마감</b> 버튼으로 언제든 종료할 수 있어요.
            </p>
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
                        <button
                          onClick={() => toggleClose(p)}
                          className={`pill-outline !py-2 !px-3 text-xs ${
                            !p.is_closed ? "border-destructive/40 text-destructive hover:bg-destructive/10" : ""
                          }`}
                        >
                          {p.is_closed ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {p.is_closed ? "마감 해제" : "투표 종료"}
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

                  <div
                    className="mt-5 grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(p.options.length, 3)}, minmax(0, 1fr))`,
                    }}
                  >
                    {p.options.map((opt, idx) => {
                      const c = counts[opt.id] || 0;
                      const pct = participants ? Math.round((c / participants) * 100) : 0;
                      const isMyChoice = myVote?.poll_option_id === opt.id;
                      const disabled = p.is_closed || voting === p.id || isMyChoice;
                      const tone = palette[idx % palette.length];
                      const Icon = tone.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleVote(p.id, opt.id, myVote?.id, myVote?.poll_option_id)}
                          className={`group relative text-left rounded-2xl p-5 text-white shadow-lg transition-all bg-gradient-to-br ${tone.from} ${tone.to} ${
                            isMyChoice
                              ? "ring-4 ring-foreground/80 scale-[1.02] -translate-y-0.5"
                              : "ring-1 ring-white/20 hover:-translate-y-0.5 hover:shadow-xl"
                          } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                            <Icon className="h-5 w-5" strokeWidth={2.5} />
                          </div>
                          <p className="mt-6 font-serif text-lg font-semibold leading-snug break-words">
                            {opt.option_text}
                          </p>
                          <p className="mt-3 text-sm text-white/90 tabular-nums">
                            {c} 표 · {pct}%
                          </p>
                          <div className="mt-2 h-1.5 rounded-full bg-white/25 overflow-hidden">
                            <div
                              className="h-full bg-white transition-all duration-500"
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
