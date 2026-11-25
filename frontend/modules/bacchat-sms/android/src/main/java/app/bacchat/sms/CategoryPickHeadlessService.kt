package app.bacchat.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the JS task "BacchatCategoryPick" for a category picked from a notification while the app is closed. */
class CategoryPickHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    val entryId = extras.getString(CategoryPickReceiver.EXTRA_ENTRY) ?: return null
    val data = Arguments.createMap().apply {
      putString("entryId", entryId)
      putString("categoryId", extras.getString(CategoryPickReceiver.EXTRA_CATEGORY).orEmpty())
      putString("note", extras.getString(CategoryPickReceiver.EXTRA_NOTE).orEmpty())
    }
    return HeadlessJsTaskConfig(TASK_KEY, data, 30_000, true)
  }

  companion object {
    const val TASK_KEY = "BacchatCategoryPick"
  }
}
