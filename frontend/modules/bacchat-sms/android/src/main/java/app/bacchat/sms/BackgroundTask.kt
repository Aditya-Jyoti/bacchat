package app.bacchat.sms

import android.content.Context
import com.facebook.react.HeadlessJsTaskService

/** Helpers for starting the headless JS tasks while the app has no screen. */
object BackgroundTask {
  /**
   * Keep the CPU awake until the JS task starts. A wake lock that cannot be taken must never stop
   * the task from starting: without it, a message read while the app was closed waited for the
   * next app open.
   */
  fun wakeLock(context: Context) {
    try {
      HeadlessJsTaskService.acquireWakeLockNow(context)
    } catch (e: Exception) {
      // Not allowed on this phone: start the task anyway.
    }
  }
}
