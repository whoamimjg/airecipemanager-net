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
// Until airecipemanager.com is verified in Resend, it only delivers to the
// address on the Resend account. Switch back to michael@airecipemanager.com
// (and a notify@airecipemanager.com sender) once the domain is verified.
const EMAIL_TO = Deno.env.get("ADMIN_NOTIFY_EMAIL_TO") ?? "michael@airecipemanager.com";
const EMAIL_FROM = Deno.env.get("ADMIN_NOTIFY_EMAIL_FROM") ?? "AI Recipe Manager <notify@airecipemanager.com>";
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


// ---------- welcome email for new accounts ----------

const SITE = "https://airecipemanager.com";
const WELCOME_FROM = Deno.env.get("WELCOME_EMAIL_FROM") ?? "AI Recipe Manager <hello@airecipemanager.com>";
const SUPPORT = "support@airecipemanager.com";
const POSTAL = "AI Manager LLC, 3939 Massillon Rd., Suite 801 PMB 1015, Uniontown, OH 44685, USA";
const IOS_URL = "https://apps.apple.com/app/id6770092811";
const ANDROID_URL = `${SITE}/beta`;

const STEPS: { title: string; body: string; link: string; cta: string }[] = [
  {
    title: "Add what's in your kitchen",
    body: "Open Inventory and add items by hand, scan a barcode, or take a photo of a grocery receipt to add everything on it at once.",
    link: `${SITE}/dashboard`,
    cta: "Open Inventory",
  },
  {
    title: "Save a few recipes",
    body: "Paste a link from any recipe site, scan a cookbook page, or ask AI Chef for an idea that uses what you already have.",
    link: `${SITE}/dashboard`,
    cta: "Add a recipe",
  },
  {
    title: "Plan your week",
    body: "Put recipes on the days you'll cook them in Meal Plan.",
    link: `${SITE}/dashboard`,
    cta: "Plan meals",
  },
  {
    title: "Shop from your list",
    body: "Your Grocery List builds itself from the meal plan, skips what you already have, and groups items by aisle. Shop my list can send it to your store's online cart.",
    link: `${SITE}/dashboard`,
    cta: "See your list",
  },
];

function welcomeHtml(firstName: string | null): string {
  const hi = firstName ? `Hi ${esc(firstName)},` : "Hi,";
  const steps = STEPS.map((st, i) => `
      <tr>
        <td style="vertical-align:top;padding:0 14px 20px 0">
          <div style="width:28px;height:28px;border-radius:14px;background:#334155;color:#fff;font-weight:700;text-align:center;line-height:28px">${i + 1}</div>
        </td>
        <td style="vertical-align:top;padding:0 0 20px 0">
          <div style="font-weight:700;font-size:16px;color:#0f172a">${st.title}</div>
          <div style="color:#475569;margin:4px 0 6px">${st.body}</div>
          <a href="${st.link}" style="color:#16a34a;font-weight:600;text-decoration:none">${st.cta} →</a>
        </td>
      </tr>`).join("");
  return `<div style="background:#f8fafc;padding:24px 12px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.55">
    <img src="${SITE}/app-icon-512.png" width="56" height="56" alt="" style="border-radius:12px;display:block;margin-bottom:12px" />
    <h1 style="font-size:24px;margin:0 0 8px">Welcome to AI Recipe Manager</h1>
    <p style="margin:0 0 20px;color:#334155">${hi} thanks for joining. Here's how to get set up in a few minutes.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${steps}</table>
    <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:4px 0 20px">
      <div style="font-weight:700;margin-bottom:6px">Take it with you</div>
      <div style="color:#475569">Your account works on the website and in the apps, and everything stays in sync.</div>
      <div style="margin-top:10px">
        <a href="${IOS_URL}" style="display:inline-block;background:#0f172a;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none;margin:0 8px 8px 0">iPhone app</a>
        <a href="${ANDROID_URL}" style="display:inline-block;background:#0f172a;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none;margin:0 8px 8px 0">Android app</a>
      </div>
    </div>
    <p style="color:#475569;margin:0 0 8px">You're on the Free plan, which saves up to 25 recipes. Every feature is included on every plan; paid plans only let you save more recipes.</p>
    <p style="color:#475569;margin:0 0 24px">Questions? Just reply to this email or write to <a href="mailto:${SUPPORT}" style="color:#16a34a">${SUPPORT}</a>.</p>
    <a href="${SITE}/dashboard" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Open AI Recipe Manager</a>
    <p style="font-size:12px;color:#94a3b8;margin:28px 0 0;border-top:1px solid #e2e8f0;padding-top:14px">${POSTAL}</p>
  </div>
</div>`;
}

function welcomeText(firstName: string | null): string {
  const lines = STEPS.map((st, i) => `${i + 1}. ${st.title}\n   ${st.body}\n   ${st.link}`).join("\n\n");
  return `${firstName ? `Hi ${firstName},` : "Hi,"} welcome to AI Recipe Manager. Here's how to get set up in a few minutes.\n\n${lines}\n\nTake it with you:\niPhone: ${IOS_URL}\nAndroid: ${ANDROID_URL}\n\nYou're on the Free plan, which saves up to 25 recipes. Every feature is included on every plan; paid plans only let you save more recipes.\n\nQuestions? Reply to this email or write to ${SUPPORT}.\n\n${POSTAL}`;
}

async function sendWelcome(admin: ReturnType<typeof createClient>, userId: string, overrideTo?: string) {
  const { data: row } = await admin.from("welcome_emails").select("user_id, email, status").eq("user_id", userId).maybeSingle();
  if (!overrideTo && (!row || row.status !== "queued")) return { skipped: row?.status ?? "no queued welcome" };
  const { data: profile } = await admin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const fullName = (profile?.display_name as string | undefined) ||
    (authUser?.user?.user_metadata?.full_name as string | undefined) ||
    (authUser?.user?.user_metadata?.name as string | undefined) || "";
  const firstName = fullName.trim().split(/\s+/)[0] || null;
  if (!RESEND_API_KEY) return { skipped: "RESEND_API_KEY not set" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: WELCOME_FROM,
      to: [overrideTo ?? row!.email],
      reply_to: SUPPORT,
      subject: overrideTo ? "[Test] Welcome to AI Recipe Manager: here's how to get started" : "Welcome to AI Recipe Manager: here's how to get started",
      html: welcomeHtml(firstName),
      text: welcomeText(firstName),
    }),
  });
  const detail = res.ok ? null : (await res.text()).slice(0, 300);
  if (!overrideTo) {
    await admin.from("welcome_emails").update({
      status: res.ok ? "sent" : "failed",
      sent_at: res.ok ? new Date().toISOString() : null,
      detail,
    }).eq("user_id", userId);
  }
  return { ok: res.ok, status: res.status, detail };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!TOKEN || req.headers.get("x-notify-token") !== TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let id: string | undefined;
  let welcomeUserId: string | undefined;
  let welcomeTestTo: string | undefined;
  try {
    const body = await req.json();
    id = body?.id;
    welcomeUserId = body?.welcome_user_id;
    // Preview: send the welcome email for an existing user to Michael's inbox only.
    if (body?.welcome_test_user_id) {
      welcomeUserId = body.welcome_test_user_id;
      welcomeTestTo = EMAIL_TO;
    }
  } catch { /* fallthrough */ }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  if (welcomeUserId) {
    const result = await sendWelcome(admin, welcomeUserId, welcomeTestTo);
    return new Response(JSON.stringify({ ok: true, welcome: result }), { headers: { "Content-Type": "application/json" } });
  }
  if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { "Content-Type": "application/json" } });
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
