package app.bacchat.sms

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Small private store: the on/off switch and the queue of messages that arrived while the app was
 * not running. Lives in app-private SharedPreferences. Nothing here is logged or sent anywhere.
 */
object SmsStore {
  private const val FILE = "bacchat_sms"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_QUEUE = "queue"
  private const val MAX_QUEUE = 200

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun isEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, on: Boolean) {
    val editor = prefs(context).edit().putBoolean(KEY_ENABLED, on)
    // Turning reading off also forgets anything queued.
    if (!on) editor.remove(KEY_QUEUE)
    editor.apply()
  }

  @Synchronized
  fun enqueue(context: Context, id: String, address: String, body: String, receivedAt: Long) {
    val p = prefs(context)
    val arr = try { JSONArray(p.getString(KEY_QUEUE, "[]")) } catch (e: Exception) { JSONArray() }
    for (i in 0 until arr.length()) if (arr.getJSONObject(i).optString("id") == id) return
    val item = JSONObject()
    item.put("id", id)
    item.put("address", address)
    item.put("body", body)
    item.put("receivedAt", receivedAt)
    arr.put(item)
    // Keep the newest MAX_QUEUE.
    val trimmed = JSONArray()
    val start = if (arr.length() > MAX_QUEUE) arr.length() - MAX_QUEUE else 0
    for (i in start until arr.length()) trimmed.put(arr.getJSONObject(i))
    p.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
  }

  @Synchronized
  fun queued(context: Context): List<Map<String, Any>> {
    val arr = try { JSONArray(prefs(context).getString(KEY_QUEUE, "[]")) } catch (e: Exception) { JSONArray() }
    val out = ArrayList<Map<String, Any>>()
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      out.add(
        mapOf(
          "id" to o.getString("id"),
          "address" to o.getString("address"),
          "body" to o.getString("body"),
          "receivedAt" to o.getLong("receivedAt").toDouble(),
        ),
      )
    }
    return out
  }

  @Synchronized
  fun acknowledge(context: Context, ids: List<String>) {
    val p = prefs(context)
    val arr = try { JSONArray(p.getString(KEY_QUEUE, "[]")) } catch (e: Exception) { JSONArray() }
    val keep = JSONArray()
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      if (!ids.contains(o.optString("id"))) keep.put(o)
    }
    p.edit().putString(KEY_QUEUE, keep.toString()).apply()
  }
}
