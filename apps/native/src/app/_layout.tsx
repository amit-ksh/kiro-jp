import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../features/auth/AuthProvider";
import { DeletionProvider } from "../features/auth/DeletionProvider";
export default function Layout() { return <SafeAreaProvider><AuthProvider><DeletionProvider><StatusBar barStyle="light-content"/><Stack screenOptions={{ headerShown: false }}/></DeletionProvider></AuthProvider></SafeAreaProvider>; }
