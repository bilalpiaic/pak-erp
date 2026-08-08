import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell companyName="Gill Embroidery" ntn="1234567-8" strn="12-34-5678-001-56">
      {children}
    </AppShell>
  );
}
