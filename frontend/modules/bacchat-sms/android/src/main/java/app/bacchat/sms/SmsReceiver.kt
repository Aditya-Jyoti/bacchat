package app.bacchat.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * Receives incoming SMS. Always queues the message (so nothing is lost when the app is closed),
 * and also hands it to JS straight away when the module is alive. JS acknowledges what it handled.
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
    BacchatSmsModule.deliver(id, address, body, receivedAt)
  }
}
