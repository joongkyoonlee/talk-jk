import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 25 * 1024 * 1024;
const BUCKETS = new Set(["room-images", "room-files"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeExtension(name: string, mime: string) {
  const fromName = /\.([A-Za-z0-9]{1,10})$/.exec(name || "")?.[1];
  if (fromName) return fromName.toLowerCase();
  if (mime.startsWith("image/")) return mime.split("/")[1].replace(/[^a-z0-9]/gi, "") || "png";
  return "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();
    const roomId = String(form.get("roomId") || "");
    const passcode = String(form.get("passcode") || "");
    const bucket = String(form.get("bucket") || "");
    const file = form.get("file");

    if (!/^[0-9a-f-]{36}$/i.test(roomId)) return json({ error: "Invalid room" }, 400);
    if (!/^[0-9]{4}$/.test(passcode)) return json({ error: "Invalid passcode" }, 400);
    if (!BUCKETS.has(bucket)) return json({ error: "Invalid bucket" }, 400);
    if (!(file instanceof File)) return json({ error: "No file provided" }, 400);
    if (file.size === 0) return json({ error: "Empty file" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "File too large (max 25MB)" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: authorized, error: authError } = await admin.rpc("room_auth", {
      p_room_id: roomId,
      p_passcode: passcode,
    });
    if (authError) {
      console.error("room_auth failed", authError.message);
      return json({ error: "Upload failed" }, 500);
    }
    if (!authorized) return json({ error: "Unauthorized" }, 403);

    const ext = safeExtension(file.name, file.type || "");
    const path = `${roomId}/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;

    const { error: uploadError } = await admin.storage.from(bucket).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      console.error("upload failed", uploadError.message);
      return json({ error: "Upload failed" }, 500);
    }

    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    return json({ url: data.publicUrl, path });
  } catch (e) {
    console.error("room-upload error", e instanceof Error ? e.message : String(e));
    return json({ error: "Upload failed" }, 500);
  }
});
