// src/components/nav/AppNav.tsx
import Link from "next/link";
import { ClientSwitcher } from "./ClientSwitcher";
import { SignOutButton } from "./SignOutButton";

export default function AppNav() {
  return (
    <nav className="bg-gray-100 p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">Content Creator</h1>
      <div className="flex items-center gap-4">
        <ClientSwitcher />
        <Link href="/compose/new" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Compose
        </Link>
        <SignOutButton />
      </div>
    </nav>
  );
}
