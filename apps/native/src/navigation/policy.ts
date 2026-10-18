export const learningStackOptions = { initialRouteName: "(tabs)" } as const;
export const onboardingSteps = [
  "setup",
  "import",
  "placement",
  "interests",
  "preview",
] as const;
export function previousOnboardingStep(step: string) {
  const index = onboardingSteps.findIndex((item) => item === step);
  return index > 0 ? onboardingSteps[index - 1] : undefined;
}
export const learningTabOptions = {
  initialRouteName: "index",
  backBehavior: "history",
} as const;
type State = {
  type?: string;
  index?: number;
  history?: readonly unknown[];
  routes: readonly { name: string; state?: State }[];
};
function hasHistory(state?: State): boolean {
  if (!state) return false;
  return (
    hasHistory(state.routes[state.index ?? 0]?.state) ||
    (state.type === "tab"
      ? (state.history?.length ?? 0) > 1
      : (state.index ?? 0) > 0)
  );
}
export function learningBackAction(
  root: State | undefined,
  segments: readonly string[],
): "back" | "home" | "exit" | "fallback" {
  const learning = root?.routes.find(
    (route) => route.name === "(learning)",
  )?.state;
  if (hasHistory(learning)) return "back";
  if (!segments.includes("(tabs)")) return "fallback";
  const last = segments.at(-1);
  return !last || last === "index" || last === "(tabs)" ? "exit" : "home";
}
export function learningFallback(segments: readonly string[]) {
  const last = segments.at(-1) ?? "";
  if (["chat", "saved-phrases"].includes(last))
    return "/(learning)/(tabs)/conversation" as const;
  if (
    [
      "settings",
      "progress",
      "interests",
      "account-data",
      "reminders",
      "sources",
    ].includes(last)
  )
    return "/(learning)/(tabs)/profile" as const;
  if (["level", "item", "grammar", "[id]", "session-preview"].includes(last))
    return "/(learning)/(tabs)/lessons" as const;
  return "/(learning)/(tabs)" as const;
}
