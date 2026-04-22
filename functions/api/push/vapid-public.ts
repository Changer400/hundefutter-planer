import { jsonResponse, requireMethod } from "../../utils/auth";

interface Env {
  VAPID_PUBLIC_KEY?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;
  const key = env.VAPID_PUBLIC_KEY;
  if (!key) {
    return jsonResponse(
      { error: "VAPID public key not configured." },
      { status: 503 },
    );
  }
  return jsonResponse({ publicKey: key });
};
