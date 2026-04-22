import { getSessionUser, jsonResponse, requireMethod } from "../../utils/auth";

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const mErr = requireMethod(request, "GET");
  if (mErr) return mErr;

  const user = await getSessionUser(request, env.DB);
  if (!user) {
    return jsonResponse({ user: null }, { status: 200 });
  }
  return jsonResponse(
    { user: { username: user.username } },
    { status: 200 },
  );
};
