#!/usr/bin/env bash
# Run once to create the release signing key.
# Keep bacchat-release.jks and key.properties OUT of git.
set -e

keytool -genkeypair \
  -v \
  -keystore android/bacchat-release.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias bacchat \
  -storepass "${STORE_PASS:?set STORE_PASS}" \
  -keypass  "${KEY_PASS:?set KEY_PASS}"  \
  -dname "CN=Bacchat, OU=Mobile, O=Bacchat, L=Unknown, S=Unknown, C=IN"

cat > android/key.properties <<EOF
storePassword=${STORE_PASS}
keyPassword=${KEY_PASS}
keyAlias=bacchat
storeFile=../bacchat-release.jks
EOF

echo "Keystore created at android/bacchat-release.jks"
echo "key.properties written. Add both to .gitignore NOW."
