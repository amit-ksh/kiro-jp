import { Animated, View } from "react-native";
import {
  brandAccent,
  brandFrames,
  brandInk,
  brandStrokeOpacity,
  brandStrokeWidth,
  strokePose,
} from "@packages/design-tokens";

/** Native-driver transforms keep the same eight authored strokes throughout. */
export function KiroMark({
  size = 180,
  progress,
}: {
  size?: number;
  progress?: Animated.Value;
}) {
  const scale = size / 256;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {brandFrames[2]!.map((stroke, index) => {
        const poses = brandFrames.map((frame) => strokePose(frame[index]!));
        const final = strokePose(stroke);
        const interpolate = (values: number[]) =>
          progress
            ? progress.interpolate({
                inputRange: [0, 1, 2],
                outputRange: values,
                extrapolate: "clamp",
              })
            : values[2]!;
        const rotation = progress
          ? progress.interpolate({
              inputRange: [0, 1, 2],
              outputRange: poses.map((p) => `${p.angle}deg`),
              extrapolate: "clamp",
            })
          : `${final.angle}deg`;
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              left: size / 2 - 50 * scale,
              top: size / 2 - (brandStrokeWidth * scale) / 2,
              width: 100 * scale,
              height: brandStrokeWidth * scale,
              borderRadius: (brandStrokeWidth * scale) / 2,
              backgroundColor: index >= 6 ? brandAccent : brandInk,
              opacity: interpolate(
                brandFrames.map((_, frame) => brandStrokeOpacity(frame, index)),
              ),
              transform: [
                { translateX: interpolate(poses.map((p) => p.x * scale)) },
                { translateY: interpolate(poses.map((p) => p.y * scale)) },
                { rotate: rotation },
                { scaleX: interpolate(poses.map((p) => p.length / 100)) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
