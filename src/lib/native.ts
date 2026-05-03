import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const isNative = () => Capacitor.isNativePlatform();

// ---------- SHARE ----------
export async function shareContent(opts: { title: string; text?: string; url: string }) {
  if (isNative()) {
    try {
      await Share.share({
        title: opts.title,
        text: opts.text ?? `Check out this recipe: ${opts.title}`,
        url: opts.url,
        dialogTitle: "Share recipe",
      });
      return { ok: true, method: "native" as const };
    } catch (e) {
      return { ok: false, method: "native" as const, error: e };
    }
  }

  // Web fallback
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try {
      await (navigator as any).share({
        title: opts.title,
        text: opts.text ?? `Check out this recipe: ${opts.title}`,
        url: opts.url,
      });
      return { ok: true, method: "web-share" as const };
    } catch {
      // user cancel or unsupported – fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(opts.url);
    return { ok: true, method: "clipboard" as const };
  } catch (e) {
    return { ok: false, method: "clipboard" as const, error: e };
  }
}

// ---------- CAMERA ----------
/**
 * Returns base64 (no data: prefix) of a captured photo when on native.
 * Returns null on web (caller should use existing file picker flow).
 */
export async function captureNativePhoto(): Promise<string | null> {
  if (!isNative()) return null;
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    quality: 90,
    correctOrientation: true,
  });
  return photo.base64String ?? null;
}

// ---------- HAPTICS ----------
export const haptics = {
  async success() {
    if (!isNative()) return;
    try { await Haptics.notification({ type: NotificationType.Success }); } catch {}
  },
  async error() {
    if (!isNative()) return;
    try { await Haptics.notification({ type: NotificationType.Error }); } catch {}
  },
  async light() {
    if (!isNative()) return;
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
  },
  async medium() {
    if (!isNative()) return;
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
  },
};
