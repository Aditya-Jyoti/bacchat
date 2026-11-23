package app.bacchat.sms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.service.notification.NotificationListenerService
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Keeps Bacchat running while SMS or payment notification reading is on, so a spend is read the
 * moment it arrives even after the app is swiped away. Android (and many phone makers) stop a
 * closed app's process, which unbinds PaymentNotificationListener and blocks the headless JS task;
 * a foreground service with a quiet ongoing notification keeps the process alive.
 *
 * The service does no work itself: it holds the process, asks Android to reconnect the listener,
 * and stops as soon as both switches are off. Nothing is logged or sent anywhere.
 */
class PaymentWatchService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val context = applicationContext
    if (!shouldRun(context)) {
      stopSelf()
      return START_NOT_STICKY
    }
    try {
      val n = buildNotification(context)
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(NOTIFICATION_ID, n)
      }
    } catch (e: Exception) {
      stopSelf()
      return START_NOT_STICKY
    }
    rebindListener(context)
    // Android restarts the service (and so the process) if it is ever killed.
    return START_STICKY
  }

  companion object {
    private const val CHANNEL_ID = "reading"
    private const val NOTIFICATION_ID = 4102

    fun shouldRun(context: Context): Boolean =
      SmsStore.isEnabled(context) || SmsStore.isNotificationsEnabled(context)

    /** Start or stop the service to match the switches. Safe to call often; failures are quiet. */
    fun sync(context: Context) {
      val app = context.applicationContext
      val intent = Intent(app, PaymentWatchService::class.java)
      try {
        if (shouldRun(app)) ContextCompat.startForegroundService(app, intent) else app.stopService(intent)
      } catch (e: Exception) {
        // Starting from the background is not allowed right now; the next app open or boot retries.
      }
    }

    /** Ask Android to reconnect the notification listener if access is granted but it was dropped. */
    fun rebindListener(context: Context) {
      if (!SmsStore.isNotificationsEnabled(context)) return
      if (!NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)) return
      if (Build.VERSION.SDK_INT < 24) return
      try {
        NotificationListenerService.requestRebind(ComponentName(context, PaymentNotificationListener::class.java))
      } catch (e: Exception) {
        // Already bound, or not allowed: nothing to do.
      }
    }

    private fun buildNotification(context: Context): Notification {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= 26) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          context.getString(R.string.bacchat_reading_channel),
          NotificationManager.IMPORTANCE_MIN,
        ).apply {
          setShowBadge(false)
          description = context.getString(R.string.bacchat_reading_channel_description)
        }
        manager.createNotificationChannel(channel)
      }
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val pending = launch?.let {
        PendingIntent.getActivity(context, 1, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      }
      val statIcon = context.resources.getIdentifier("ic_stat_bacchat", "drawable", context.packageName)
      val icon = statIcon.takeIf { it != 0 }
        ?: context.applicationInfo.icon.takeIf { it != 0 }
        ?: android.R.drawable.ic_dialog_info
      return NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(icon)
        .setContentTitle(context.getString(R.string.bacchat_reading_title))
        .setOngoing(true)
        .setSilent(true)
        .setShowWhen(false)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_MIN)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        .apply { if (pending != null) setContentIntent(pending) }
        .build()
    }
  }
}
