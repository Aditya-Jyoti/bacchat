package expo.modules.bacchatdynamiccolor

import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the Android 12+ wallpaper (Material You) tonal palettes. getPalettes() returns
 * { accent1: { "0": "#RRGGBB", "10": ..., "1000": ... }, accent2, accent3, neutral1, neutral2 }
 * or null below Android 12. Mapping the tones to app colour roles happens in TypeScript.
 */
class BacchatDynamicColorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BacchatDynamicColor")

    Function("getPalettes") {
      val context = appContext.reactContext
      if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@Function null
      }
      return@Function readPalettes(context)
    }
  }

  private fun hex(context: Context, id: Int): String {
    val argb = context.resources.getColor(id, context.theme)
    return String.format("#%06X", 0xFFFFFF and argb)
  }

  private fun readPalettes(context: Context): Map<String, Map<String, String>> {
    fun palette(vararg tones: Pair<String, Int>): Map<String, String> =
      tones.associate { (tone, id) -> tone to hex(context, id) }
    return mapOf(
      "accent1" to palette(
        "0" to android.R.color.system_accent1_0,
        "10" to android.R.color.system_accent1_10,
        "50" to android.R.color.system_accent1_50,
        "100" to android.R.color.system_accent1_100,
        "200" to android.R.color.system_accent1_200,
        "300" to android.R.color.system_accent1_300,
        "400" to android.R.color.system_accent1_400,
        "500" to android.R.color.system_accent1_500,
        "600" to android.R.color.system_accent1_600,
        "700" to android.R.color.system_accent1_700,
        "800" to android.R.color.system_accent1_800,
        "900" to android.R.color.system_accent1_900,
        "1000" to android.R.color.system_accent1_1000
      ),
      "accent2" to palette(
        "0" to android.R.color.system_accent2_0,
        "10" to android.R.color.system_accent2_10,
        "50" to android.R.color.system_accent2_50,
        "100" to android.R.color.system_accent2_100,
        "200" to android.R.color.system_accent2_200,
        "300" to android.R.color.system_accent2_300,
        "400" to android.R.color.system_accent2_400,
        "500" to android.R.color.system_accent2_500,
        "600" to android.R.color.system_accent2_600,
        "700" to android.R.color.system_accent2_700,
        "800" to android.R.color.system_accent2_800,
        "900" to android.R.color.system_accent2_900,
        "1000" to android.R.color.system_accent2_1000
      ),
      "accent3" to palette(
        "0" to android.R.color.system_accent3_0,
        "10" to android.R.color.system_accent3_10,
        "50" to android.R.color.system_accent3_50,
        "100" to android.R.color.system_accent3_100,
        "200" to android.R.color.system_accent3_200,
        "300" to android.R.color.system_accent3_300,
        "400" to android.R.color.system_accent3_400,
        "500" to android.R.color.system_accent3_500,
        "600" to android.R.color.system_accent3_600,
        "700" to android.R.color.system_accent3_700,
        "800" to android.R.color.system_accent3_800,
        "900" to android.R.color.system_accent3_900,
        "1000" to android.R.color.system_accent3_1000
      ),
      "neutral1" to palette(
        "0" to android.R.color.system_neutral1_0,
        "10" to android.R.color.system_neutral1_10,
        "50" to android.R.color.system_neutral1_50,
        "100" to android.R.color.system_neutral1_100,
        "200" to android.R.color.system_neutral1_200,
        "300" to android.R.color.system_neutral1_300,
        "400" to android.R.color.system_neutral1_400,
        "500" to android.R.color.system_neutral1_500,
        "600" to android.R.color.system_neutral1_600,
        "700" to android.R.color.system_neutral1_700,
        "800" to android.R.color.system_neutral1_800,
        "900" to android.R.color.system_neutral1_900,
        "1000" to android.R.color.system_neutral1_1000
      ),
      "neutral2" to palette(
        "0" to android.R.color.system_neutral2_0,
        "10" to android.R.color.system_neutral2_10,
        "50" to android.R.color.system_neutral2_50,
        "100" to android.R.color.system_neutral2_100,
        "200" to android.R.color.system_neutral2_200,
        "300" to android.R.color.system_neutral2_300,
        "400" to android.R.color.system_neutral2_400,
        "500" to android.R.color.system_neutral2_500,
        "600" to android.R.color.system_neutral2_600,
        "700" to android.R.color.system_neutral2_700,
        "800" to android.R.color.system_neutral2_800,
        "900" to android.R.color.system_neutral2_900,
        "1000" to android.R.color.system_neutral2_1000
      )
    )
  }
}
