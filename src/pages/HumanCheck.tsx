import { useEffect } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/auth/Turnstile";

/**
 * Human check for the iPhone and Android apps. The apps open this page in a small web
 * view, because Cloudflare Turnstile has no native SDK, and read the result from the
 * message it posts: a Turnstile token, "none" when no site key is configured yet, or
 * "error". Android listens on window.HumanCheck, iOS on
 * window.webkit.messageHandlers.humanCheck.
 */
type Bridge = { postMessage: (msg: string) => void };
declare global {
  interface Window {
    HumanCheck?: Bridge;
    webkit?: { messageHandlers?: { humanCheck?: Bridge } };
  }
}

const post = (msg: string) => {
  try {
    window.HumanCheck?.postMessage(msg);
    window.webkit?.messageHandlers?.humanCheck?.postMessage(msg);
  } catch {
    /* no native listener: opened in a normal browser */
  }
};

const HumanCheck = () => {
  useEffect(() => {
    document.title = "Checking you're human";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    if (!TURNSTILE_SITE_KEY) post("none");
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-4 text-center">
      <p className="text-sm text-gray-600">Checking you're human…</p>
      <Turnstile action="app" onToken={(token) => token && post(token)} onError={() => post("error")} />
    </div>
  );
};

export default HumanCheck;
