import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

function buttonLinkClassName(variant: "default" | "outline") {
  return buttonVariants({
    className: "inline-flex",
    variant,
  });
}

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#fef3c7,_transparent_32%),linear-gradient(180deg,_#fffaf0_0%,_#ffffff_52%,_#f5f5f4_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between border-b border-black/10 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">
              Public Speaking Coach
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              Objective practice for better presentations
            </h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {userId ? (
              <Link className={buttonLinkClassName("default")} href="/app">
                Open App
              </Link>
            ) : (
              <>
                <Link className={buttonLinkClassName("outline")} href="/sign-in">
                  Log In
                </Link>
                <Link className={buttonLinkClassName("default")} href="/sign-up">
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid flex-1 gap-8 py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-center">
          <div className="space-y-6">
            <p className="max-w-2xl text-lg leading-8 text-stone-700">
              Practice in the browser, measure only what can be calculated, and
              turn each session into a repeatable improvement loop.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                className={buttonVariants({ size: "lg" })}
                href={userId ? "/app" : "/sign-in"}
                prefetch={false}
              >
                {userId ? "Continue to App" : "Log In to Start"}
              </Link>
              {!userId ? (
                <Link
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                  href="/sign-up"
                >
                  Create Account
                </Link>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm shadow-stone-200/50 backdrop-blur">
                <p className="text-sm font-medium text-stone-500">
                  Speech Analytics
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">
                  Pace, fillers, pauses
                </p>
              </article>
              <article className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm shadow-stone-200/50 backdrop-blur">
                <p className="text-sm font-medium text-stone-500">
                  Vision Analytics
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">
                  Camera and posture
                </p>
              </article>
              <article className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm shadow-stone-200/50 backdrop-blur">
                <p className="text-sm font-medium text-stone-500">
                  Coaching Output
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">
                  Strengths and next steps
                </p>
              </article>
            </div>
          </div>

          <section className="rounded-[2rem] border border-stone-300 bg-stone-950 p-6 text-stone-50 shadow-xl shadow-stone-950/20">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-amber-300">
              MVP Scope
            </p>
            <ul className="mt-6 space-y-4 text-sm text-stone-300">
              <li>Speaking Pace</li>
              <li>Filler Usage</li>
              <li>Pause Quality</li>
              <li>Camera Engagement</li>
              <li>Posture Stability</li>
            </ul>
            <div className="mt-8 rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-stone-300">
                Browser-first analytics with metrics calculated locally and
                interpreted separately by the backend report flow.
              </p>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                Authentication
              </p>
              <p className="mt-2 text-sm text-stone-300">
                Clerk handles sign-in and sign-out in the frontend. FastAPI
                validates the Clerk session on protected backend calls.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
