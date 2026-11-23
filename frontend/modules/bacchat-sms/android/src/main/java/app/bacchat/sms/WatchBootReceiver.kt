package app.bacchat.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts PaymentWatchService after a reboot or an app update, if reading is on. */
class WatchBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED ->
        PaymentWatchService.sync(context)
    }
  }
}
