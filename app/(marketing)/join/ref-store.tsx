"use client";

import { useEffect } from "react";

export function RefStore({ code }: { code: string }) {
  useEffect(() => {
    try {
      localStorage.setItem("ih_ref_code", code);
    } catch {}
  }, [code]);

  return null;
}
