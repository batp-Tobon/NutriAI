"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createNotificationRepository } from "@/infrastructure/supabase/repositories";

export async function markNotificationRead(
  id: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  await createNotificationRepository(supabase).markRead(id, user.id);
  revalidatePath("/notifications");
  return { ok: true };
}
