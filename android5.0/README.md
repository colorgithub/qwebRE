# Android 5.0 (API 21) 版本说明

这个目录用于单独维护 `Android 5.0` 兼容版本，避免影响当前主线（Capacitor 5 / minSdk 22）。

## 关键点

- Android 5.0 = API 21
- 当前主线使用 Capacitor 5，最低 API 22，不支持 5.0
- 5.0 版本建议降级到 Capacitor 4 并设置 `minSdkVersion = 21`

## 推荐做法

1. 基于当前代码新建分支（例如 `android5`）
2. 使用 `package.android5.json` 覆盖依赖
3. 将 `variables.android5.gradle` 内容应用到 `android/variables.gradle`
4. 重新安装依赖并同步 Capacitor
5. 重新打包并真机测试 Android 5.0

## 快速命令（参考）

```powershell
copy package.android5.json ..\package.json /Y
npm install
npx cap sync android
cd ..\android
.\gradlew assembleRelease
```

## 注意

- Android 5.0 下 WebView 性能和兼容性较弱，建议减少大图、动画和复杂特效
- 某些现代插件可能不支持 API 21，需要逐个验证
