import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../features/auth/AuthProvider";
export default function Layout() { return <SafeAreaProvider><AuthProvider><StatusBar barStyle="light-content"/><Stack screenOptions={{ headerShown: false }}/></AuthProvider></SafeAreaProvider>; }
