package app.bacchat.sms

import android.app.Notification
import android.content.Intent
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Reads payment notifications (bank, card and UPI apps, and email apps showing a bank mail), so a
 * spend is caught even when the bank sends no SMS. Bound by Android only after the user grants
 * Notification access in system settings, and does nothing unless notification reading is on.
 *
 * Kept deliberately thin: a notification is only queued when its text names a rupee amount; the
 * TypeScript pipeline decides whether it is a transaction. Our own notifications and the SMS app's
 * (already read through SmsReceiver) are skipped. Nothing is logged or sent anywhere.
 */
class PaymentNotificationListener : NotificationListenerService() {
  override fun onListenerConnected() {
    // Bound again after the process was restarted: make sure the reading service holds it.
    PaymentWatchService.sync(applicationContext)
    // Anything that arrived while we were not connected (restart, update, access just granted) and
    // is still in the shade is read now. The TypeScript side skips what it already has (same rawRef).
    try {
      val since = System.currentTimeMillis() - CATCH_UP_MS
      activeNotifications?.filter { it.postTime >= since }?.sortedBy { it.postTime }?.forEach { sbn ->
        try {
          handle(sbn)
        } catch (e: Exception) {
          // Skip the one we cannot read.
        }
      }
    } catch (e: Exception) {
      // Not allowed yet: new notifications still come through onNotificationPosted.
    }
  }

  override fun onListenerDisconnected() {
    PaymentWatchService.rebindListener(applicationContext)
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val n = sbn ?: return
    try {
      handle(n)
    } catch (e: Exception) {
      // A notification we cannot read is simply skipped.
    }
  }

  private fun handle(sbn: StatusBarNotification) {
    val context = applicationContext
    if (!SmsStore.isNotificationsEnabled(context)) return
    val pkg = sbn.packageName ?: return
    if (pkg == context.packageName) return
    if (pkg == Telephony.Sms.getDefaultSmsPackage(context) && SmsStore.isEnabled(context)) return
    val notification = sbn.notification ?: return
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return
    val text = textOf(notification)
    if (text.isBlank() || !MONEY.containsMatchIn(text)) return

    val label = try {
      packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) {
      pkg
    }
    // "app:" marks a notification for the TypeScript side; the label helps tell which account.
    val address = "app:$pkg:$label"
    val receivedAt = sbn.postTime.takeIf { it > 0 } ?: System.currentTimeMillis()
    val id = "n$receivedAt-${(address + text).hashCode().toUInt()}"
    SmsStore.enqueue(context, id, address, text, receivedAt)
    if (BacchatSmsModule.isLive()) {
      BacchatSmsModule.deliver(id, address, text, receivedAt)
    } else {
      try {
        BackgroundTask.wakeLock(context)
        context.startService(
          Intent(context, SmsHeadlessService::class.java)
            .putExtra(SmsHeadlessService.EXTRA_ID, id)
            .putExtra(SmsHeadlessService.EXTRA_ADDRESS, address)
            .putExtra(SmsHeadlessService.EXTRA_BODY, text)
            .putExtra(SmsHeadlessService.EXTRA_RECEIVED_AT, receivedAt),
        )
      } catch (e: Exception) {
        // Background start not allowed: the next launch reads the queue.
      }
    }
  }

  companion object {
    /** How far back notifications still in the shade are read when the listener connects. */
    private const val CATCH_UP_MS = 48L * 60 * 60 * 1000
    private val MONEY = Regex("(?:Rs\\.?|INR|₹)\\s*[0-9]", RegexOption.IGNORE_CASE)

    /** Title, then the longest body the notification carries (big text, inbox lines or text). */
    fun textOf(n: Notification): String {
      val e = n.extras ?: return ""
      val title = e.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
      val big = e.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
      val body = e.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
      val lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString(". ") { it.toString() }.orEmpty()
      val main = listOf(big, lines, body).maxByOrNull { it.length }.orEmpty()
      return listOf(title, main).filter { it.isNotBlank() }.joinToString(". ").take(1000)
    }
  }
}
