import { useCallback, useEffect } from "react";
import { Alert, BackHandler, Keyboard, Platform } from "react-native";
import { router, useNavigationContainerRef, useSegments } from "expo-router";
import { learningBackAction, learningFallback } from "./policy";
export function useAppBack() {
  const navigation = useNavigationContainerRef(),
    segments = useSegments();
  return useCallback(() => {
    if (!segments.includes("(learning)")) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    const action = learningBackAction(navigation.getRootState(), segments);
    if (action === "back") router.back();
    else if (action === "home") router.replace("/(learning)/(tabs)");
    else if (action === "fallback") router.replace(learningFallback(segments));
    else
      Alert.alert("Close Kiro JP?", "Your study is saved.", [
        { text: "Keep studying", style: "cancel" },
        { text: "Close app", onPress: () => BackHandler.exitApp() },
      ]);
  }, [navigation, segments]);
}
export function LearningBackGuard() {
  const back = useAppBack();
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (Keyboard.isVisible()) Keyboard.dismiss();
        else back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back]);
  return null;
}
