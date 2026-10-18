import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { brandBackground, brandInk } from "@packages/design-tokens";
import { KiroMark } from "./KiroMark";

// Hide only after the matching React view has laid out, including offline starts.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export function LaunchScreen() {
  const [visible, setVisible] = useState(true),
    [laidOut, setLaidOut] = useState(false),
    [reduced, setReduced] = useState<boolean | null>(null);
  const progress = useRef(new Animated.Value(0)).current,
    opacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false),
    mounted = useRef(true);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    progress.stopAnimation();
    opacity.stopAnimation();
    void SplashScreen.hideAsync().catch(() => {});
    if (mounted.current) setVisible(false);
  }, [progress, opacity]);
  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted.current) setReduced(value);
      })
      .catch(() => {
        if (mounted.current) setReduced(true);
      });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        setReduced(value);
        if (value) finish();
      },
    );
    const state = AppState.addEventListener("change", (value) => {
      if (value !== "active") finish();
    });
    // Cosmetic startup never waits for authentication, network or an animation callback.
    const watchdog = setTimeout(finish, 1800);
    return () => {
      mounted.current = false;
      clearTimeout(watchdog);
      motion.remove();
      state.remove();
      progress.stopAnimation();
      opacity.stopAnimation();
    };
  }, [finish, progress, opacity]);
  useEffect(() => {
    if (!laidOut || reduced === null || finished.current) return;
    if (reduced) {
      progress.setValue(2);
      finish();
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 2,
        duration: 540,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished: complete }) => {
      if (complete) finish();
    });
    return () => animation.stop();
  }, [laidOut, reduced, progress, opacity, finish]);
  if (!visible) return null;
  return (
    <Animated.View
      onLayout={() => {
        void SplashScreen.hideAsync().catch(() => {});
        setLaidOut(true);
      }}
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: brandBackground,
          justifyContent: "center",
          alignItems: "center",
          opacity,
          zIndex: 1000,
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <KiroMark size={220} progress={progress} />
      <View
        style={{
          position: "absolute",
          top: "50%",
          marginTop: 86,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: brandInk,
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: -0.6,
          }}
        >
          Kiro JP
        </Text>
      </View>
    </Animated.View>
  );
}
