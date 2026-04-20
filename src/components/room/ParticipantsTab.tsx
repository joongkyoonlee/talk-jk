import { Info } from "lucide-react";
import type { RoomSession } from "@/lib/session";

export default function ParticipantsTab({
  session,
  isInstructor,
}: {
  session: RoomSession;
  isInstructor: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
      <div className="surface-card p-6">
        <p className="eyebrow">SESSION</p>
        <h3 className="font-serif text-xl mt-2">현재 접속 정보</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">닉네임</dt>
            <dd className="font-medium">{session.nickname}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">역할</dt>
            <dd className="font-medium">{isInstructor ? "강사" : "학습자"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">패스코드</dt>
            <dd className="font-mono tracking-widest">{session.passcode}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">기기 식별값</dt>
            <dd className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
              {session.clientId}
            </dd>
          </div>
        </dl>
      </div>

      <div className="surface-card p-6 bg-muted/40">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="eyebrow">NOTICE</p>
        </div>
        <h3 className="font-serif text-xl mt-2">안내</h3>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          이 버전은 실시간 메시지 전달이 핵심이라 별도 출석 관리나 읽음 집계는 포함하지 않습니다.
          익명투표는 기기별 식별값(1인 1표) 기준으로 집계됩니다.
        </p>
      </div>
    </div>
  );
}
