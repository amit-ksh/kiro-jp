import { router } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useState } from "react";
import { Switch, View } from "react-native";
import { interests } from "@packages/content";
import { bandLabel, type LearningBand } from "@packages/learning-core";
import { useProfile } from "../../../data/ProfileProvider";
import { useSignOut } from "../../../features/auth/AuthProvider";
import { CulturalPreferences } from "../../../features/conversation/CulturalPreferences";
import { WaniKaniImport } from "../../../features/imports/WaniKaniImport";
import { Body, Button, Choice, Message, Panel, Screen, Title, useColors } from "../../../components/ui";
export default function Profile() {
  const { profile, update } = useProfile(); const colors = useColors(); const signOut = useSignOut(); const { isAuthenticated } = useConvexAuth(); const email = useQuery(api.account.passwordResetEmail, isAuthenticated ? {} : "skip");
  const capabilities = useQuery(api.account.capabilities, isAuthenticated ? {} : "skip");
  const [error, setError] = useState("");
  const save = (patch: Parameters<typeof update>[0]) => void update(patch).catch(() => setError("Your setting couldn't be saved. Please try again."));
  return <Screen title="Your Japanese, your pace."><Panel><Title>Level and daily goal</Title>{(["foundations", "early-n5", "early-n4"] as LearningBand[]).map(band => <Choice key={band} label={bandLabel(band)} selected={profile.acceptedBand === band} onPress={() => save({ acceptedBand: band })}/>)}{[5, 10, 15, 20, 30].map(minutes => <Choice key={minutes} label={`${minutes} minutes a day`} selected={profile.dailyMinutes === minutes} onPress={() => save({ dailyMinutes: minutes })}/>)}</Panel>
    <Panel><Title>Your interests</Title>{interests.map(interest => <Choice key={interest} label={interest} selected={profile.interests.includes(interest)} onPress={() => save(current => ({ interests: current.interests.includes(interest) ? current.interests.filter(item => item !== interest) : [...current.interests, interest] }))}/>)}</Panel>
    <CulturalPreferences/>
    <Panel><WaniKaniImport/></Panel>
    <Panel><Title>Reading support</Title>{([['furigana', 'Kana readings'], ['romaji', 'Romaji support'], ['translations', 'English translations']] as const).map(([key, label]) => <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Body>{label}</Body><Switch accessibilityLabel={label} value={profile[key]} onValueChange={value => save({ [key]: value })} trackColor={{ true: colors.primary, false: colors.outline }}/></View>)}{[1, 1.2, 1.4].map(scale => <Choice key={scale} label={`Text size ${Math.round(scale * 100)}%`} selected={profile.textScale === scale} onPress={() => save({ textScale: scale })}/>)}</Panel>
    <Panel><Title>Account</Title>{email && <Body>{email}</Body>}{capabilities?.passwordRecovery ? <><Button label="Change password by email" secondary disabled={!email} onPress={() => router.push({ pathname: "/auth/forgot", params: { email: email! } })}/><Body muted>Password changes use the same verified email link as recovery. Your learning history stays with this account.</Body></> : <Body muted>Password changes and recovery are unavailable in this early build.</Body>}<Button label="Sign out" secondary onPress={() => void signOut().then(() => router.replace("/")).catch(() => setError("Sign-out could not finish. Please try again."))}/>{error && <Message>{error}</Message>}</Panel>
  </Screen>;
}
