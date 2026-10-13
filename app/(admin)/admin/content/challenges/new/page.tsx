import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createChallenge } from "./actions";

export default function NewChallengePage() {
  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <h1 className="font-display text-3xl font-bold">New Challenge</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenge details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createChallenge} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title *</label>
              <Input name="title" required placeholder="21 Day Reset" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subtitle</label>
              <Input name="subtitle" placeholder="Short tagline shown on the card" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea
                name="description"
                rows={3}
                placeholder="What is this challenge about?"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Duration (days) *</label>
                <Input name="durationDays" type="number" required defaultValue="21" min="1" max="365" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Publish date</label>
                <Input name="startsAt" type="date" defaultValue="2026-08-10" />
                <p className="text-[11px] text-muted-foreground">
                  Hidden from members until this date. Leave blank to publish immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border p-3">
              <input type="hidden" name="isRolling" value="false" />
              <input
                id="isRolling"
                type="checkbox"
                name="isRolling"
                value="true"
                className="size-4 rounded"
              />
              <div>
                <label htmlFor="isRolling" className="text-sm font-medium cursor-pointer">
                  Rolling challenge
                </label>
                <p className="text-xs text-muted-foreground">
                  Each member starts on their own join date instead of a shared start date.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="gradient">Create challenge →</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
