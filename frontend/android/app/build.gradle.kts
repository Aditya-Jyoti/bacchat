import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

val keyPropertiesFile = rootProject.file("key.properties")
val keyProperties = Properties()
if (keyPropertiesFile.exists()) {
    keyProperties.load(FileInputStream(keyPropertiesFile))
}

android {
    namespace = "com.bacchat.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.bacchat.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

    }

    // Drop 32-bit ARM and x86_64 .so libs from the packaged APK.
    //
    // Why `packaging.jniLibs.excludes` instead of `defaultConfig.ndk.abiFilters`
    // or `splits.abi`:
    //   • abiFilters only narrows what the NDK compiles for THIS module —
    //     prebuilt .so libs from plugin AARs (Google ML Kit OCR ~11MB/arch,
    //     mobile_scanner's libbarhopper_v3 ~5MB/arch, sqlite3 ~1.5MB/arch)
    //     are bundled unchanged. That's how a 57MB APK turned into 73MB.
    //   • splits.abi produces SEPARATE APKs per ABI, which doesn't fit our
    //     "one APK per release" workflow.
    //   • packaging.jniLibs.excludes flat-out removes the unwanted .so
    //     folders from the packaged output, regardless of where they
    //     originated.
    //
    // armeabi-v7a is 32-bit legacy (every Android phone shipped in the last
    // decade is arm64); x86_64 is emulator-only.
    packaging {
        jniLibs {
            excludes += setOf(
                "lib/armeabi-v7a/**",
                "lib/x86/**",
                "lib/x86_64/**",
            )
        }
    }

    signingConfigs {
        if (keyPropertiesFile.exists()) {
            create("release") {
                keyAlias = keyProperties["keyAlias"] as String
                keyPassword = keyProperties["keyPassword"] as String
                storeFile = file(keyProperties["storeFile"] as String)
                storePassword = keyProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keyPropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."
}
