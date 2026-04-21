import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2, Lock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ADMIN_PASSWORD = "aistudiolab2024";
const STORAGE_KEY = "admin_authed_v1";

type RoomRow = {
  id: string;
  title: string;
  room_name: string;
  host_nickname: string;
  passcode: string;
  created_at: string;
};

const AdminPage = () => {
  const [authed, setAuthed] = useState<boolean>(() => sessionStorage.getItem(STORAGE_KEY) === "1");
  const [pw, setPw] = useState("");
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("id,title,room_name,host_nickname,passcode,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "불러오기 실패", description: error.message });
    } else {
      setRooms((data || []) as RoomRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authed) loadRooms();
  }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
      setPw("");
    } else {
      toast({ title: "비밀번호가 올바르지 않습니다." });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
  };

  const handleDelete = async (roomId: string) => {
    const { data: pollRows } = await supabase.from("polls").select("id").eq("room_id", roomId);
    const pollIds = (pollRows || []).map((p) => p.id);
    if (pollIds.length) {
      await supabase.from("poll_votes").delete().in("poll_id", pollIds);
      await supabase.from("poll_options").delete().in("poll_id", pollIds);
    }
    await Promise.all([
      supabase.from("polls").delete().eq("room_id", roomId),
      supabase.from("messages").delete().eq("room_id", roomId),
      supabase.from("opinions").delete().eq("room_id", roomId),
    ]);
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) {
      toast({ title: "삭제 실패", description: error.message });
      return;
    }
    toast({ title: "삭제되었습니다." });
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="card-soft w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <h1 className="font-serif text-2xl">관리자 페이지</h1>
            <p className="text-sm text-muted-foreground">비밀번호를 입력하세요</p>
          </div>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="관리자 비밀번호"
            autoFocus
          />
          <div className="flex gap-2">
            <Link to="/" className="pill-outline flex-1 justify-center !py-2 text-sm">
              <ArrowLeft className="h-4 w-4" /> 홈으로
            </Link>
            <button type="submit" className="pill-primary flex-1 justify-center !py-2 text-sm">
              입장
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="font-serif text-2xl mt-1">소통방 전체 현황</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadRooms} className="pill-outline !px-4 !py-2 text-sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 새로고침
            </button>
            <Link to="/" className="pill-outline !px-4 !py-2 text-sm">
              <ArrowLeft className="h-4 w-4" /> 홈
            </Link>
            <button onClick={handleLogout} className="pill-outline !px-4 !py-2 text-sm">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="card-soft p-2 md:p-4">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm text-muted-foreground">총 {rooms.length}개의 소통방</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>주제</TableHead>
                <TableHead>방 이름</TableHead>
                <TableHead>강사</TableHead>
                <TableHead>패스코드</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    소통방이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[200px] truncate">{r.title}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.room_name}</TableCell>
                  <TableCell>{r.host_nickname}</TableCell>
                  <TableCell>
                    <span className="font-mono tracking-widest text-foreground bg-muted/60 px-2 py-1 rounded">
                      {r.passcode}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs border border-destructive text-destructive hover:bg-destructive/10 transition">
                          <Trash2 className="h-3.5 w-3.5" /> 삭제
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>소통방을 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <span className="font-medium text-foreground">{r.room_name}</span> 및 모든 메시지, 의견, 투표 데이터가 영구적으로 삭제됩니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(r.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
