cd android
.\gradlew assembleDebug --stacktrace --info > build.log 2>&1
echo "Gradle exited with code $LASTEXITCODE" >> build.log
