"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
    >
      Sign Out
    </button>
  );
}
