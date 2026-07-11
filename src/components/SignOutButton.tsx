"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
    >
      Sign out
    </button>
  );
}
