import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Pin, Send, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow, Room } from "@/pages/Room";
import type { RoomSession } from "@/lib/session";
import { formatKoDate } from "@/lib/session";
import { toast } from "@/hooks/use-toast";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  room: Room;
  messages: MessageRow[];
  session: RoomSession;
  isInstructor: boolean;
}

export default function MessagesTab({ room, messages, session, isInstructor }: Props) {
  const [messageType, setMessageType] = useState<"announcement" | "general">("announcement");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState(room.notice || "");
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNoticeDraft(room.notice || "");
  }, [room.notice]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function acceptFile(f: File): boolean {
    if (!IMAGE_TYPES.includes(f.type)) {
      toast({ title: "지원하지 않는 이미지 형식입니다." });
      return false;
    }
    if (f.size > MAX_IMAGE_SIZE) {
      toast({ title: "이미지가 20MB를 초과합니다." });
      return false;
    }
    setFile(f);
    return true;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return setFile(null);
    if (!acceptFile(f)) {
      e.target.value = "";
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = blob.type.split("/")[1] || "png";
        const pasted = new File([blob], `pasted_${Date.now()}.${ext}`, { type: blob.type });
        if (acceptFile(pasted)) {
          e.preventDefault();
          toast({ title: "붙여넣은 이미지가 첨부되었습니다." });
        }
        break;
      }
    }
  }

  async function uploadImage(f: File): Promise<string | null> {
    const ext = f.name.split(".").pop() || "bin";
    const path = `${room.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("room-images").upload(path, f, {
      contentType: f.type,
      upsert: false,
    });
    if (error) {
      toast({ title: "이미지 업로드 실패", description: error.message });
      return null;
    }
    const { data } = supabase.storage.from("room-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !file) {
      toast({ title: "메시지 또는 이미지를 입력하세요." });
      return;
    }
    setSending(true);
    let image_url: string | null = null;
    if (file) {
      image_url = await uploadImage(file);
      if (!image_url) {
        setSending(false);
        return;
      }
    }
    const { error } = await supabase.from("messages").insert({
      room_id: room.id,
      nickname: session.nickname,
      role: session.role,
      client_id: session.clientId,
      body: body.trim() || null,
      message_type: messageType,
      image_url,
      is_system: false,
    });
    setSending(false);
    if (error) {
      toast({ title: "전송 실패", description: error.message });
      return;
    }
    setBody("");
    setFile(null);
    const fileInput = document.getElementById("msg-image") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    toast({ title: "메시지를 전송했습니다." });
  }

  async function handleNoticeSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotice(true);
    const { error } = await supabase.from("rooms").update({ notice: noticeDraft }).eq("id", room.id);
    setSavingNotice(false);
    if (error) return toast({ title: "공지 저장 실패", description: error.message });
    toast({ title: "공지를 저장했습니다." });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: notice + messages */}
      <div className="space-y-4">
        {room.notice && (
          <div className="surface-card p-6 bg-gradient-to-br from-gold-soft/30 to-ivory-deep/40 border-gold/30">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-accent" />
              <p className="eyebrow">PINNED · 공지</p>
            </div>
            <p className="font-serif text-lg mt-3 whitespace-pre-wrap leading-relaxed">{room.notice}</p>
          </div>
        )}

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl">실시간 메시지</h3>
            <span className="text-xs text-muted-foreground">{messages.length}건</span>
          </div>
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">아직 올라온 메시지가 없습니다.</div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => {
                const isAnnouncement = m.message_type === "announcement";
                const isReply = m.message_type === "opinion_reply";
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-4 ${
                      isAnnouncement
                        ? "border-accent/40 bg-gold-soft/15"
                        : isReply
                          ? "border-accent/30 bg-muted/40"
                          : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-medium">
                          {m.nickname || (m.is_system ? "시스템" : "사용자")}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${
                            isAnnouncement
                              ? "bg-accent text-accent-foreground"
                              : isReply
                                ? "bg-foreground/10 text-foreground"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isAnnouncement ? "공지" : isReply ? "의견답변" : "메시지"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatKoDate(m.created_at)}</span>
                    </div>
                    {m.body && (
                      <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed break-words">
                        {linkify(m.body)}
                      </p>
                    )}
                    {m.image_url && (
                      <img
                        src={m.image_url}
                        alt="강사가 업로드한 이미지"
                        className="mt-3 rounded-xl max-h-80 w-auto"
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Right: composer (instructor) or notice */}
      <aside className="space-y-4">
        {isInstructor ? (
          <>
            <form onSubmit={handleSend} className="surface-card p-6 space-y-4">
              <h3 className="font-serif text-xl">강사 메시지 올리기</h3>
              <div className="grid grid-cols-2 gap-2">
                {(["announcement", "general"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMessageType(t)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      messageType === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "announcement" ? "공지" : "일반"}
                  </button>
                ))}
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onPaste={handlePaste}
                rows={6}
                placeholder="수강생에게 전달할 메시지를 입력하세요 (Ctrl/Cmd+V로 캡쳐 이미지 붙여넣기 가능)"
                className="rounded-2xl"
              />
              <div>
                <Label htmlFor="msg-image" className="flex items-center gap-2 cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">
                    <ImageIcon className="h-4 w-4" /> 이미지 선택 (최대 20MB)
                  </span>
                </Label>
                <input
                  id="msg-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {file && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        const el = document.getElementById("msg-image") as HTMLInputElement | null;
                        if (el) el.value = "";
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <button disabled={sending} className="pill-dark w-full disabled:opacity-60">
                {sending ? "전송 중..." : "메시지 전송"} <Send className="h-4 w-4" />
              </button>
            </form>

            <form onSubmit={handleNoticeSave} className="surface-card p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-accent" />
                <h3 className="font-serif text-xl">공지 고정</h3>
              </div>
              <Textarea
                value={noticeDraft}
                onChange={(e) => setNoticeDraft(e.target.value)}
                rows={4}
                placeholder="상단에 고정할 공지"
                className="rounded-2xl"
              />
              <button disabled={savingNotice} className="pill-outline w-full disabled:opacity-60">
                {savingNotice ? "저장 중..." : "공지 저장"}
              </button>
            </form>
          </>
        ) : (
          <div className="surface-card p-6">
            <h3 className="font-serif text-xl">수강생 안내</h3>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              이 화면에서는 강사가 올린 메시지·공지·이미지를 실시간으로 확인할 수 있습니다.
              의견 등록은 상단의 <b>의견</b> 탭에서, 익명투표는 <b>익명투표</b> 탭에서 참여하세요.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
