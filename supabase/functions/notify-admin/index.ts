// Delivers one admin_notifications row to Michael.
//
// Called by the database (pg_net) right after a signup or plan change, with the
// shared token from Vault. Sends through whichever channels are configured as
// function secrets and records the result on the row:
//   RESEND_API_KEY (+ ADMIN_NOTIFY_EMAIL_TO, ADMIN_NOTIFY_EMAIL_FROM)  → email
//   ADMIN_NOTIFY_WEBHOOK_URL                                            → Slack/Discord-style POST
//   NTFY_TOPIC                                                          → ntfy.sh push
// With none configured the row still shows up under /admin "Recent activity".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("ADMIN_NOTIFY_TOKEN") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_TO = Deno.env.get("ADMIN_NOTIFY_EMAIL_TO") ?? "whoamimjg50@gmail.com";
const EMAIL_FROM = Deno.env.get("ADMIN_NOTIFY_EMAIL_FROM") ?? "AI Recipe Manager <onboarding@resend.dev>";
const WEBHOOK_URL = Deno.env.get("ADMIN_NOTIFY_WEBHOOK_URL");
const NTFY_TOPIC = Deno.env.get("NTFY_TOPIC");

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  email: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function sendEmail(row: Row) {
  if (!RESEND_API_KEY) return { channel: "email", skipped: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      subject: row.title,
      text: `${row.title}\n\n${row.body ?? ""}\n\n${new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET\nhttps://airecipemanager.com/admin/users`,
      html: `<p><strong>${esc(row.title)}</strong></p><p>${esc(row.body ?? "")}</p><p style="color:#64748b;font-size:12px">${esc(new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }))} ET · <a href="https://airecipemanager.com/admin/users">Open admin</a></p>`,
    }),
  });
  return { channel: "email", ok: res.ok, status: res.status, detail: res.ok ? undefined : (await res.text()).slice(0, 300) };
}

async function sendWebhook(row: Row) {
  if (!WEBHOOK_URL) return { channel: "webhook", skipped: "ADMIN_NOTIFY_WEBHOOK_URL not set" };
  const text = `${row.title}${row.body ? ` — ${row.body}` : ""}`;
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text }),
  });
  return { channel: "webhook", ok: res.ok, status: res.status };
}

async function sendNtfy(row: Row) {
  if (!NTFY_TOPIC) return { channel: "ntfy", skipped: "NTFY_TOPIC not set" };
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(NTFY_TOPIC)}`, {
    method: "POST",
    headers: { Title: row.title, Tags: row.kind === "paid" ? "moneybag" : "wave", Click: "https://airecipemanager.com/admin/users" },
    body: row.body ?? row.title,
  });
  return { channel: "ntfy", ok: res.ok, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!TOKEN || req.headers.get("x-notify-token") !== TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch { /* fallthrough */ }
  if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: row, error } = await admin.from("admin_notifications").select("*").eq("id", id).maybeSingle();
  if (error || !row) return new Response(JSON.stringify({ error: error?.message ?? "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const results = await Promise.all([sendEmail(row as Row), sendWebhook(row as Row), sendNtfy(row as Row)]);
  const delivered = results.some((r) => "ok" in r && r.ok);
  await admin
    .from("admin_notifications")
    .update({ delivered_at: delivered ? new Date().toISOString() : null, delivery: { attempted_at: new Date().toISOString(), results } })
    .eq("id", id);

  return new Response(JSON.stringify({ ok: true, delivered, results }), { headers: { "Content-Type": "application/json" } });
});
