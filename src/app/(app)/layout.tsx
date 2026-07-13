import AppNav from "@/components/nav/AppNav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppNav />
      {children}
    </div>
  );
}
