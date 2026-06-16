"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Clock,
  LayoutDashboard,
  Network,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/",          label: "Dashboard", icon: LayoutDashboard },
  { href: "/onramp",   label: "Onramp",    icon: ArrowDownToLine },
  { href: "/swap",     label: "Swap",      icon: ArrowLeftRight },
  { href: "/bridge",   label: "Bridge",    icon: Network },
  { href: "/workflow", label: "Workflow",  icon: Zap },
  { href: "/history",  label: "History",   icon: Clock },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-60 flex-col border-r border-gray-800 bg-gray-950 px-3 py-6">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
