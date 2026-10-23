import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const babel = require("@babel/core");

// Exercise the installed RN Keyboard implementation, including its receiver,
// while replacing only the native event bridge and rendered native elements.
function loadModule(code: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as any };
  const localRequire = (name: string) =>
    name in dependencies ? dependencies[name] : require(name);
  vm.runInThisContext(`(function(require,module,exports){"use strict";${code}\n})`)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

function mountTabBar(keyboardVisible: boolean) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  class NativeEmitter {
    addListener(name: string, listener: (event: unknown) => void) {
      const group = listeners.get(name) ?? new Set();
      group.add(listener);
      listeners.set(name, group);
      return { remove: () => group.delete(listener) };
    }
  }
  const keyboardPath = require.resolve(
    "react-native/Libraries/Components/Keyboard/Keyboard.js",
  );
  const keyboardCode = babel.transformSync(fs.readFileSync(keyboardPath, "utf8"), {
    filename: keyboardPath,
    configFile: false,
    babelrc: false,
    presets: [require.resolve("@react-native/babel-preset")],
  }).code;
  const Keyboard = loadModule(keyboardCode, {
    "../../EventEmitter/NativeEventEmitter": NativeEmitter,
    "../../LayoutAnimation/LayoutAnimation": {},
    "../../Utilities/dismissKeyboard": () => {},
    "../../Utilities/Platform": { OS: "android" },
    "./NativeKeyboardObserver": {},
  }).default;
  if (keyboardVisible)
    for (const listener of listeners.get("keyboardDidShow") ?? [])
      listener({ endCoordinates: { height: 300 } });

  const source = fs.readFileSync(
    new URL("../apps/native/src/navigation/FloatingTabBar.tsx", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const { FloatingTabBar } = loadModule(code, {
    "react-native": {
      Keyboard,
      View: ({ children }: any) => React.createElement("section", null, children),
      Pressable: ({ children, accessibilityRole }: any) =>
        React.createElement("button", { role: accessibilityRole }, children),
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 24 }),
    },
    "@expo/vector-icons/Ionicons": () => null,
    "../components/ui": { useColors: () => ({}) },
  });
  const routes = ["index", "lessons", "review", "conversation", "profile"].map(
    (name) => ({ name, key: name }),
  );
  return renderToStaticMarkup(
    React.createElement(FloatingTabBar, {
      state: { index: 0, routes },
      descriptors: Object.fromEntries(
        routes.map(({ key }) => [key, { options: { title: key } }]),
      ),
      navigation: {},
    }),
  );
}

test("signed-in tab bar mounts with RN keyboard state and shows five tabs", () => {
  const markup = mountTabBar(false);
  assert.equal((markup.match(/role="tab"/g) ?? []).length, 5);
});

test("signed-in tab bar can mount while the login keyboard is still visible", () => {
  assert.equal(mountTabBar(true), "");
});
