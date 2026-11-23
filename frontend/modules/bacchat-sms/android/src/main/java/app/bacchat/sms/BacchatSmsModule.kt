package app.bacchat.sms

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin native surface for SMS: permissions, a bounded inbox read, the live-message event and the
 * local notification. All parsing and decisions happen in TypeScript. Nothing is logged.
 */
class BacchatSmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun granted(permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  private fun statuses(): Map<String, Boolean> = mapOf(
    "readSms" to granted(Manifest.permission.READ_SMS),
    "receiveSms" to granted(Manifest.permission.RECEIVE_SMS),
    // Before Android 13 notifications need no runtime permission.
    "postNotifications" to (Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS)),
  )

  override fun definition() = ModuleDefinition {
    Name("BacchatSms")

    Events("onSmsReceived", "onCategoryPicked")

    OnCreate { live = this@BacchatSmsModule }
    OnDestroy { if (live === this@BacchatSmsModule) live = null }

    Function("getPermissions") { statuses() }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      val wanted = ArrayList<String>()
      wanted.add(Manifest.permission.READ_SMS)
      wanted.add(Manifest.permission.RECEIVE_SMS)
      if (Build.VERSION.SDK_INT >= 33) wanted.add(Manifest.permission.POST_NOTIFICATIONS)
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, *wanted.toTypedArray())
    }

    Function("setEnabled") { on: Boolean ->
      SmsStore.setEnabled(context, on)
      PaymentWatchService.sync(context)
    }

    Function("setNotificationsEnabled") { on: Boolean ->
      SmsStore.setNotificationsEnabled(context, on)
      PaymentWatchService.sync(context)
    }

    /**
     * Asks Android to let Bacchat keep running in the background (battery optimisation off), so the
     * reading service is not stopped. Shows the system prompt only when not already allowed.
     * Returns true when it is already allowed.
     */
    Function("askToRunInBackground") {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (power.isIgnoringBatteryOptimizations(context.packageName)) return@Function true
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + context.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      } catch (e: Exception) {
        // No such screen on this phone: reading still works while the service runs.
      }
      false
    }

    /** True when the user has granted Bacchat Notification access in system settings. */
    Function("hasNotificationAccess") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    /** Opens the system screen where Notification access is granted. */
    Function("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("readInbox") { sinceMs: Double, limit: Int ->
      if (!granted(Manifest.permission.READ_SMS)) {
        throw SmsPermissionException()
      }
      val out = ArrayList<Map<String, Any>>()
      val cap = if (limit < 1) 1 else if (limit > 5000) 5000 else limit
      val cursor = context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date >= ?",
        arrayOf(sinceMs.toLong().toString()),
        "date DESC",
      )
      cursor?.use {
        val iId = it.getColumnIndexOrThrow("_id")
        val iAddress = it.getColumnIndexOrThrow("address")
        val iBody = it.getColumnIndexOrThrow("body")
        val iDate = it.getColumnIndexOrThrow("date")
        while (it.moveToNext() && out.size < cap) {
          out.add(
            mapOf(
              "id" to it.getString(iId),
              "address" to (it.getString(iAddress) ?: ""),
              "body" to (it.getString(iBody) ?: ""),
              "receivedAt" to it.getLong(iDate).toDouble(),
            ),
          )
        }
      }
      out
    }

    Function("drainQueued") { SmsStore.queued(context) }

    Function("acknowledge") { ids: List<String> -> SmsStore.acknowledge(context, ids) }

    // choices: [{ id, label, saved }], at most 8 arguments per native function.
    Function("postEntryNotification") { channelName: String, title: String, text: String, entryId: String, choices: List<Map<String, String>>, moreLabel: String, deepLink: String ->
      SmsNotifier.postEntry(
        context, channelName, title, text, entryId,
        choices.map { it["id"].orEmpty() },
        choices.map { it["label"].orEmpty() },
        choices.map { it["saved"].orEmpty() },
        moreLabel, deepLink,
      )
    }

    Function("cancelEntryNotification") { entryId: String -> SmsNotifier.cancelEntry(context, entryId) }

    /**
     * True only while a Bacchat screen is on show. React Native's AppState can read "active" while
     * the reading service keeps the process alive with no screen at all, so this asks Android.
     */
    Function("isAppVisible") {
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val me = am.runningAppProcesses?.firstOrNull { it.pid == android.os.Process.myPid() }
      me != null && me.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }

    Function("drainPicks") { SmsStore.picks(context) }

    Function("acknowledgePicks") { entryIds: List<String> -> SmsStore.acknowledgePicks(context, entryIds) }

    Function("postNotification") { channelName: String, title: String, text: String, deepLink: String ->
      SmsNotifier.post(context, channelName, title, text, deepLink)
    }
  }

  companion object {
    @Volatile
    private var live: BacchatSmsModule? = null

    fun isLive(): Boolean = live != null

    /** Called by the receiver. Reaches JS only when the module is alive; the queue covers the rest. */
    fun deliver(id: String, address: String, body: String, receivedAt: Long) {
      live?.sendEvent(
        "onSmsReceived",
        mapOf("id" to id, "address" to address, "body" to body, "receivedAt" to receivedAt.toDouble()),
      )
    }

    /** Called by CategoryPickReceiver when the app is alive. */
    fun deliverPick(entryId: String, categoryId: String) {
      live?.sendEvent("onCategoryPicked", mapOf("entryId" to entryId, "categoryId" to categoryId))
    }
  }
}

class SmsPermissionException : expo.modules.kotlin.exception.CodedException(
  "ERR_SMS_PERMISSION",
  "SMS permission has not been granted.",
  null,
)
