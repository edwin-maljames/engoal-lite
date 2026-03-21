"use client";
import React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, TrendingUp, CalendarCheck, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/monthly-entry", label: "Entry", icon: CalendarCheck },
  { href: "/allocation", label: "Allocation", icon: PieChart },
];

export function MobileNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:hidden">
      <ul className="flex">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium",
                  isActive ? "text-indigo-600" : "text-gray-500",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
