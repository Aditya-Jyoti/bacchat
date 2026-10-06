package app.bacchat.share

import android.content.Context
import android.content.Intent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Exposes images shared into Bacchat (Android share sheet): the ones that launched the app and
 * a stream of new ones while it runs. JS decides what to do with them (open k7).
 */
class BacchatShareModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BacchatShare")

    Events("onShare")

    // Shared images that started the app. Returned once; later calls return an empty list.
    Function("getInitialSharedUris") {
      val intent: Intent? = appContext.currentActivity?.intent
      if (intent != null && SharedImages.isShare(intent)) {
        val copied = SharedImages.copyToCache(context, SharedImages.uris(intent))
        SharedImages.consume(intent)
        copied
      } else {
        emptyList<String>()
      }
    }

    OnNewIntent { intent ->
      if (SharedImages.isShare(intent)) {
        val copied = SharedImages.copyToCache(context, SharedImages.uris(intent))
        SharedImages.consume(intent)
        if (copied.isNotEmpty()) sendEvent("onShare", mapOf("uris" to copied))
      }
    }
  }
}
