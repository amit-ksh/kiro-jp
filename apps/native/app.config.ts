import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const host = process.env.EXPO_PUBLIC_APP_LINK_HOST;
  return {
    ...config,
    name: "Kiro JP", slug: "japanese-learning-app", owner: "amit-ksh", scheme: "japanesestudy",
    version: "0.2.16", orientation: "portrait", userInterfaceStyle: "automatic",
    icon: "./assets/branding/icon.png",
    android: {
      package: process.env.ANDROID_PACKAGE_ID ?? "com.kiro.japanesestudy",
      versionCode: 18,
      adaptiveIcon: {
        foregroundImage: "./assets/branding/adaptive-foreground.png",
        backgroundColor: "#37469E",
        monochromeImage: "./assets/branding/adaptive-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      ...(host ? { intentFilters: [{ action: "VIEW", autoVerify: true, category: ["BROWSABLE", "DEFAULT"], data: [{ scheme: "https", host, pathPrefix: "/auth/reset" }] }] } : {}),
    },
    plugins: [["expo-router", { root: "./src/app" }], ["expo-splash-screen", {backgroundColor:"#37469E",image:"./assets/branding/splash-start.png",imageWidth:220,resizeMode:"contain"}], "expo-secure-store", "expo-sqlite", "expo-asset", "expo-font", ["expo-notifications", { color: "#37469E" }], ["expo-audio", { microphonePermission: "Allow Kiro JP to record your speaking practice.",enableBackgroundRecording:false,enableBackgroundPlayback:false }]],
    experiments: { typedRoutes: false },
    extra: { eas: { projectId: "48bd39bd-9a50-4802-a67a-63eeda132992" } },
  };
};
