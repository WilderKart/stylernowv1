import { requireSuperSU } from "@/lib/auth/require-supersu";
import { AdminNav } from "./admin-nav";

export const metadata = { title: "SuperSU" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperSU();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AdminNav />
      {children}
    </div>
  );
}
