package app.bacchat.sms

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/**
 * A category button on a "From your messages" notification was tapped. Queues the pick (so it is
 * never lost), swaps the notification for a short confirmation, then hands the pick to JS: straight
 * away when the app is alive, otherwise through CategoryPickHeadlessService. JS writes the category
 * and acknowledges the pick.
 */
class CategoryPickReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val entryId = intent.getStringExtra(EXTRA_ENTRY) ?: return
    val notifId = intent.getIntExtra(EXTRA_NOTIF, 0)
    var categoryId = ""
    var note = ""
    when (intent.action) {
      ACTION_PICK -> {
        categoryId = intent.getStringExtra(EXTRA_CATEGORY) ?: return
        confirm(context, notifId, intent.getStringExtra(EXTRA_SAVED).orEmpty())
      }
      ACTION_NOTE -> {
        note = androidx.core.app.RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY_NOTE)?.toString()?.trim().orEmpty()
        if (note.isEmpty()) return
        confirm(context, notifId, context.getString(R.string.bacchat_note_saved))
      }
      else -> return
    }
    SmsStore.enqueuePick(context, entryId, categoryId, note)
    if (BacchatSmsModule.isLive()) {
      BacchatSmsModule.deliverPick(entryId, categoryId, note)
      return
    }
    try {
      BackgroundTask.wakeLock(context)
      context.startService(
        Intent(context, CategoryPickHeadlessService::class.java)
          .putExtra(EXTRA_ENTRY, entryId)
          .putExtra(EXTRA_CATEGORY, categoryId)
          .putExtra(EXTRA_NOTE, note),
      )
    } catch (e: Exception) {
      // Not allowed right now: the pick stays queued and is applied on the next app open.
    }
  }

  /** Replace the buttons with "Filed under Food." for a few seconds. */
  private fun confirm(context: Context, notifId: Int, text: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (text.isBlank()) {
      manager.cancel(notifId)
      return
    }
    try {
      val n = NotificationCompat.Builder(context, SmsNotifier.CHANNEL_ID)
        .setSmallIcon(SmsNotifier.smallIcon(context))
        .setContentTitle(text)
        .setSilent(true)
        .setAutoCancel(true)
        .setTimeoutAfter(4_000)
        .build()
      manager.notify(notifId, n)
    } catch (e: Exception) {
      manager.cancel(notifId)
    }
  }

  companion object {
    const val ACTION_PICK = "app.bacchat.sms.PICK_CATEGORY"
    const val ACTION_NOTE = "app.bacchat.sms.ADD_NOTE"
    const val KEY_NOTE = "note"
    const val EXTRA_NOTE = "note"
    const val EXTRA_ENTRY = "entryId"
    const val EXTRA_CATEGORY = "categoryId"
    const val EXTRA_NOTIF = "notifId"
    const val EXTRA_SAVED = "saved"
  }
}
