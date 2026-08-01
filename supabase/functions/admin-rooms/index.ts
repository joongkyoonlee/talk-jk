import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("ADMIN_PASSWORD");
  if (!expected) {
    console.error("ADMIN_PASSWORD is not configured");
    return json({ error: "Server misconfigured" }, 500);
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const password = typeof payload.password === "string" ? payload.password : "";
    const action = typeof payload.action === "string" ? payload.action : "";

    if (password !== expected) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    if (action === "list") {
      const { data, error } = await admin
        .from("rooms")
        .select("id,title,room_name,host_nickname,passcode,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("list rooms failed", error.message);
        return json({ error: "Failed to load rooms" }, 500);
      }
      return json({ rooms: data ?? [] });
    }

    if (action === "delete") {
      const roomId = typeof payload.roomId === "string" ? payload.roomId : "";
      if (!/^[0-9a-f-]{36}$/i.test(roomId)) return json({ error: "Invalid room" }, 400);

      const { data: polls } = await admin.from("polls").select("id").eq("room_id", roomId);
      const pollIds = (polls ?? []).map((p: { id: string }) => p.id);
      if (pollIds.length) {
        await admin.from("poll_votes").delete().in("poll_id", pollIds);
        await admin.from("poll_options").delete().in("poll_id", pollIds);
      }
      await admin.from("polls").delete().eq("room_id", roomId);
      await admin.from("messages").delete().eq("room_id", roomId);
      await admin.from("opinions").delete().eq("room_id", roomId);

      const { error } = await admin.from("rooms").delete().eq("id", roomId);
      if (error) {
        console.error("delete room failed", error.message);
        return json({ error: "Failed to delete room" }, 500);
      }

      for (const bucket of ["room-images", "room-files"]) {
        const { data: files } = await admin.storage.from(bucket).list(roomId);
        if (files?.length) {
          await admin.storage.from(bucket).remove(files.map((f) => `${roomId}/${f.name}`));
        }
      }

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-rooms error", e instanceof Error ? e.message : String(e));
    return json({ error: "Request failed" }, 500);
  }
});
