import { requireNativeModule } from "expo-modules-core";
import { Linking, PermissionsAndroid, Platform } from "react-native";

export type QueuedSms = {
  id: string;
  body: string;
  receivedAt: string;
};

type SmsCaptureNative = {
  isAvailable(): boolean;
  setEnabled(enabled: boolean): void;
  drain(): Promise<QueuedSms[]>;
  remove(ids: string[]): Promise<void>;
  clear(): Promise<void>;
};

function nativeSms(): SmsCaptureNative | null {
  if (Platform.OS !== "android") return null;
  try {
    const module = requireNativeModule<SmsCaptureNative>("SmsCapture");
    return module.isAvailable() ? module : null;
  } catch {
    return null;
  }
}

export function isNativeSmsCaptureAvailable(): boolean {
  return nativeSms() !== null;
}

export function setCaptureEnabled(enabled: boolean): void {
  nativeSms()?.setEnabled(enabled);
}

export async function drainCapturedSms(): Promise<QueuedSms[]> {
  return (await nativeSms()?.drain()) ?? [];
}

export async function removeCapturedSms(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await nativeSms()?.remove(ids);
}

export async function clearCapturedSms(): Promise<void> {
  await nativeSms()?.clear();
}

export async function requestReceiveSms(): Promise<"granted" | "denied" | "blocked" | "unavailable"> {
  if (Platform.OS !== "android") return "unavailable";
  const permission = PermissionsAndroid.PERMISSIONS.RECEIVE_SMS;
  if (await PermissionsAndroid.check(permission)) return "granted";
  const result = await PermissionsAndroid.request(permission);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return "granted";
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    await Linking.openSettings();
    return "blocked";
  }
  return "denied";
}
