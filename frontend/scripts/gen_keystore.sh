#!/usr/bin/env bash
# Run once to create the release signing key.
# Keep bacchat-release.jks and key.properties OUT of git.
#
# Java 9+ keytool defaults to PKCS12, which only supports a single password
# for both the store and the key. Asking for two separate passwords would
# silently set them both to STORE_PASS — and writing the user-supplied
# KEY_PASS into key.properties would then make Gradle fail with
# "Get Key failed: Given final block not properly padded".
#
# We force the PKCS12 single-password model explicitly: ONE password, used
# everywhere. Set STORE_PASS in the environment before running.
set -e

: "${STORE_PASS:?set STORE_PASS}"

keytool -genkeypair \
  -v \
  -keystore android/bacchat-release.jks \
  -storetype PKCS12 \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias bacchat \
  -storepass "${STORE_PASS}" \
  -keypass  "${STORE_PASS}"  \
  -dname "CN=Bacchat, OU=Mobile, O=Bacchat, L=Unknown, S=Unknown, C=IN"

cat > android/key.properties <<EOF
storePassword=${STORE_PASS}
keyPassword=${STORE_PASS}
keyAlias=bacchat
storeFile=../bacchat-release.jks
EOF

echo "Keystore created at android/bacchat-release.jks"
echo "key.properties written. Both files are already covered by android/.gitignore."
