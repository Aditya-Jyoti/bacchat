package app.bacchat.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.IntentCompat
import java.io.File
import java.util.UUID

/**
 * Reads image URIs out of a share intent and copies each into the app cache, so they stay
 * readable after the sending app's temporary permission ends. Everything stays on this phone.
 */
object SharedImages {
  private const val MAX_IMAGES = 10

  fun isShare(intent: Intent?): Boolean {
    if (intent == null) return false
    val action = intent.action
    return (action == Intent.ACTION_SEND || action == Intent.ACTION_SEND_MULTIPLE) &&
      (intent.type?.startsWith("image/") == true)
  }

  fun uris(intent: Intent): List<Uri> {
    val out = ArrayList<Uri>()
    if (intent.action == Intent.ACTION_SEND) {
      IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)?.let { out.add(it) }
    } else {
      IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)?.let { out.addAll(it) }
    }
    return out.take(MAX_IMAGES)
  }

  /** Copies to cache/shared and returns file:// URIs. Falls back to the original URI on failure. */
  fun copyToCache(context: Context, uris: List<Uri>): List<String> {
    val dir = File(context.cacheDir, "shared")
    dir.mkdirs()
    return uris.map { uri ->
      try {
        val target = File(dir, UUID.randomUUID().toString() + ".img")
        context.contentResolver.openInputStream(uri)?.use { input ->
          target.outputStream().use { output -> input.copyTo(output) }
        } ?: return@map uri.toString()
        Uri.fromFile(target).toString()
      } catch (e: Exception) {
        uri.toString()
      }
    }
  }

  /** Marks the intent as handled so a re-read (rotation, resume) does not import twice. */
  fun consume(intent: Intent) {
    intent.removeExtra(Intent.EXTRA_STREAM)
    intent.action = Intent.ACTION_MAIN
  }
}
