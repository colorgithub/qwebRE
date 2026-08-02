# qwebRE

基于 **React + Vite + Capacitor** 的 NapCat（OneBot 11）Web 客户端，可在浏览器运行，也可打包 Android APK / Electron 桌面端。

### <a href="https://colorgithub.github.io/qwebRE/">访问demo</a>
## 功能概览

- 通过 WebSocket 连接 NapCat/OneBot 服务
- 私聊、群聊消息展示（文本、图片、表情、视频、语音、文件、@、回复、分享、JSON 消息）
- 多会话管理
- 收藏表情发送
- 消息撤回、删除、+1、设精
- 群管理（全员禁言、退群、改群名）
- 个人资料修改（昵称、签名）
- 内置 Mock Server 便于本地联调
- 支持 Android Debug / Release APK 构建
- 支持 Electron Windows 桌面端打包

## 运行环境

- Node.js 18+
- npm 9+
- JDK 17（已用 JDK 17 验证）
- Android SDK（建议安装 Platform 33）

## 项目启动

```bash
npm install
npm run dev
```

默认访问：`http://localhost:5173`

## Mock Server 调试

没有 NapCat 服务时可先用 Mock：

```bash
node mock-server.cjs
```

然后在前端连接：`ws://localhost:3001`

## 与 NapCat 对接

请确保 NapCat 已开启 WebSocket 服务，例如：

```json
{
  "network": {
    "websocketServers": [
      {
        "enable": true,
        "host": "0.0.0.0",
        "port": 3001
      }
    ]
  }
}
```

## Web 构建

```bash
npm run build
```

产物目录：`dist/`

## Android 打包

先同步前端资源到 Android 工程：

```bash
npm run build
npx cap sync android
```

进入 Android 目录后执行：

```bash
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

PowerShell 下可写：

```powershell
cd android
.\gradlew assembleDebug
.\gradlew assembleRelease
```

### APK 输出路径

- Debug：`android/app/build/outputs/apk/debug/app-debug.apk`
- Release：`android/app/build/outputs/apk/release/app-release-unsigned.apk`

## 版本说明（当前工程）

- **应用版本：1.0.5**
- Capacitor：4.8.x
- Android Gradle Plugin：8.0.0
- Gradle Wrapper：8.0.2
- minSdkVersion：21（Android 5.0+）
- targetSdkVersion：33

## 更新日志

### v1.0.5（2025-05-24）

- 修复收藏表情功能：正确解析 NapCat 返回的 URL 字符串数组，修复显示和发送
- 修复进入聊天时历史记录重复的问题
- 修复右键菜单（撤回/删除）超出屏幕底部的问题
- 每次进入聊天界面自动重新加载历史记录

## 常见问题

### 1. `android() is applicable...` 或 Capacitor 构建脚本报错

通常是 **Capacitor 依赖版本** 与 **android 原生工程模板** 不一致。建议：

```bash
npx cap sync android
```

必要时执行迁移：

```bash
npx cap migrate --noprompt --packagemanager npm
```

### 2. Gradle 下载超时

如果网络无法访问 `services.gradle.org`，可手动下载 Gradle 分发包并在 `android/gradle/wrapper/gradle-wrapper.properties` 中改为本地 `file:///` 路径。

### 3. Release 是 unsigned

`assembleRelease` 默认输出未签名包。如需上架，请配置 keystore 后再签名。

## 常用命令速查

```bash
npm run dev
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
cd android && ./gradlew assembleRelease
```
