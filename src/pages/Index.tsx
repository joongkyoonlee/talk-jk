import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { loadSession, newAnonymousName, newClientId, newPasscode, saveSession } from "@/lib/session";

const Index = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (s) navigate(`/room`, { replace: true });
  }, [navigate]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const room_name = String(fd.get("room_name") || "").trim();
    const host_nickname = String(fd.get("nickname") || "").trim();
    if (!title || !room_name || !host_nickname) {
      toast({ title: "모든 값을 입력하세요." });
      return;
    }
    setCreating(true);
    const passcode = newPasscode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ title, room_name, host_nickname, passcode, notice: "" })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "방 생성 실패", description: error?.message });
      return;
    }
    saveSession({
      roomId: data.id,
      passcode: data.passcode,
      nickname: host_nickname,
      role: "instructor",
      clientId: newClientId(),
    });
    toast({ title: `방이 생성되었습니다`, description: `패스코드 ${data.passcode}` });
    navigate("/room");
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pass = String(fd.get("passcode") || "").trim();
    let nickname = String(fd.get("nickname") || "").trim();
    const role = (String(fd.get("role") || "student") as "instructor" | "student");
    if (!/^\d{4}$/.test(pass)) return toast({ title: "패스코드는 숫자 4자리여야 합니다." });
    if (!nickname) nickname = newAnonymousName();
    setJoining(true);
    const { data, error } = await supabase.from("rooms").select("*").eq("passcode", pass).maybeSingle();
    setJoining(false);
    if (error || !data) return toast({ title: "해당 패스코드의 방을 찾을 수 없습니다." });
    saveSession({
      roomId: data.id,
      passcode: data.passcode,
      nickname,
      role,
      clientId: newClientId(),
    });
    toast({ title: "방에 입장했습니다." });
    navigate("/room");
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Top executive ribbon */}
      <div className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="container flex h-9 items-center justify-between text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>J · talk · Lounge</span>
          <span className="hidden sm:inline">Conversations, in real time</span>
        </div>
      </div>

      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-lg shadow-pill">
              <span className="italic leading-none -mt-0.5">J</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-background" />
            </div>
            <span className="font-serif text-lg tracking-tight">
              J <em className="font-display italic text-foreground/80">talk</em>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#create" className="hover:text-foreground transition">방 만들기</a>
            <a href="#join" className="hover:text-foreground transition">입장하기</a>
            <a href="#features" className="hover:text-foreground transition">기능</a>
          </nav>
          <a href="#create" className="pill-dark hidden sm:inline-flex">방 만들기 <Sparkles className="ml-1" /></a>
        </div>
      </header>

      {/* Hero */}
      <section className="container pt-20 pb-16 md:pt-28 md:pb-24 text-center">
        <p className="eyebrow mb-6">J · TALK · REALTIME · LOUNGE</p>
        <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.1] max-w-4xl mx-auto">
          J <em className="font-display italic text-foreground/90">talk</em>,<br />
          <em className="font-display italic text-foreground/90">conversations</em> in real time
        </h1>
        <p className="mt-8 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          강사의 메시지가 즉시 도착하고, 학습자의 의견과 익명투표가 한 화면에서 흐릅니다.
          별도 설치 없이 패스코드 한 번으로 대화를 시작하세요.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href="#join" className="pill-dark">입장하기 <ArrowRight className="ml-1" /></a>
        </div>
      </section>

      {/* Forms */}
      <section className="container pb-24 grid gap-6 md:grid-cols-2 max-w-5xl">
        <form id="create" onSubmit={handleCreate} className="surface-card p-8 md:p-10 animate-fade-up">
          <p className="eyebrow">01 · For Instructor</p>
          <h2 className="font-serif text-2xl md:text-3xl mt-3 mb-6">새 대화방 만들기</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-title">교육 제목</Label>
              <Input id="c-title" name="title" placeholder="예) 2026 봄학기 데이터 리터러시" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-room">방 이름</Label>
              <Input id="c-room" name="room_name" placeholder="예) 1주차 오프닝" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-nick">강사 닉네임</Label>
              <Input id="c-nick" name="nickname" placeholder="예) 김강사" required />
            </div>
            <button disabled={creating} className="pill-dark w-full mt-2 disabled:opacity-60">
              {creating ? "생성 중..." : "대화방 개설하기"}
              <ArrowRight />
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              생성 즉시 4자리 패스코드가 발급됩니다.
            </p>
          </div>
        </form>

        <form id="join" onSubmit={handleJoin} className="surface-card p-8 md:p-10 animate-fade-up">
          <p className="eyebrow">02 · For Everyone</p>
          <h2 className="font-serif text-2xl md:text-3xl mt-3 mb-6">패스코드로 입장</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="j-pass">4자리 패스코드</Label>
              <Input
                id="j-pass"
                name="passcode"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                className="tracking-[0.4em] text-center text-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="j-nick">닉네임 <span className="text-xs text-muted-foreground">(선택)</span></Label>
              <Input id="j-nick" name="nickname" placeholder="비워두면 익명으로 입장합니다" />
            </div>
            <div className="space-y-2">
              <Label>역할</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 cursor-pointer hover:bg-muted has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary transition">
                  <input type="radio" name="role" value="student" defaultChecked className="sr-only" />
                  <span className="text-sm font-medium">학습자</span>
                </label>
                <label className="flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 cursor-pointer hover:bg-muted has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary transition">
                  <input type="radio" name="role" value="instructor" className="sr-only" />
                  <span className="text-sm font-medium">강사</span>
                </label>
              </div>
            </div>
            <button disabled={joining} className="pill-outline w-full mt-2 disabled:opacity-60">
              {joining ? "확인 중..." : "입장하기"}
              <ArrowRight />
            </button>
          </div>
        </form>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-ivory-deep/40">
        <div className="container py-20 grid gap-10 md:grid-cols-3">
          {[
            { e: "MESSAGES", t: "실시간 메시지 & 공지", d: "강사가 올린 공지·메시지·이미지가 즉시 모든 화면에 도달합니다." },
            { e: "OPINIONS", t: "수강생 의견 카드", d: "질문·건의·느낀점 카테고리로 정리된 의견이 카드로 흐릅니다." },
            { e: "POLL", t: "익명 투표 & 집계", d: "1인 1표 익명 투표, 막대그래프로 참여 인원과 비율을 즉시 표시." },
          ].map((f) => (
            <div key={f.t} className="surface-card p-8">
              <p className="eyebrow">{f.e}</p>
              <h3 className="font-serif text-xl mt-3">{f.t}</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span className="font-display tracking-[0.3em] uppercase">Edu Realtime Lounge</span>
          <span>데모 환경 · 입력된 데이터는 모든 참여자가 열람할 수 있습니다.</span>
          <a href="/admin" className="hover:text-foreground transition underline-offset-4 hover:underline">
            관리자
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
