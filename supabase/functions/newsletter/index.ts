// Newsletter for the AI Recipe Manager blog: double opt-in sign-up, one-click
// unsubscribe, and a monthly digest of the blog posts published that month.
//
//   POST /newsletter/subscribe    { email, website?, source? }   → confirmation email
//   POST /newsletter/confirm      { token }                       → pending → confirmed
//   POST /newsletter/unsubscribe  { token } or ?token=            → unsubscribed (also RFC 8058 one-click)
//   POST /newsletter/digest       header x-digest-secret, { period?: "YYYY-MM", dry_run?: true }  (not scheduled)
//   POST /newsletter/post-info    admin bearer, { slug }          → recipients + whether it was emailed
//   POST /newsletter/send-post    admin bearer, { slug }          → emails the full post once
//
// Subscribers are blog sign-ups (double opt-in) plus account holders with a confirmed
// email (added by the newsletter_sync_account trigger). Every email carries the
// business postal address and a one-click unsubscribe link (CAN-SPAM). Each post is
// recorded in newsletter_post_sends before sending, so it is never emailed twice.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "npm:marked@14.1.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("NEWSLETTER_FROM") ?? "AI Recipe Manager <news@airecipemanager.com>";
const POSTAL_ADDRESS =
  Deno.env.get("NEWSLETTER_POSTAL_ADDRESS") ?? "AI Manager LLC, 3939 Massillon Rd., Suite 801 PMB 1015, Uniontown, OH 44685, USA";
const ADMIN_EMAIL = "whoamimjg50@gmail.com";
const TEST_TO = "michael@airecipemanager.com";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DIGEST_SECRET = Deno.env.get("NEWSLETTER_DIGEST_SECRET");
const SITE = "https://airecipemanager.com";
const REPLY_TO = "support@airecipemanager.com";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/newsletter`;
const RESEND_CONFIRM_THROTTLE_MS = 10 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-digest-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const admin = (): SupabaseClient => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function sendEmails(messages: Record<string, unknown>[]): Promise<void> {
  if (!RESEND_API_KEY || !FROM) throw new Error("Email is not configured");
  // Resend's batch endpoint takes up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

const footer = (unsubscribeUrl: string) =>
  `<p style="font-size:12px;color:#6b7280;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">
    ${esc(POSTAL_ADDRESS)}<br />
    <a href="${esc(unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a>
  </p>`;

// ---------- subscribe ----------

async function subscribe(body: { email?: string; website?: string; source?: string }) {
  // Honeypot: real visitors never fill the hidden "website" field. Pretend success.
  if (body.website) return json({ ok: true });

  const email = String(body.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!RESEND_API_KEY) {
    return json({ error: "Sign-up is not available yet. Please try again later." }, 503);
  }

  const db = admin();
  const { data: existing } = await db.from("newsletter_subscribers").select("*").eq("email", email).maybeSingle();

  // Already confirmed: say the same thing as for a new address, so the form
  // can't be used to find out who subscribes.
  if (existing?.status === "confirmed") return json({ ok: true, message: "Check your inbox to confirm." });

  // Throttle confirmation emails per address so the form can't be used to spam someone.
  if (existing?.status === "pending" && existing.updated_at) {
    const age = Date.now() - new Date(existing.updated_at).getTime();
    if (age < RESEND_CONFIRM_THROTTLE_MS) return json({ ok: true, message: "Check your inbox to confirm." });
  }

  let row = existing;
  if (!row) {
    const { data, error } = await db
      .from("newsletter_subscribers")
      .insert({ email, status: "pending", source: body.source?.slice(0, 80) ?? null })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    row = data;
  } else {
    const { data, error } = await db
      .from("newsletter_subscribers")
      .update({ status: "pending", updated_at: new Date().toISOString(), unsubscribed_at: null })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    row = data;
  }

  const confirmUrl = `${SITE}/newsletter/confirm?token=${row.confirm_token}`;
  try {
    await sendEmails([{
      from: FROM,
      to: [email],
      reply_to: REPLY_TO,
      subject: "Confirm your AI Recipe Manager blog emails",
      html: `<div style="font-family:system-ui,sans-serif;color:#1f2937;max-width:560px">
        <p>Thanks for signing up for AI Recipe Manager blog emails.</p>
        <p>Confirm your address and we'll email you each new post when it's published.</p>
        <p><a href="${esc(confirmUrl)}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Confirm my subscription</a></p>
        <p style="font-size:13px;color:#6b7280">If you didn't ask for this, ignore this email and nothing else will be sent.</p>
        ${footer(`${SITE}/newsletter/unsubscribe`)}
      </div>`,
      text: `Confirm your AI Recipe Manager blog emails: ${confirmUrl}\n\nIf you didn't ask for this, ignore this email.\n\n${POSTAL_ADDRESS}`,
    }]);
  } catch (err) {
    // Don't leave a pending row behind for an address that never got the email.
    if (!existing) await db.from("newsletter_subscribers").delete().eq("id", row.id);
    console.error("newsletter confirm email failed", err);
    return json({ error: "We couldn't send the confirmation email. Please try again later." }, 502);
  }
  return json({ ok: true, message: "Check your inbox to confirm." });
}

// ---------- confirm / unsubscribe ----------

async function confirm(token: string) {
  if (!token) return json({ error: "Missing token." }, 400);
  const db = admin();
  const { data } = await db.from("newsletter_subscribers").select("id, status").eq("confirm_token", token).maybeSingle();
  if (!data || data.status === "unsubscribed") return json({ error: "This link is no longer valid." }, 404);
  if (data.status === "confirmed") return json({ ok: true, already: true });
  const { error } = await db
    .from("newsletter_subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
}

async function unsubscribe(token: string) {
  if (!token) return json({ error: "Missing token." }, 400);
  const db = admin();
  const { data } = await db.from("newsletter_subscribers").select("id, status").eq("unsubscribe_token", token).maybeSingle();
  if (!data) return json({ error: "This link is no longer valid." }, 404);
  if (data.status !== "unsubscribed") {
    const { error } = await db
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
  }
  return json({ ok: true });
}

// ---------- monthly digest ----------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function previousMonthUtc(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function digestHtml(label: string, period: string, posts: { slug: string; title: string; excerpt: string | null; cover_image_url: string | null }[], unsubscribeUrl: string) {
  const items = posts.map((p) => `
    <div style="margin:0 0 28px">
      ${p.cover_image_url ? `<a href="${SITE}/blog/${esc(p.slug)}"><img src="${esc(p.cover_image_url)}" alt="" style="width:100%;border-radius:12px;display:block;margin-bottom:12px" /></a>` : ""}
      <h2 style="font-size:20px;margin:0 0 6px"><a href="${SITE}/blog/${esc(p.slug)}" style="color:#1f2937;text-decoration:none">${esc(p.title)}</a></h2>
      ${p.excerpt ? `<p style="margin:0 0 8px;color:#4b5563">${esc(p.excerpt)}</p>` : ""}
      <a href="${SITE}/blog/${esc(p.slug)}" style="color:#16a34a">Read the post</a>
    </div>`).join("");
  return `<div style="font-family:system-ui,sans-serif;color:#1f2937;max-width:560px">
    <p style="color:#6b7280;margin-top:0">New from AI Recipe Manager in ${esc(label)}</p>
    ${items}
    <p><a href="${SITE}/blog/month/${esc(period)}" style="color:#16a34a">See everything published this month</a></p>
    ${footer(unsubscribeUrl)}
  </div>`;
}

async function digest(req: Request, body: { period?: string; dry_run?: boolean }) {
  if (!DIGEST_SECRET || req.headers.get("x-digest-secret") !== DIGEST_SECRET) {
    return json({ error: "Not allowed." }, 401);
  }
  const period = body.period ?? previousMonthUtc();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return json({ error: "period must be YYYY-MM" }, 400);
  const dryRun = body.dry_run !== false; // default: dry run

  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  const label = `${MONTHS[m - 1]} ${y}`;

  const db = admin();
  const { data: posts, error: postsErr } = await db
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, published_at")
    .eq("status", "published")
    .gte("published_at", start)
    .lt("published_at", end)
    .order("published_at", { ascending: true });
  if (postsErr) throw new Error(postsErr.message);
  if (!posts || posts.length === 0) return json({ period, skipped: "no posts published this month" });

  const { data: recipients, error: recErr } = await db
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token")
    .eq("status", "confirmed");
  if (recErr) throw new Error(recErr.message);

  const subject = posts.length === 1 ? `New on the blog: ${posts[0].title}` : `${posts.length} new posts from AI Recipe Manager (${label})`;

  if (dryRun) {
    return json({
      period, dry_run: true, subject, posts: posts.map((p) => p.title),
      recipients: recipients?.length ?? 0,
      configured: { sender: !!FROM, postal_address: !!POSTAL_ADDRESS, email_key: !!RESEND_API_KEY },
    });
  }

  const missing = [!RESEND_API_KEY && "RESEND_API_KEY", !FROM && "NEWSLETTER_FROM", !POSTAL_ADDRESS && "NEWSLETTER_POSTAL_ADDRESS"].filter(Boolean);
  if (missing.length) return json({ error: `Not configured: ${missing.join(", ")}` }, 503);
  if (!recipients || recipients.length === 0) return json({ period, skipped: "no confirmed subscribers" });

  // Claim the period first. If it already exists, this month was sent (or is being sent).
  const { error: claimErr } = await db.from("newsletter_digests").insert({
    period, post_slugs: posts.map((p) => p.slug), recipient_count: recipients.length,
  });
  if (claimErr) return json({ period, skipped: "already sent for this month" }, 409);

  const messages = recipients.map((r) => {
    const unsubscribeUrl = `${FUNCTION_URL}/unsubscribe?token=${r.unsubscribe_token}`;
    return {
      from: FROM,
      to: [r.email],
      reply_to: REPLY_TO,
      subject,
      html: digestHtml(label, period, posts, `${SITE}/newsletter/unsubscribe?token=${r.unsubscribe_token}`),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  try {
    await sendEmails(messages);
  } catch (err) {
    console.error("digest send failed", err);
    return json({ period, error: "Sending failed partway. Check the email provider logs before retrying.", detail: String((err as Error).message) }, 502);
  }
  return json({ period, sent: recipients.length, posts: posts.length });
}


// ---------- one email per blog post ----------

async function requireAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data, error } = await createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } }).auth.getUser(token);
  return !error && data.user?.email?.toLowerCase() === ADMIN_EMAIL;
}

async function loadPost(db: SupabaseClient, slug: string) {
  const { data, error } = await db
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, body, published_at, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function postEmailHtml(post: { slug: string; title: string; excerpt: string | null; cover_image_url: string | null; body: string }, unsubscribeUrl: string) {
  const url = `${SITE}/blog/${encodeURIComponent(post.slug)}`;
  const bodyHtml = marked.parse(post.body ?? "", { async: false }) as string;
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;line-height:1.6">
    <p style="color:#6b7280;font-size:13px;margin:0 0 12px">New on the AI Recipe Manager blog</p>
    <h1 style="font-size:26px;line-height:1.25;margin:0 0 12px"><a href="${url}" style="color:#1f2937;text-decoration:none">${esc(post.title)}</a></h1>
    ${post.cover_image_url ? `<a href="${url}"><img src="${esc(post.cover_image_url)}" alt="" style="width:100%;border-radius:12px;display:block;margin:0 0 16px" /></a>` : ""}
    <div style="font-size:16px">${bodyHtml.replace(/<img /g, '<img style="max-width:100%;height:auto;border-radius:8px" ')}</div>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Read it on the website</a></p>
    ${footer(unsubscribeUrl)}
  </div>`;
}


/** Sends the post only to the site owner, so the email can be checked before the real send. */
async function sendTest(req: Request, body: { slug?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "Not allowed." }, 401);
  const slug = String(body.slug ?? "");
  if (!RESEND_API_KEY) return json({ error: "Email is not configured (RESEND_API_KEY)." }, 503);
  const post = await loadPost(admin(), slug);
  if (!post) return json({ error: "No post with that address." }, 404);
  await sendEmails([{
    from: FROM,
    to: [TEST_TO],
    reply_to: REPLY_TO,
    subject: `[Test] ${post.title}`,
    html: postEmailHtml(post, `${SITE}/newsletter/unsubscribe`),
  }]);
  return json({ slug, sent_to: TEST_TO });
}

async function postInfo(req: Request, body: { slug?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "Not allowed." }, 401);
  const slug = String(body.slug ?? "");
  const db = admin();
  const [{ count }, { data: sent }] = await Promise.all([
    db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    db.from("newsletter_post_sends").select("sent_at, recipient_count").eq("slug", slug).maybeSingle(),
  ]);
  return json({ slug, recipients: count ?? 0, sent_at: sent?.sent_at ?? null, sent_to: sent?.recipient_count ?? null });
}

async function sendPost(req: Request, body: { slug?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "Not allowed." }, 401);
  const slug = String(body.slug ?? "");
  if (!slug) return json({ error: "slug is required" }, 400);
  if (!RESEND_API_KEY) return json({ error: "Email is not configured (RESEND_API_KEY)." }, 503);

  const db = admin();
  const post = await loadPost(db, slug);
  if (!post) return json({ error: "No post with that address." }, 404);
  if (post.status !== "published") return json({ error: "Publish the post before emailing it." }, 400);

  const { data: recipients, error: recErr } = await db
    .from("newsletter_subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "confirmed");
  if (recErr) throw new Error(recErr.message);
  if (!recipients || recipients.length === 0) return json({ slug, sent: 0, skipped: "no subscribers" });

  // Claim the post first: a second click, or a retry, can never email it twice.
  const { error: claimErr } = await db.from("newsletter_post_sends").insert({ slug, recipient_count: recipients.length });
  if (claimErr) return json({ error: "This post was already emailed." }, 409);

  // Click tracking: every link in the post (not the unsubscribe link) is stored once and
  // rewritten per recipient to the /c/<link>/<subscriber> redirect.
  const linkIds = await registerLinks(db, slug, postEmailHtml(post, `${SITE}/newsletter/unsubscribe`));

  const messages = recipients.map((r) => {
    const oneClick = `${FUNCTION_URL}/unsubscribe?token=${r.unsubscribe_token}`;
    return {
      from: FROM,
      to: [r.email],
      reply_to: REPLY_TO,
      subject: post.title,
      html: trackLinks(postEmailHtml(post, `${SITE}/newsletter/unsubscribe?token=${r.unsubscribe_token}`), linkIds, r.id),
      text: `${post.title}\n\n${post.excerpt ?? ""}\n\nRead it: ${SITE}/blog/${post.slug}\n\nUnsubscribe: ${SITE}/newsletter/unsubscribe?token=${r.unsubscribe_token}\n${POSTAL_ADDRESS}`,
      headers: {
        "List-Unsubscribe": `<${oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  try {
    await sendEmails(messages);
  } catch (err) {
    console.error("send-post failed", err);
    return json({ slug, error: "Sending failed partway. Check the Resend logs before trying again.", detail: String((err as Error).message) }, 502);
  }
  return json({ slug, sent: recipients.length });
}


// ---------- click tracking ----------

const HREF_RE = /href="(https?:\/\/[^"]+)"/g;
const isUnsubscribe = (raw: string) => raw.includes("/newsletter/unsubscribe");
const decodeHref = (raw: string) => raw.replace(/&amp;/g, "&").replace(/&quot;/g, '"');

/** Stores each link in the email once per post; returns raw href → link id. */
async function registerLinks(db: SupabaseClient, slug: string, html: string): Promise<Map<string, string>> {
  const raws = Array.from(new Set(Array.from(html.matchAll(HREF_RE), (m) => m[1]).filter((h) => !isUnsubscribe(h))));
  const map = new Map<string, string>();
  if (raws.length === 0) return map;
  const rows = raws.map((raw) => ({ slug, url: decodeHref(raw) }));
  const { data, error } = await db.from("newsletter_links").upsert(rows, { onConflict: "slug,url" }).select("id, url");
  if (error) {
    console.error("registerLinks failed; sending without click tracking", error);
    return map;
  }
  const byUrl = new Map((data ?? []).map((r) => [r.url, r.id as string]));
  for (const raw of raws) {
    const id = byUrl.get(decodeHref(raw));
    if (id) map.set(raw, id);
  }
  return map;
}

function trackLinks(html: string, linkIds: Map<string, string>, subscriberId: string): string {
  if (linkIds.size === 0) return html;
  return html.replace(HREF_RE, (whole, raw) => {
    const id = linkIds.get(raw);
    return id ? `href="${FUNCTION_URL}/c/${id}/${subscriberId}"` : whole;
  });
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLICK_PATH = new RegExp(`/c/(${UUID})(?:/(${UUID}))?/?$`, "i");

/** GET /c/<link>/<subscriber>: count the click, then send the reader to the stored URL. */
async function handleClick(req: Request, match: RegExpMatchArray): Promise<Response> {
  const [, linkId, subscriberId] = match;
  const db = admin();
  const { data: link } = await db.from("newsletter_links").select("url").eq("id", linkId).maybeSingle();
  const target = link?.url && /^https?:\/\//.test(link.url) ? link.url : SITE;
  // Link scanners often check with HEAD first; only real GETs count as clicks.
  if (link && req.method === "GET") {
    const { error } = await db.from("newsletter_clicks").insert({ link_id: linkId, subscriber_id: subscriberId ?? null });
    if (error) console.error("click insert failed", error);
  }
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
}

// ---------- router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const click = url.pathname.match(CLICK_PATH);
  if (click && (req.method === "GET" || req.method === "HEAD")) return await handleClick(req, click);

  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const action = url.pathname.split("/").filter(Boolean).pop() ?? "";
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    switch (action) {
      case "subscribe": return await subscribe(body);
      case "confirm": return await confirm(String(body.token ?? ""));
      case "unsubscribe": return await unsubscribe(String(body.token ?? url.searchParams.get("token") ?? ""));
      case "digest": return await digest(req, body);
      case "post-info": return await postInfo(req, body);
      case "send-post": return await sendPost(req, body);
      case "send-test": return await sendTest(req, body);
      default: return json({ error: "Not found" }, 404);
    }
  } catch (err) {
    console.error("newsletter", action, err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
