"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function PostSearch({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <div className="relative mt-4">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        defaultValue={defaultValue}
        placeholder="Search posts..."
        onChange={(e) => {
          const q = e.target.value.trim();
          startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (q) params.set("q", q);
            else params.delete("q");
            router.replace(`/community?${params}`);
          });
        }}
        className="w-full rounded-full border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
