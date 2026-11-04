import { markSynced, type SqlClient } from "@/database";
import { ingestFinancialMessage } from "@/domain/ingest";
import {
  clearCapturedSms,
  drainCapturedSms,
  isNativeSmsCaptureAvailable,
  removeCapturedSms,
  setCaptureEnabled,
} from "@/native/sms-bridge";
import { extractTransaction } from "@/services/extract-transaction";

export async function syncCapturedSms(
  client: SqlClient,
  flags: { consentGranted: boolean; trackingEnabled: boolean },
): Promise<void> {
  const enabled = flags.consentGranted && flags.trackingEnabled;
  setCaptureEnabled(enabled);
  if (!flags.consentGranted) {
    await clearCapturedSms();
    return;
  }
  if (!enabled || !isNativeSmsCaptureAvailable()) return;

  const queued = await drainCapturedSms();
  for (const item of queued) {
    const receivedAt = new Date(item.receivedAt);
    await ingestFinancialMessage(client, item.body, {
      consentGranted: true,
      trackingEnabled: true,
      now: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
      extract: extractTransaction,
    });
    await removeCapturedSms([item.id]);
  }
  if (queued.length > 0) await markSynced(client, new Date().toISOString());
}
