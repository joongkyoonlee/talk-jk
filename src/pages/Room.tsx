import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, MessageSquare, Lightbulb, BarChart3, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadSession, saveSession, type RoomSession } from "@/lib/session";
import { toast } from "@/hooks/use-toast";
import TopSocialBar from "@/components/TopSocialBar";
import MessagesTab from "@/components/room/MessagesTab";
import OpinionsTab from "@/components/room/OpinionsTab";
import PollsTab from "@/components/room/PollsTab";
import ParticipantsTab from "@/components/room/ParticipantsTab";

export type Room = {
  id: string;
  title: string;
  room_name: string;
  host_nickname: string;
  notice: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  room_id: string;
  nickname: string;
  role: string;
  client_id: string | null;
  body: string | null;
  message_type: string;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  is_system: boolean;
  created_at: string;
};

export type OpinionRow = {
  id: string;
  room_id: string;
  nickname: string | null;
  role: string;
  client_id: string | null;
  category: string | null;
  body: string;
  created_at: string;
};

export type PollOption = { id: string; poll_id: string; option_text: string; created_at: string };
export type PollVote = { id: string; poll_id: string; poll_option_id: string; voter_client_id: string };
export type Poll = {
  id: string;
  room_id: string;
  question: string;
  is_closed: boolean;
  created_at: string;
  options: PollOption[];
  votes: PollVote[];
};

const TABS = [
  { key: "messages", label: "메시지", icon: MessageSquare },
  { key: "opinions", label: "의견", icon: Lightbulb },
  { key: "polls", label: "익명투표", icon: BarChart3 },
  { key: "participants", label: "참여자", icon: Users },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const RoomPage = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<RoomSession | null>(() => loadSession());
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [opinions, setOpinions] = useState<OpinionRow[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [tab, setTab] = useState<TabKey>("messages");
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  const reloadPolls = useCallback(async (roomId: string) => {
    const { data: pollsData } = await supabase
      .from("polls")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (!pollsData) return;
    const ids = pollsData.map((p) => p.id);
    const [optsRes, votesRes] = await Promise.all([
      ids.length
        ? supabase.from("poll_options").select("*").in("poll_id", ids).order("created_at")
        : Promise.resolve({ data: [] as PollOption[] } as any),
      ids.length
        ? supabase.from("poll_votes").select("*").in("poll_id", ids)
        : Promise.resolve({ data: [] as PollVote[] } as any),
    ]);
    const opts = (optsRes.data || []) as PollOption[];
    const votes = (votesRes.data || []) as PollVote[];
    const merged: Poll[] = pollsData.map((p) => ({
      ...p,
      options: opts.filter((o) => o.poll_id === p.id),
      votes: votes.filter((v) => v.poll_id === p.id),
    }));
    setPolls(merged);
  }, []);

  const loadAll = useCallback(
    async (s: RoomSession) => {
      setLoading(true);
      const { data: roomData, error: roomErr } = await supabase
        .rpc("get_room", { p_room_id: s.roomId, p_passcode: s.passcode })
        .maybeSingle();
      if (roomErr || !roomData) {
        toast({ title: "방을 불러올 수 없습니다.", description: "세션을 종료합니다." });
        saveSession(null);
        setSession(null);
        return;
      }
      setRoom(roomData as Room);

      const [msgRes, opRes] = await Promise.all([
        supabase.from("messages").select("*").eq("room_id", s.roomId).order("created_at", { ascending: true }),
        supabase.from("opinions").select("*").eq("room_id", s.roomId).order("created_at", { ascending: false }),
      ]);
      setMessages((msgRes.data || []) as MessageRow[]);
      setOpinions((opRes.data || []) as OpinionRow[]);
      await reloadPolls(s.roomId);
      setLoading(false);
    },
    [reloadPolls],
  );

  // Initial load + realtime subscriptions
  useEffect(() => {
    if (!session) return;
    loadAll(session);

    const ch = supabase
      .channel(`room:${session.roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${session.roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            toast({ title: "방이 삭제되었습니다." });
            saveSession(null);
            setSession(null);
            return;
          }
          setRoom(payload.new as Room);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${session.roomId}` },
        (payload) => {
          setMessages((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as MessageRow;
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((m) => (m.id === (payload.new as MessageRow).id ? (payload.new as MessageRow) : m));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as MessageRow).id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opinions", filter: `room_id=eq.${session.roomId}` },
        (payload) => {
          setOpinions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as OpinionRow;
              if (prev.some((o) => o.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((o) => (o.id === (payload.new as OpinionRow).id ? (payload.new as OpinionRow) : o));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((o) => o.id !== (payload.old as OpinionRow).id);
            }
            return prev;
          });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, () => reloadPolls(session.roomId))
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_options" }, () =>
        reloadPolls(session.roomId),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () =>
        reloadPolls(session.roomId),
      )
      .subscribe();

    channelRef.current = ch;

    // Fallback: periodic refresh in case realtime is blocked (proxy/in-app browser)
    const refresh = async () => {
      const [msgRes, opRes] = await Promise.all([
        supabase.from("messages").select("*").eq("room_id", session.roomId).order("created_at", { ascending: true }),
        supabase.from("opinions").select("*").eq("room_id", session.roomId).order("created_at", { ascending: false }),
      ]);
      if (msgRes.data) setMessages(msgRes.data as MessageRow[]);
      if (opRes.data) setOpinions(opRes.data as OpinionRow[]);
      reloadPolls(session.roomId);
    };
    const interval = window.setInterval(refresh, 4000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [session, loadAll, reloadPolls]);


  const isInstructor = session?.role === "instructor";

  const handleMessageSent = useCallback((message: MessageRow) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [...current, message].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const handleLeave = () => {
    saveSession(null);
    setSession(null);
    navigate("/", { replace: true });
  };
  const tabContent = useMemo(() => {
    if (!session || !room) return null;
    if (tab === "messages")
      return (
        <MessagesTab
          room={room}
          messages={messages}
          polls={polls}
          session={session}
          isInstructor={isInstructor}
          onMessageSent={handleMessageSent}
        />
      );
    if (tab === "opinions") return <OpinionsTab opinions={opinions} session={session} />;
    if (tab === "polls")
      return <PollsTab polls={polls} session={session} isInstructor={isInstructor} roomId={room.id} />;
    return <ParticipantsTab session={session} isInstructor={isInstructor} />;
  }, [tab, session, room, messages, opinions, polls, isInstructor, handleMessageSent]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <TopSocialBar bordered={false} />
        <div className="container py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{room?.title || "J talk"}</p>
              <h1 className="font-serif text-2xl md:text-3xl mt-1 truncate">
                {room?.room_name || "—"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {session.nickname}
                <span className="mx-2">·</span>
                <span className={isInstructor ? "text-accent" : "text-muted-foreground"}>
                  {isInstructor ? "강사" : "학습자"}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">패스코드</span>
                <span className="font-mono text-xl md:text-2xl font-semibold tracking-[0.3em] text-primary">
                  {session.passcode}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all ${
                      tab === key
                        ? "bg-primary text-primary-foreground shadow-pill"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              <button onClick={handleLeave} className="pill-outline !px-4 !py-2 text-sm">
                <LogOut className="h-4 w-4" /> 나가기
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {loading ? (
          <div className="text-center text-muted-foreground py-20">불러오는 중...</div>
        ) : (
          <div className="animate-fade-up">{tabContent}</div>
        )}
      </main>
    </div>
  );
};

export default RoomPage;
