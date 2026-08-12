import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/request";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
