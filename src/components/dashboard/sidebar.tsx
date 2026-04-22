"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types";
import { APP_NAME } from "@/config/constants";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/admin",               label: "Overview",    icon: "◈",  roles: [UserRole.ADMIN, UserRole.STAFF] },
  { href: "/admin/shipments",     label: "Shipments",   icon: "📦", roles: [UserRole.ADMIN, UserRole.STAFF] },
  { href: "/admin/fleet",         label: "Fleet",       icon: "🚚", roles: [UserRole.ADMIN, UserRole.STAFF] },
  { href: "/admin/analytics",     label: "Analytics",   icon: "📊", roles: [UserRole.ADMIN, UserRole.STAFF] },
  { href: "/admin/users",         label: "Users",       icon: "👥", roles: [UserRole.ADMIN] },
  { href: "/admin/audit-logs",    label: "Audit Logs",  icon: "🔎", roles: [UserRole.ADMIN] },
  { href: "/dashboard",           label: "My Shipments", icon: "📋", roles: [UserRole.CUSTOMER] },
  { href: "/track",               label: "Track",       icon: "🔍" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleNav = NAV.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xs text-white">
            L
          </div>
          <span className="font-semibold text-white">{APP_NAME}</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${active
                  ? "bg-blue-600/20 text-blue-300 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      {user && (
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user.firstName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
          >
            Sign out →
          </button>
        </div>
      )}
    </aside>
  );
}
