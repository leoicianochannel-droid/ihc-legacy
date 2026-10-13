import Link from "next/link";
import { db, giftMilestones } from "@/lib/db";
import { asc, sql } from "drizzle-orm";
import { Gift, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GiftsAdminClient } from "./gifts-admin-client";
import type { GiftMilestoneRow } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

async function getRowsSafe(): Promise<GiftMilestoneRow[]> {
  try {
    return await db.select().from(giftMilestones).orderBy(asc(giftMilestones.dayThreshold));
  } catch {
    // Table might not exist yet — run the migration silently
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gift_milestones (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          key text NOT NULL,
          day_threshold integer NOT NULL,
          label text NOT NULL,
          full_label text NOT NULL,
          description text NOT NULL,
          emoji text NOT NULL DEFAULT '🎁',
          retail_value text NOT NULL DEFAULT '',
          requires_shipping boolean NOT NULL DEFAULT false,
          image_url text,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS gift_milestones_key_idx ON gift_milestones (key);
      `);
      return await db.select().from(giftMilestones).orderBy(asc(giftMilestones.dayThreshold));
    } catch {
      return [];
    }
  }
}

export default async function AdminGiftsPage() {
  const rows = await getRowsSafe();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Gift className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Gift Milestones</h1>
            <p className="text-sm text-muted-foreground">
              Manage the free gifts members earn for staying consistent.
            </p>
          </div>
        </div>
        <Link href="/admin/gifts/progress">
          <Button variant="outline" size="sm" className="shrink-0">
            <BarChart2 className="mr-1.5 size-3.5" /> Gift Progress
          </Button>
        </Link>
      </div>

      <GiftsAdminClient rows={rows} />
    </div>
  );
}
