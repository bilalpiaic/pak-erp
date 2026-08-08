import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar companyName="Gill Embroidery" ntn="1234567-8" strn="12-34-5678-001-56" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
