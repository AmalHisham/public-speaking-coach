"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type BackendSession = {
  session_id: string;
  status: "authenticated";
  user_id: string;
};

type SessionState =
  | { message: string; status: "error" | "loading" }
  | { data: BackendSession; status: "ready" };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function BackendSessionStatus() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>({
    message: "Waiting for Clerk to finish loading.",
    status: "loading",
  });
  const canValidateSession = isLoaded && isSignedIn;

  useEffect(() => {
    if (!canValidateSession) {
      return;
    }

    let isCancelled = false;

    const validateSession = async () => {
      setSessionState({
        message: "Validating the Clerk session with FastAPI.",
        status: "loading",
      });

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Clerk did not return a session token.");
        }

        const response = await fetch(`${apiBaseUrl}/auth/session`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("FastAPI rejected the session token.");
        }

        const data = (await response.json()) as BackendSession;

        if (!isCancelled) {
          setSessionState({
            data,
            status: "ready",
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setSessionState({
            message:
              error instanceof Error
                ? error.message
                : "Unexpected backend validation failure.",
            status: "error",
          });
        }
      }
    };

    void validateSession();

    return () => {
      isCancelled = true;
    };
  }, [canValidateSession, getToken]);

  if (!isLoaded) {
    return (
      <article className="rounded-[2rem] border border-stone-200 bg-stone-950 p-8 text-stone-50 shadow-xl shadow-stone-950/20">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-amber-300">
          Backend Validation
        </p>
        <p className="mt-6 text-sm leading-7 text-stone-300">
          Waiting for Clerk to finish loading.
        </p>
      </article>
    );
  }

  if (!isSignedIn) {
    return (
      <article className="rounded-[2rem] border border-stone-200 bg-stone-950 p-8 text-stone-50 shadow-xl shadow-stone-950/20">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-amber-300">
          Backend Validation
        </p>
        <p className="mt-6 text-sm leading-7 text-rose-200">
          You must be signed in to validate a backend session.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-stone-950 p-8 text-stone-50 shadow-xl shadow-stone-950/20">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-amber-300">
        Backend Validation
      </p>

      {sessionState.status === "ready" ? (
        <p className="mt-6 text-sm leading-7 text-emerald-300">
          FastAPI accepted the Clerk bearer session token and confirmed the
          authenticated session.
        </p>
      ) : (
        <p
          className={`mt-6 text-sm leading-7 ${
            sessionState.status === "error"
              ? "text-rose-200"
              : "text-stone-300"
          }`}
        >
          {sessionState.message}
        </p>
      )}
    </article>
  );
}
