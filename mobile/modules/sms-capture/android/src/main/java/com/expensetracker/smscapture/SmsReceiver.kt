package com.expensetracker.smscapture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (Telephony.Sms.Intents.SMS_RECEIVED_ACTION != intent.action) return
    if (!SmsCaptureStore.enabled(context)) return
    val body = Telephony.Sms.Intents.getMessagesFromIntent(intent)
      .joinToString("") { message -> message.displayMessageBody ?: "" }
    if (!SmsText.shouldQueue(body)) return
    val request = OneTimeWorkRequestBuilder<SmsEnqueueWorker>()
      .setInputData(workDataOf("body" to body, "receivedAt" to utcNow()))
      .build()
    WorkManager.getInstance(context).enqueue(request)
  }
}

class SmsEnqueueWorker(
  context: Context,
  params: androidx.work.WorkerParameters,
) : androidx.work.Worker(context, params) {
  override fun doWork(): Result {
    val body = inputData.getString("body") ?: return Result.success()
    val receivedAt = inputData.getString("receivedAt") ?: utcNow()
    SmsQueue(applicationContext).enqueue(body, receivedAt)
    return Result.success()
  }
}

object SmsCaptureStore {
  private const val PREFS = "sms-capture"

  fun enabled(context: Context): Boolean {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", false)
  }

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", enabled).apply()
  }
}

object SmsText {
  private val otp = Regex("(?i)\\b(otp|one[- ]time password|verification code)\\b")
  private val financial = Regex("(?i)\\b(debited|credited|spent|received|transferred|transfer|payment|paid|refund|reversal|reversed|failed|declined|unsuccessful)\\b|₹|\\binr\\b|\\brs\\.?")

  fun shouldQueue(body: String): Boolean {
    if (otp.containsMatchIn(body) && !financial.containsMatchIn(body)) return false
    return financial.containsMatchIn(body)
  }
}

private fun utcNow(): String {
  val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
  format.timeZone = TimeZone.getTimeZone("UTC")
  return format.format(Date())
}
