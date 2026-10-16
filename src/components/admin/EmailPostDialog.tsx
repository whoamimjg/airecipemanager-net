import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newsletter`;

async function call(action: "post-info" | "send-post" | "send-test", slug: string) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTION_URL}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ slug }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

/** Asks before emailing a published post to every subscriber. Sending can't be undone. */
const EmailPostDialog = ({ post, onClose, onSent }: { post: { slug: string; title: string } | null; onClose: () => void; onSent: () => void }) => {
  const [info, setInfo] = useState<{ recipients: number; sent_at: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setInfo(null);
    if (!post) return;
    call("post-info", post.slug).then(setInfo).catch((e) => toast.error(e.message));
  }, [post]);

  const [testing, setTesting] = useState(false);
  const sendTest = async () => {
    if (!post) return;
    setTesting(true);
    try {
      const r = await call("send-test", post.slug);
      toast.success(`Test sent to ${r.sent_to}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const send = async () => {
    if (!post) return;
    setSending(true);
    try {
      const r = await call("send-post", post.slug);
      toast.success(`Emailed "${post.title}" to ${r.sent} ${r.sent === 1 ? "person" : "people"}`);
      onSent();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AlertDialog open={!!post} onOpenChange={(open) => !open && !sending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Email this post to subscribers?</AlertDialogTitle>
          <AlertDialogDescription>
            {!info
              ? "Checking the list…"
              : info.sent_at
                ? `"${post?.title}" was already emailed on ${new Date(info.sent_at).toLocaleString()}. It can only be sent once.`
                : `"${post?.title}" will go to ${info.recipients} ${info.recipients === 1 ? "person" : "people"}, with the full post in the email. This can't be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>Not now</AlertDialogCancel>
          <Button variant="outline" disabled={sending || testing || !post} onClick={sendTest}>
            {testing ? "Sending test…" : "Send me a test"}
          </Button>
          {info && !info.sent_at && info.recipients > 0 && (
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                send();
              }}
            >
              {sending ? "Sending…" : `Send to ${info.recipients}`}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EmailPostDialog;
