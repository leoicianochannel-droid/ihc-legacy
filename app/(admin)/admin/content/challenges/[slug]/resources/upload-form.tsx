"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload } from "lucide-react";
import { uploadResource } from "./actions";

export function UploadResourceForm({ challengeSlug }: { challengeSlug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadResource(challengeSlug, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Title
        </label>
        <Input
          name="title"
          required
          placeholder="e.g. Week 1 cheat sheet"
          maxLength={200}
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Description (optional)
        </label>
        <Textarea
          name="description"
          rows={2}
          placeholder="What's in this download?"
          maxLength={1000}
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          File
        </label>
        <Input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, JPG, PNG, WEBP, or DOC. Max 25 MB.
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" variant="gradient" size="sm" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <Upload className="mr-1 size-4" /> Upload resource
          </>
        )}
      </Button>
    </form>
  );
}
