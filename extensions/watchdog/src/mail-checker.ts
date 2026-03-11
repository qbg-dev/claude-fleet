/**
 * Fleet Mail unread check — early wake trigger for sleeping workers.
 */

import { FLEET_DATA } from "./config";
import { readFileSync } from "fs";
import { join } from "path";

const FLEET_MAIL_URL = process.env.FLEET_MAIL_URL || process.env.BMS_URL || "http://127.0.0.1:8025";

/** Check if a worker has unread Fleet Mail messages (3s timeout) */
export async function workerHasUnreadMail(worker: string, projectName: string): Promise<boolean> {
  // Read token from per-worker dir
  const tokenPath = join(FLEET_DATA, projectName, worker, "token");
  let token: string;
  try {
    token = readFileSync(tokenPath, "utf-8").trim();
  } catch {
    return false;
  }
  if (!token) return false;

  try {
    const resp = await fetch(
      `${FLEET_MAIL_URL}/api/messages?label=UNREAD&maxResults=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!resp.ok) return false;

    const data = await resp.json() as any;
    const count = data?._diagnostics?.unread_count ?? data?.messages?.length ?? 0;
    return count > 0;
  } catch {
    return false;
  }
}
