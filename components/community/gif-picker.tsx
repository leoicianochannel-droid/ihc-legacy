"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

type GiphyGif = {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string };
    fixed_height_small: { url: string };
  };
};

export function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  useEffect(() => {
    loadGifs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  async function loadGifs(q: string) {
    setLoading(true);
    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=24&rating=pg`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg`;
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifs(json.data ?? []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuery(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadGifs(q), 350);
  }

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border bg-background shadow-xl"
    >
      <div className="p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
          placeholder="Search GIFs…"
          autoFocus
          className="w-full rounded-xl border bg-muted px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="h-60 overflow-y-auto px-2 pb-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(gif.images.fixed_height.url);
                }}
                className="overflow-hidden rounded-lg transition-opacity hover:opacity-75"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.images.fixed_height_small.url}
                  alt={gif.title}
                  className="w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="border-t px-3 py-1 text-center">
        <span className="text-[10px] text-muted-foreground">Powered by GIPHY</span>
      </div>
    </div>
  );
}
