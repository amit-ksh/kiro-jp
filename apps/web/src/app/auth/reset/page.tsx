import { Suspense } from "react";
import { ResetHandoff } from "./reset-handoff";
export default function ResetPage() { return <main className="access"><h1>Set your new password in Android.</h1><Suspense fallback={<p>Preparing your secure app link…</p>}><ResetHandoff/></Suspense></main>; }
