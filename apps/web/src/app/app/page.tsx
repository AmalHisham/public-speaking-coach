import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { BackendSessionStatus } from "@/features/auth/components/backend-session-status";
import { SessionCameraPreview } from "@/features/session/components/session-camera-preview";
import { SessionControls } from "@/features/session/components/session-controls";
import { LiveTranscript } from "@/features/speech/components/live-transcript";
import { SpeechTranscriptionSync } from "@/features/speech/components/speech-transcription-sync";

export default async function AppPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_transparent_28%),linear-gradient(180deg,_#fffaf0_0%,_#ffffff_55%,_#f5f5f4_100%)] px-6 py-10 sm:px-10">
      <SpeechTranscriptionSync />
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-sm shadow-stone-200/60 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">
              Authenticated App
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
              Clerk session is active
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-stone-700">
              This route is protected by Clerk middleware in Next.js. The card
              below separately validates the same session against the FastAPI
              backend. Use the user menu in the top-right corner to sign out.
            </p>
          </div>
          <div className="flex items-center justify-end">
            <UserButton />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="flex flex-col gap-6">
            <SessionControls />
            <SessionCameraPreview />
            <LiveTranscript />
          </div>

          <BackendSessionStatus />
        </section>
      </section>
    </main>
  );
}
