"use client";

import { usePathname, useRouter } from "next/navigation";

const ITEMS = [
  { value: "/admin", label: "Overview" },
  { value: "/admin/analytics", label: "Analytics" },
  { value: "/admin/members", label: "Members" },
  { value: "/admin/content", label: "Content" },
  { value: "/admin/beta", label: "Beta" },
  { value: "/admin/invites", label: "Invites" },
  { value: "/admin/migrate", label: "Migrate" },
  { value: "/admin/gifts", label: "Gifts" },
  { value: "/admin/challenges/analytics", label: "Challenge Stats" },
  { value: "/admin/challenges/submissions", label: "Challenge Entries" },
  { value: "/admin/challenges/rewards", label: "Challenge Rewards" },
  { value: "/admin/welcome-video", label: "Welcome Tour" },
  { value: "/admin/webhooks", label: "Integrations" },
  { value: "/dashboard", label: "← Member view" },
];

/**
 * Compact dropdown navigation for the admin header on mobile.
 * Hidden on md+ where the inline link list takes over.
 */
export function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Pick the deepest matching item so e.g. /admin/members/123 still highlights "Members".
  const current =
    [...ITEMS]
      .sort((a, b) => b.value.length - a.value.length)
      .find((i) => pathname === i.value || pathname.startsWith(i.value + "/"))?.value ??
    "/admin";

  return (
    <select
      className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold md:hidden"
      value={current}
      onChange={(e) => router.push(e.currentTarget.value)}
    >
      {ITEMS.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  );
}
