import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CommonActions,
  StackRouter,
  TabRouter,
} from "@react-navigation/routers";
import {
  learningBackAction,
  learningFallback,
  learningTabOptions,
  learningStackOptions,
  previousOnboardingStep,
} from "../apps/native/src/navigation/policy.ts";
const tabOptions = {
  routeNames: ["index", "lessons", "review", "conversation", "profile"],
  routeParamList: {},
  routeGetIdList: {},
};
test("gesture Back can follow saved onboarding steps without changing answers", () => {
  assert.equal(previousOnboardingStep("preview"), "interests");
  assert.equal(previousOnboardingStep("interests"), "placement");
  assert.equal(previousOnboardingStep("placement"), "import");
  assert.equal(previousOnboardingStep("import"), "setup");
  assert.equal(previousOnboardingStep("setup"), undefined);
  assert.equal(previousOnboardingStep("complete"), undefined);
});
test("Back retraces visited study tabs", () => {
  const router = TabRouter(learningTabOptions);
  let state = router.getInitialState(tabOptions);
  for (const name of ["lessons", "review", "conversation"])
    state = router.getStateForAction(
      state,
      CommonActions.navigate(name),
      tabOptions,
    )!;
  for (const expected of ["review", "lessons", "index"]) {
    state = router.getStateForAction(
      state,
      CommonActions.goBack(),
      tabOptions,
    )!;
    assert.equal(state.routes[state.index].name, expected);
  }
});
test("detail Back returns through speech, chat and its retained tab", () => {
  const router = StackRouter(learningStackOptions),
    options = {
      routeNames: ["(tabs)", "chat", "speech"],
      routeParamList: {},
      routeGetIdList: {},
    };
  let state = router.getInitialState(options);
  state = router.getStateForAction(
    state,
    { type: "PUSH", payload: { name: "chat" } },
    options,
  )!;
  state = router.getStateForAction(
    state,
    { type: "PUSH", payload: { name: "speech" } },
    options,
  )!;
  state = router.getStateForAction(state, CommonActions.goBack(), options)!;
  assert.equal(state.routes[state.index].name, "chat");
  state = router.getStateForAction(state, CommonActions.goBack(), options)!;
  assert.equal(state.routes[state.index].name, "(tabs)");
});
test("cold detail entry has a parent rather than exiting", () => {
  assert.equal(
    learningBackAction(undefined, ["(learning)", "chat"]),
    "fallback",
  );
  assert.equal(
    learningFallback(["(learning)", "chat"]),
    "/(learning)/(tabs)/conversation",
  );
  assert.equal(
    learningFallback(["(learning)", "settings"]),
    "/(learning)/(tabs)/profile",
  );
});
test("Home exit is explicit and does not return through authentication", () => {
  const root = {
    index: 1,
    routes: [
      { name: "auth/signin" },
      {
        name: "(learning)",
        state: {
          type: "stack",
          index: 0,
          routes: [
            {
              name: "(tabs)",
              state: TabRouter(learningTabOptions).getInitialState(tabOptions),
            },
          ],
        },
      },
    ],
  };
  assert.equal(
    learningBackAction(root, ["(learning)", "(tabs)", "index"]),
    "exit",
  );
  assert.equal(
    learningBackAction(undefined, ["(learning)", "(tabs)", "profile"]),
    "home",
  );
});
