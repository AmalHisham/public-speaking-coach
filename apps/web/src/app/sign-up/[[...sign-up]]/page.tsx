import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fef3c7,_transparent_28%),linear-gradient(180deg,_#fffaf0_0%,_#ffffff_60%,_#f5f5f4_100%)] px-6 py-12">
      <SignUp
        fallbackRedirectUrl="/app"
        forceRedirectUrl="/app"
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
      />
    </main>
  );
}
