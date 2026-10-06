package app.bacchat.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.HeadlessJsTaskService

/**
 * Receives incoming SMS. Always queues the message (so nothing is lost when the app is closed),
 * and hands it to JS straight away when the module is alive, otherwise starts the headless JS task. JS acknowledges what it handled.
 * Does nothing at all while the user has SMS reading switched off.
 */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    if (!SmsStore.isEnabled(context)) return
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    if (parts.isEmpty()) return
    // Multipart messages arrive as several parts from one sender; join them.
    val address = parts[0].originatingAddress ?: return
    val body = parts.joinToString("") { it.messageBody ?: "" }
    val receivedAt = parts[0].timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
    val id = "$receivedAt-${(address + body).hashCode().toUInt()}"
    SmsStore.enqueue(context, id, address, body, receivedAt)
    if (BacchatSmsModule.isLive()) {
      BacchatSmsModule.deliver(id, address, body, receivedAt)
    } else {
      startBackgroundTask(context, id, address, body, receivedAt)
    }
  }

  /** App not running: hand the message to the headless JS task. Failure is fine, the queue keeps it. */
  private fun startBackgroundTask(context: Context, id: String, address: String, body: String, receivedAt: Long) {
    try {
      HeadlessJsTaskService.acquireWakeLockNow(context)
      val service = Intent(context, SmsHeadlessService::class.java)
        .putExtra(SmsHeadlessService.EXTRA_ID, id)
        .putExtra(SmsHeadlessService.EXTRA_ADDRESS, address)
        .putExtra(SmsHeadlessService.EXTRA_BODY, body)
        .putExtra(SmsHeadlessService.EXTRA_RECEIVED_AT, receivedAt)
      context.startService(service)
    } catch (e: Exception) {
      // Background start not allowed on this device: the next launch reads the queue.
    }
  }
}
