-- Tell Michael when someone signs up or pays.
--
-- Every event is written to admin_notifications (shown in /admin as "Recent
-- activity") and handed to the notify-admin edge function over pg_net, which
-- emails / pings whichever channel is configured. The hop is authenticated with
-- a random token stored in Vault (admin_notify_token) and as the function
-- secret ADMIN_NOTIFY_TOKEN. Nothing here can ever block a signup: the trigger
-- bodies swallow their own errors.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,                 -- signup | paid | plan_change | cancelled
  title text NOT NULL,
  body text,
  user_id uuid,
  email text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  delivery jsonb
);
CREATE INDEX IF NOT EXISTS admin_notifications_created_idx ON public.admin_notifications (created_at DESC);
-- Service role only: no policies, RLS on.
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_admin_notification(
  p_kind text, p_title text, p_body text, p_user_id uuid, p_email text, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id uuid;
  v_url text;
  v_token text;
BEGIN
  INSERT INTO public.admin_notifications (kind, title, body, user_id, email, meta)
  VALUES (p_kind, p_title, p_body, p_user_id, p_email, COALESCE(p_meta, '{}'::jsonb))
  RETURNING id INTO v_id;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'admin_notify_url' LIMIT 1;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'admin_notify_token' LIMIT 1;
  IF v_url IS NULL OR v_token IS NULL THEN
    RETURN; -- stored for the admin feed; delivery not configured
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-token', v_token),
    body := jsonb_build_object('id', v_id)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_admin_notification failed: %', SQLERRM;
END;
$$;

-- New account (real signups only; guests are skipped until they add an email).
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_provider text;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.is_anonymous IS TRUE OR NEW.email IS NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT (OLD.email IS NULL AND NEW.email IS NOT NULL) THEN
    RETURN NEW; -- only a guest turning into a real account counts
  END IF;
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  PERFORM public.enqueue_admin_notification(
    'signup',
    'New signup: ' || NEW.email,
    'Signed up with ' || v_provider ||
      CASE WHEN TG_OP = 'UPDATE' THEN ' (converted from guest)' ELSE '' END ||
      ' · free plan',
    NEW.id,
    NEW.email,
    jsonb_build_object('provider', v_provider, 'display_name', NEW.raw_user_meta_data->>'full_name')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admin_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_notify_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_notify_admin
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_user();

-- Paid plan started, changed, or dropped back to free.
CREATE OR REPLACE FUNCTION public.notify_admin_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_old text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.plan::text ELSE NULL END;
  v_new text := NEW.plan::text;
  v_kind text;
  v_title text;
BEGIN
  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN NEW;
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  v_email := COALESCE(v_email, NEW.user_id::text);

  IF v_new <> 'free' AND (v_old IS NULL OR v_old = 'free') THEN
    v_kind := 'paid';
    v_title := 'New ' || initcap(v_new) || ' subscriber: ' || v_email;
  ELSIF v_new <> 'free' THEN
    v_kind := 'plan_change';
    v_title := 'Plan change ' || initcap(v_old) || ' → ' || initcap(v_new) || ': ' || v_email;
  ELSE
    v_kind := 'cancelled';
    v_title := 'Back to free from ' || initcap(COALESCE(v_old, '?')) || ': ' || v_email;
  END IF;

  PERFORM public.enqueue_admin_notification(
    v_kind,
    v_title,
    '$' || NEW.price_monthly::text || '/mo via ' || COALESCE(NEW.payment_method, 'unknown') ||
      COALESCE(' · next billing ' || NEW.next_billing_date::text, ''),
    NEW.user_id,
    v_email,
    jsonb_build_object('old_plan', v_old, 'new_plan', v_new, 'price_monthly', NEW.price_monthly,
                       'payment_method', NEW.payment_method)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admin_subscription_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subscription_change_notify_admin ON public.subscriptions;
CREATE TRIGGER on_subscription_change_notify_admin
  AFTER INSERT OR UPDATE OF plan ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_subscription_change();
