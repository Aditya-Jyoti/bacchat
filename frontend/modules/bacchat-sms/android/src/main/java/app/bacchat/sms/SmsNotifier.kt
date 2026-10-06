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
    val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
    val n = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(text)
      .setAutoCancel(true)
      .setContentIntent(pending)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    manager.notify(NOTIFICATION_ID, n)
    return true
  }
}
