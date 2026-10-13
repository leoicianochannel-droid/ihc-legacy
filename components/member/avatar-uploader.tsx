"use client";

import { useState, useRef, useTransition } from "react";
import { upload as blobUpload } from "@vercel/blob/client";
import { Camera, Loader2 } from "lucide-react";
import { updateAvatar } from "@/app/(member)/settings/actions";

interface Props {
  currentUrl?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  onUploaded?: (url: string) => void;
}

const SIZE = { sm: "size-16", md: "size-24", lg: "size-32" } as const;
const TEXT = { sm: "text-xl", md: "text-3xl", lg: "text-4xl" } as const;
const ICON = { sm: "size-4", md: "size-5", lg: "size-6" } as const;

export function AvatarUploader({ currentUrl, name, size = "md", onUploaded }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    ? name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  async function handleFile(file: File) {
    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const blob = await blobUpload(`avatars/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload-photo-token",
      });
      startTransition(async () => {
        await updateAvatar(blob.url);
        onUploaded?.(blob.url);
      });
    } catch (e) {
      console.error("avatar upload failed", e);
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || isPending;

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      className={`group relative ${SIZE[size]} shrink-0 overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
    >
      {/* Avatar or initials */}
      {preview ? (
        <img src={preview} alt={name ?? "avatar"} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-primary/20 font-bold text-primary">
          <span className={TEXT[size]}>{initials}</span>
        </div>
      )}

      {/* Hover / uploading overlay */}
      <div className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/50 transition-opacity ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        {busy
          ? <Loader2 className={`${ICON[size]} animate-spin text-white`} />
          : <Camera className={`${ICON[size]} text-white`} />
        }
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
