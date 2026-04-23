"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types";

// Auth layout — login / register pages.
// Redirects already-authenticated users away so they don't see the login form.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const dest =
        user.role === UserRole.ADMIN || user.role === UserRole.STAFF ? "/admin" : "/dashboard";
      router.replace(dest);
    }
  }, [user, loading, router]);

  // Show a minimal spinner while auth is resolving to prevent form flicker
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
