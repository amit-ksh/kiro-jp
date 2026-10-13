import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const host = process.env.EXPO_PUBLIC_APP_LINK_HOST;
  return {
    ...config,
    name: "Japanese Learning App", slug: "japanese-learning-app", owner: "amit-ksh", scheme: "japanesestudy",
    version: "0.1.0", orientation: "portrait", userInterfaceStyle: "automatic",
    android: {
      package: process.env.ANDROID_PACKAGE_ID ?? "com.kiro.japanesestudy",
      predictiveBackGestureEnabled: true,
      ...(host ? { intentFilters: [{ action: "VIEW", autoVerify: true, category: ["BROWSABLE", "DEFAULT"], data: [{ scheme: "https", host, pathPrefix: "/auth/reset" }] }] } : {}),
    },
    plugins: [["expo-router", { root: "./src/app" }], "expo-secure-store", "expo-sqlite", "expo-asset", "expo-font", ["expo-audio", { microphonePermission: "Allow Japanese Learning App to record your speaking practice." }]],
    experiments: { typedRoutes: false },
    extra: { eas: { projectId: "48bd39bd-9a50-4802-a67a-63eeda132992" } },
  };
};
