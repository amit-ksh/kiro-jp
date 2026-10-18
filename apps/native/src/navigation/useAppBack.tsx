import { useCallback, useEffect } from "react";
import { Alert, BackHandler, Keyboard, Platform } from "react-native";
import { router, useNavigationContainerRef, useSegments } from "expo-router";
import {
  learningBackAction,
  learningFallback,
  previousOnboardingStep,
} from "./policy";
import { useProfile } from "../data/ProfileProvider";
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
  const segments = useSegments();
  const { profile, update } = useProfile();
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (Keyboard.isVisible()) Keyboard.dismiss();
        else {
          const previous =
            segments.includes("(tabs)") &&
            previousOnboardingStep(profile.onboardingStep);
          if (previous)
            void update({ onboardingStep: previous }).catch(() =>
              Alert.alert(
                "Couldn't go back",
                "Your answers are saved. Please try again.",
              ),
            );
          else back();
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [back, profile.onboardingStep, segments, update]);
  return null;
}
