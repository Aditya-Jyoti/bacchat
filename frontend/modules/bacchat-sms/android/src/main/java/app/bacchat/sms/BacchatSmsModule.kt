package app.bacchat.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
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

    Events("onSmsReceived")

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

    Function("setEnabled") { on: Boolean -> SmsStore.setEnabled(context, on) }

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

    Function("postNotification") { channelName: String, title: String, text: String, deepLink: String ->
      SmsNotifier.post(context, channelName, title, text, deepLink)
    }
  }

  companion object {
    @Volatile
    private var live: BacchatSmsModule? = null

    /** Called by the receiver. Reaches JS only when the module is alive; the queue covers the rest. */
    fun deliver(id: String, address: String, body: String, receivedAt: Long) {
      live?.sendEvent(
        "onSmsReceived",
        mapOf("id" to id, "address" to address, "body" to body, "receivedAt" to receivedAt.toDouble()),
      )
    }
  }
}

class SmsPermissionException : expo.modules.kotlin.exception.CodedException(
  "ERR_SMS_PERMISSION",
  "SMS permission has not been granted.",
  null,
)
