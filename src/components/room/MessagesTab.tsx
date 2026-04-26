import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Paperclip, Pin, Send, X, Megaphone, FileText, Download, Copy } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow, Poll, Room } from "@/pages/Room";
import type { RoomSession } from "@/lib/session";
import { formatKoDate } from "@/lib/session";
import { toast } from "@/hooks/use-toast";
import { linkify } from "@/lib/linkify";
import PollCard from "./PollCard";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function copyImageToClipboard(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    let outBlob = blob;
    if (blob.type !== "image/png" && typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          const png = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/png"),
          );
          if (png) outBlob = png;
        }
      } catch {
        // fall back to original blob
      }
    }
    // @ts-ignore - ClipboardItem may not be in lib types in older targets
    const item = new ClipboardItem({ [outBlob.type]: outBlob });
    // @ts-ignore
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

async function copyMessageText(m: MessageRow) {
  // Image-only message: copy the image bitmap itself
  if (m.image_url && !m.body) {
    const ok = await copyImageToClipboard(m.image_url);
    toast({ title: ok ? "이미지를 복사했습니다." : "이미지 복사 실패" });
    return;
  }
  const parts: string[] = [];
  if (m.body) parts.push(m.body);
  const text = parts.join("\n").trim();
  if (!text && m.image_url) {
    const ok = await copyImageToClipboard(m.image_url);
    toast({ title: ok ? "이미지를 복사했습니다." : "이미지 복사 실패" });
    return;
  }
  if (!text) {
    toast({ title: "복사할 내용이 없습니다." });
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "메시지를 복사했습니다." });
  } catch {
    toast({ title: "복사 실패", description: "브라우저 권한을 확인해 주세요." });
  }
}

interface Props {
  room: Room;
  messages: MessageRow[];
  polls: Poll[];
  session: RoomSession;
  isInstructor: boolean;
}

type TimelineItem =
  | { kind: "message"; created_at: string; id: string; data: MessageRow }
  | { kind: "poll"; created_at: string; id: string; data: Poll };

export default function MessagesTab({ room, messages, polls, session, isInstructor }: Props) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  // 공지 (강사 전용 다이얼로그)
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState(room.notice || "");
  const [savingNotice, setSavingNotice] = useState(false);

  const listEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNoticeDraft(room.notice || "");
  }, [room.notice]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, polls.length]);

  function acceptFile(f: File): boolean {
    const isImage = IMAGE_TYPES.includes(f.type);
    if (isImage) {
      if (f.size > MAX_IMAGE_SIZE) {
        toast({ title: "이미지가 20MB를 초과합니다." });
        return false;
      }
      setFile(f);
      setAttachment(null);
      return true;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: "파일이 50MB를 초과합니다." });
      return false;
    }
    setAttachment(f);
    setFile(null);
    return true;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      setAttachment(null);
      return;
    }
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

  async function uploadFile(f: File): Promise<string | null> {
    const safeName = f.name.replace(/[^\w.\-가-힣]/g, "_");
    const path = `${room.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const { error } = await supabase.storage.from("room-files").upload(path, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      toast({ title: "파일 업로드 실패", description: error.message });
      return null;
    }
    const { data } = supabase.storage.from("room-files").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim() && !file && !attachment) return;
    setSending(true);
    let image_url: string | null = null;
    let file_url: string | null = null;
    let file_name: string | null = null;
    let file_size: number | null = null;
    let file_mime: string | null = null;
    if (file) {
      image_url = await uploadImage(file);
      if (!image_url) {
        setSending(false);
        return;
      }
    }
    if (attachment) {
      file_url = await uploadFile(attachment);
      if (!file_url) {
        setSending(false);
        return;
      }
      file_name = attachment.name;
      file_size = attachment.size;
      file_mime = attachment.type || "application/octet-stream";
    }
    const { error } = await supabase.from("messages").insert({
      room_id: room.id,
      nickname: session.nickname,
      role: session.role,
      client_id: session.clientId,
      body: body.trim() || null,
      message_type: "general",
      image_url,
      file_url,
      file_name,
      file_size,
      file_mime,
      is_system: false,
    });
    setSending(false);
    if (error) {
      toast({ title: "전송 실패", description: error.message });
      return;
    }
    setBody("");
    setFile(null);
    setAttachment(null);
    const fileInput = document.getElementById("msg-attach") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    const attachInput = document.getElementById("msg-attach") as HTMLInputElement | null;
    if (attachInput) attachInput.value = "";
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleNoticeSave() {
    setSavingNotice(true);
    const { error } = await supabase.from("rooms").update({ notice: noticeDraft }).eq("id", room.id);
    setSavingNotice(false);
    if (error) return toast({ title: "공지 저장 실패", description: error.message });
    toast({ title: "공지를 저장했습니다." });
    setNoticeOpen(false);
  }

  async function handleNoticeClear() {
    setSavingNotice(true);
    const { error } = await supabase.from("rooms").update({ notice: "" }).eq("id", room.id);
    setSavingNotice(false);
    if (error) return toast({ title: "공지 삭제 실패", description: error.message });
    setNoticeDraft("");
    toast({ title: "공지를 삭제했습니다." });
    setNoticeOpen(false);
  }

  async function handlePostAnnouncement() {
    const text = noticeDraft.trim();
    if (!text) {
      toast({ title: "공지 내용을 입력하세요." });
      return;
    }
    setSavingNotice(true);
    const { error } = await supabase.from("messages").insert({
      room_id: room.id,
      nickname: session.nickname,
      role: session.role,
      client_id: session.clientId,
      body: text,
      message_type: "announcement",
      is_system: false,
    });
    setSavingNotice(false);
    if (error) return toast({ title: "공지 발송 실패", description: error.message });
    toast({ title: "공지를 메시지로 발송했습니다." });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="surface-card overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[520px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg">실시간 메시지</h3>
            <span className="text-xs text-muted-foreground">· {messages.length}건</span>
          </div>
          {isInstructor && (
            <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-gold-soft/20 px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-gold-soft/40 transition"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  공지 관리
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-serif flex items-center gap-2">
                    <Pin className="h-4 w-4 text-accent" /> 공지사항 관리
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    상단에 고정으로 노출되며, 원하시면 메시지로도 발송할 수 있습니다. 공지는 강사만 작성할 수 있습니다.
                  </p>
                  <Textarea
                    value={noticeDraft}
                    onChange={(e) => setNoticeDraft(e.target.value)}
                    rows={5}
                    placeholder="공지 내용을 입력하세요"
                    className="rounded-2xl"
                  />
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  {room.notice && (
                    <button
                      type="button"
                      disabled={savingNotice}
                      onClick={handleNoticeClear}
                      className="rounded-full border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition disabled:opacity-60"
                    >
                      공지 삭제
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={savingNotice}
                    onClick={handlePostAnnouncement}
                    className="pill-outline !py-2 !px-4 text-sm disabled:opacity-60"
                  >
                    <Megaphone className="h-3.5 w-3.5" /> 메시지로 발송
                  </button>
                  <button
                    type="button"
                    disabled={savingNotice}
                    onClick={handleNoticeSave}
                    className="pill-dark !py-2 !px-4 text-sm disabled:opacity-60"
                  >
                    {savingNotice ? "저장 중..." : "고정 저장"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Pinned notice (everyone sees if exists) */}
        {room.notice && (
          <div className="px-5 pt-4">
            <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-gold-soft/25 to-ivory-deep/30 p-4">
              <div className="flex items-center gap-2">
                <Pin className="h-3.5 w-3.5 text-accent" />
                <p className="eyebrow">PINNED · 공지</p>
              </div>
              <p className="font-serif text-base mt-2 whitespace-pre-wrap leading-relaxed">
                {room.notice}
              </p>
            </div>
          </div>
        )}

        {/* Messages list (messages + polls merged by time) */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {(() => {
            const timeline: TimelineItem[] = [
              ...messages.map((m) => ({ kind: "message" as const, id: `m-${m.id}`, created_at: m.created_at, data: m })),
              ...polls.map((p) => ({ kind: "poll" as const, id: `p-${p.id}`, created_at: p.created_at, data: p })),
            ].sort((a, b) => a.created_at.localeCompare(b.created_at));

            if (timeline.length === 0) {
              return (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  아직 올라온 메시지가 없습니다.
                </div>
              );
            }

            return (
              <>
                {timeline.map((item) => {
                  if (item.kind === "poll") {
                    return (
                      <PollCard
                        key={item.id}
                        poll={item.data}
                        session={session}
                        isInstructor={isInstructor}
                        compact
                      />
                    );
                  }
                  const m = item.data;
                  const isMine = m.client_id && m.client_id === session.clientId;
                  const isAnnouncement = m.message_type === "announcement";
                  const isReply = m.message_type === "opinion_reply";
                  const isInstructorMsg = m.role === "instructor";

                  if (isAnnouncement) {
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-2xl border border-accent/40 bg-gold-soft/20 p-4"
                      >
                        <button
                          type="button"
                          onClick={() => copyMessageText(m)}
                          title="메시지 복사"
                          aria-label="메시지 복사"
                          className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-muted-foreground hover:text-foreground hover:bg-background transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-accent" />
                            <span className="font-serif font-medium">{m.nickname}</span>
                            <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent text-accent-foreground">
                              공지
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatKoDate(m.created_at)}
                          </span>
                        </div>
                        {m.body && (
                          <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed break-words">
                            {linkify(m.body)}
                          </p>
                        )}
                        {m.image_url && (
                          <img
                            src={m.image_url}
                            alt="첨부 이미지"
                            className="mt-3 rounded-xl max-h-80 w-auto"
                            loading="lazy"
                          />
                        )}
                        {m.file_url && (
                          <a
                            href={m.file_url}
                            target="_blank"
                            rel="noreferrer"
                            download={m.file_name || undefined}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-background/60 px-3 py-2 text-sm hover:bg-background transition max-w-full"
                          >
                            <FileText className="h-4 w-4 text-accent shrink-0" />
                            <span className="truncate">{m.file_name || "첨부 파일"}</span>
                            {m.file_size != null && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatBytes(m.file_size)}
                              </span>
                            )}
                            <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </a>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className={`flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-xs font-medium font-serif">
                            {m.nickname || "사용자"}
                          </span>
                          {isInstructorMsg && (
                            <span className="text-[9px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-accent/20 text-accent-foreground">
                              강사
                            </span>
                          )}
                          {isReply && (
                            <span className="text-[9px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-foreground/10 text-foreground">
                              의견답변
                            </span>
                          )}
                        </div>
                        <div
                          className={`group relative rounded-2xl px-4 py-2.5 pr-9 shadow-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : isInstructorMsg
                                ? "bg-gold-soft/30 text-foreground border border-accent/20 rounded-bl-md"
                                : "bg-card text-foreground border border-border rounded-bl-md"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => copyMessageText(m)}
                            title="메시지 복사"
                            aria-label="메시지 복사"
                            className={`absolute top-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                              isMine
                                ? "bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground"
                                : "bg-background/70 hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {m.body && (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                              {linkify(m.body)}
                            </p>
                          )}
                          {m.image_url && (
                            <img
                              src={m.image_url}
                              alt="첨부 이미지"
                              className={`rounded-xl max-h-72 w-auto ${m.body ? "mt-2" : ""}`}
                              loading="lazy"
                            />
                          )}
                          {m.file_url && (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noreferrer"
                              download={m.file_name || undefined}
                              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition max-w-full ${
                                m.body || m.image_url ? "mt-2" : ""
                              } ${
                                isMine
                                  ? "bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground"
                                  : "bg-muted/60 hover:bg-muted text-foreground"
                              }`}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">{m.file_name || "첨부 파일"}</span>
                              {m.file_size != null && (
                                <span className={`text-xs shrink-0 ${isMine ? "opacity-80" : "text-muted-foreground"}`}>
                                  {formatBytes(m.file_size)}
                                </span>
                              )}
                              <Download className="h-3.5 w-3.5 shrink-0 opacity-80" />
                            </a>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                          {formatKoDate(m.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={listEndRef} />
              </>
            );
          })()}
        </div>

        {/* Composer — chat bar */}
        <form
          onSubmit={handleSend}
          className="border-t border-border/60 bg-background/80 backdrop-blur px-3 py-3"
        >
          {(file || attachment) && (
            <div className="mx-1 mb-2 flex flex-wrap gap-2">
              {file && (
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1.5 max-w-full">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      const el = document.getElementById("msg-attach") as HTMLInputElement | null;
                      if (el) el.value = "";
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {attachment && (
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1.5 max-w-full">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[200px]">{attachment.name}</span>
                  <span className="text-[10px] opacity-70 shrink-0">
                    {formatBytes(attachment.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      const el = document.getElementById("msg-attach") as HTMLInputElement | null;
                      if (el) el.value = "";
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label
              htmlFor="msg-attach"
              className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition cursor-pointer"
              title="파일 첨부 (이미지 20MB · 기타 파일 50MB)"
            >
              <Paperclip className="h-4 w-4" />
            </label>
            <input
              id="msg-attach"
              type="file"
              className="sr-only"
              onChange={handleFileChange}
            />
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
              className="flex-1 resize-none rounded-2xl min-h-[44px] max-h-32 py-2.5"
            />
            <button
              type="submit"
              disabled={sending || (!body.trim() && !file && !attachment)}
              className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pill hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="전송"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
