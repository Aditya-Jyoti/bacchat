package app.bacchat.sms

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/** Posts the calm local "From SMS" notification. Tapping it opens a bacchat:// link. */
object SmsNotifier {
  const val CHANNEL_ID = "entries"
  private const val NOTIFICATION_ID = 4101

  fun post(context: Context, channelName: String, title: String, text: String, deepLink: String): Boolean {
    val uri = Uri.parse(deepLink)
    if (uri.scheme != "bacchat") return false
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return false
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val open = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pending = PendingIntent.getActivity(
      context,
      0,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val n = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(title)
      .setContentText(text)
      .setAutoCancel(true)
      .setContentIntent(pending)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    manager.notify(NOTIFICATION_ID, n)
    return true
  }

  /** White-on-transparent small icon copied in by plugins/withNotificationIcon; falls back to the app icon. */
  fun smallIcon(context: Context): Int {
    val statIcon = context.resources.getIdentifier("ic_stat_bacchat", "drawable", context.packageName)
    return statIcon.takeIf { it != 0 }
      ?: context.applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.ic_dialog_info
  }

  /** One notification per entry, so each spend keeps its own buttons. */
  fun entryNotificationId(entryId: String): Int = 0x10000 or (entryId.hashCode() and 0x0fffffff)

  /**
   * A notification for one new entry: up to two category buttons and a "More" button (Android
   * shows at most three). A category button files the entry without opening the app
   * (CategoryPickReceiver); More, or tapping the notification, opens deepLink, the full category
   * list. An empty text leaves the notification as a single line.
   */
  fun postEntry(
    context: Context,
    channelName: String,
    title: String,
    text: String,
    entryId: String,
    choiceIds: List<String>,
    choiceLabels: List<String>,
    savedTexts: List<String>,
    moreLabel: String,
    deepLink: String,
    noteLabel: String = "",
  ): Boolean {
    val uri = Uri.parse(deepLink)
    if (uri.scheme != "bacchat") return false
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return false
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_DEFAULT))
    }
    val notifId = entryNotificationId(entryId)
    val open = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val openPending = PendingIntent.getActivity(context, notifId, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(title)
      .setAutoCancel(true)
      .setContentIntent(openPending)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      // Its own group, so Android does not stack several spends into one bundle that hides the buttons.
      .setGroup("entry-$notifId")
    if (text.isNotBlank()) builder.setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text))
    // "Add note" first: typed straight into the notification (inline reply), saved without opening the app.
    if (noteLabel.isNotBlank()) {
      val noteIntent = Intent(context, CategoryPickReceiver::class.java).apply {
        action = CategoryPickReceiver.ACTION_NOTE
        data = Uri.parse("bacchat-note://$notifId")
        putExtra(CategoryPickReceiver.EXTRA_ENTRY, entryId)
        putExtra(CategoryPickReceiver.EXTRA_NOTIF, notifId)
      }
      // A reply needs a mutable PendingIntent so Android can add the typed text.
      val notePending = PendingIntent.getBroadcast(
        context,
        notifId * 4 + 3,
        noteIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0),
      )
      val input = androidx.core.app.RemoteInput.Builder(CategoryPickReceiver.KEY_NOTE).setLabel(noteLabel).build()
      builder.addAction(
        NotificationCompat.Action.Builder(0, noteLabel, notePending).addRemoteInput(input).setAllowGeneratedReplies(false).build(),
      )
    }
    val slots = 3 - (if (noteLabel.isNotBlank()) 1 else 0) - (if (moreLabel.isBlank()) 0 else 1)
    val n = minOf(maxOf(0, slots), choiceIds.size, choiceLabels.size)
    for (i in 0 until n) {
      val pick = Intent(context, CategoryPickReceiver::class.java).apply {
        action = CategoryPickReceiver.ACTION_PICK
        // Unique data so each button keeps its own extras.
        data = Uri.parse("bacchat-pick://$notifId/$i")
        putExtra(CategoryPickReceiver.EXTRA_ENTRY, entryId)
        putExtra(CategoryPickReceiver.EXTRA_CATEGORY, choiceIds[i])
        putExtra(CategoryPickReceiver.EXTRA_NOTIF, notifId)
        putExtra(CategoryPickReceiver.EXTRA_SAVED, savedTexts.getOrNull(i).orEmpty())
      }
      val pending = PendingIntent.getBroadcast(context, notifId * 4 + i, pick, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      builder.addAction(0, choiceLabels[i], pending)
    }
    if (moreLabel.isNotBlank()) builder.addAction(0, moreLabel, openPending)
    manager.notify(notifId, builder.build())
    return true
  }

  fun cancelEntry(context: Context, entryId: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(entryNotificationId(entryId))
  }
}
