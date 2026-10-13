"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, X } from "lucide-react";
import { ClaimForm } from "./claim-form";
import type { GiftMilestone } from "@/lib/gifts";

export function GiftClaimButton({ milestone }: { milestone: GiftMilestone }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="gradient"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Gift className="size-4" /> Claim my {milestone.label}
      </Button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4 md:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Claim your gift</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <ClaimForm milestone={milestone} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
