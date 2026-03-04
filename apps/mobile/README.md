# autoLV Android Wrapper (Capacitor)

## 개요
- 앱 이름: `autoLV`
- 패키지명: `com.autolv.app`
- 웹 소스: `https://auto-lv.vercel.app`
- 아이콘 소스: `docs/autoLV icon.jpg` -> `apps/mobile/assets/icon-only.jpg`

## 1) 초기 구성
```bash
cd apps/mobile
npm install
npx cap sync android
```

필수 환경:
- JDK 21
- Android SDK (Platform 35, Build-Tools 34+)

PowerShell 예시:
```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
```

## 2) 아이콘 재생성
```bash
cd apps/mobile
npx @capacitor/assets generate --android --assetPath assets
npx cap sync android
```

## 3) Android Studio 열기
```bash
cd apps/mobile
npx cap open android
```

## 4) APK 빌드
### Debug APK
```bash
cd apps/mobile
npm run android:build:debug
```

출력:
- `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK/AAB (확장성 있는 서명 방식)
`android/app/build.gradle`는 아래 환경변수를 우선 사용한다.

- `AUTOLV_UPLOAD_STORE_FILE`
- `AUTOLV_UPLOAD_STORE_PASSWORD`
- `AUTOLV_UPLOAD_KEY_ALIAS`
- `AUTOLV_UPLOAD_KEY_PASSWORD`

모든 값이 있으면 release 키로 서명하고, 없으면 debug 키로 fallback 된다.

PowerShell 예시:
```powershell
$env:AUTOLV_UPLOAD_STORE_FILE="C:\keystore\autolv-release.jks"
$env:AUTOLV_UPLOAD_STORE_PASSWORD="change-me"
$env:AUTOLV_UPLOAD_KEY_ALIAS="autolv"
$env:AUTOLV_UPLOAD_KEY_PASSWORD="change-me"
cd apps/mobile
npm run android:build:release
```

## 5) 운영 권장
1. Play 배포 전에는 반드시 release keystore로 서명
2. keystore는 Git에 커밋 금지 (`.gitignore` 반영됨)
3. 버전 업데이트 시 `android/app/build.gradle`의 `versionCode`, `versionName` 갱신
