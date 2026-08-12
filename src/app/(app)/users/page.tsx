import { redirect } from "next/navigation";

import { UsersView } from "@/components/users/UsersView";
import { PageShell } from "@/components/ui/PageShell";
import { getSession } from "@/lib/auth/request";
import { listUsers } from "@/lib/users/service";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  let users: Awaited<ReturnType<typeof listUsers>>["users"] = [];
  let loadError: string | null = null;

  try {
    users = (await listUsers()).users;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Users"
      description="Create and manage login credentials (username and password) for ERP access."
    >
      <UsersView
        initialUsers={users}
        loadError={loadError}
        currentUserId={session.userId}
      />
    </PageShell>
  );
}
