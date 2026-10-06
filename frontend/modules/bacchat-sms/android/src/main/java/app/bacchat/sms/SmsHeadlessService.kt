package app.bacchat.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs the JS task "BacchatSmsHeadless" (registered in index.ts) for one SMS that arrived while the
 * app was closed. Uses the app's ReactHost (new architecture) through the base class. The JS side
 * reads the message with the normal pipeline and acknowledges it in the queue.
 */
class SmsHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    val id = extras.getString(EXTRA_ID) ?: return null
    val data = Arguments.createMap().apply {
      putString("id", id)
      putString("address", extras.getString(EXTRA_ADDRESS) ?: "")
      putString("body", extras.getString(EXTRA_BODY) ?: "")
      putDouble("receivedAt", extras.getLong(EXTRA_RECEIVED_AT).toDouble())
    }
    // 30 s is a safeguard; a single message takes well under a second.
    return HeadlessJsTaskConfig(TASK_KEY, data, 30_000, true)
  }

  companion object {
    const val TASK_KEY = "BacchatSmsHeadless"
    const val EXTRA_ID = "id"
    const val EXTRA_ADDRESS = "address"
    const val EXTRA_BODY = "body"
    const val EXTRA_RECEIVED_AT = "receivedAt"
  }
}
