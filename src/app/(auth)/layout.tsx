"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types";

// Auth layout — login / register pages.
// Redirects already-authenticated users away so they don't see the login form.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionChecked } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && sessionChecked && user) {
      const dest =
        user.role === UserRole.ADMIN || user.role === UserRole.STAFF ? "/admin" : "/dashboard";
      router.replace(dest);
    }
  }, [user, loading, sessionChecked, router]);

  // Render auth pages immediately. Redirect for authenticated users still
  // happens in the effect above once auth state settles.
  return <>{children}</>;
}
