"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, gatePassword, safeNextPath, SESSION_COOKIE, SESSION_DAYS } from "@/lib/gate";

export interface UnlockState {
  error: string | null;
}

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const secret = gatePassword();
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  if (!secret) redirect(next);

  const attempt = String(formData.get("password") ?? "");
  if (!(await checkPassword(secret, attempt))) {
    // A little friction against guessing.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { error: "That isn't the passphrase." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(next);
}
