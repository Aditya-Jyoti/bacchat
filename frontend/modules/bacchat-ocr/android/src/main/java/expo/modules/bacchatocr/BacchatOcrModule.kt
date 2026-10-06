package expo.modules.bacchatocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * On-device text recognition with the bundled ML Kit Latin model.
 * recognize(imageUri) resolves { text, lines: [{ text, top, left }] }, lines in reading order.
 * All parsing stays in TypeScript; this file only reads pixels.
 */
class BacchatOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BacchatOcr")

    AsyncFunction("recognize") { imageUri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "No Android context", null)
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(imageUri))
        recognizer.process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { block ->
              block.lines.map { line ->
                mapOf(
                  "text" to line.text,
                  "top" to (line.boundingBox?.top ?: 0),
                  "left" to (line.boundingBox?.left ?: 0)
                )
              }
            }
            recognizer.close()
            promise.resolve(mapOf("text" to result.text, "lines" to lines))
          }
          .addOnFailureListener { e ->
            recognizer.close()
            promise.reject("E_OCR", e.message ?: "Text recognition failed", e)
          }
      } catch (e: Exception) {
        recognizer.close()
        promise.reject("E_OCR_INPUT", e.message ?: "Could not open the image", e)
      }
    }
  }
}
