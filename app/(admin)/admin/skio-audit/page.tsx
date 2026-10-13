"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuditResult {
  skioActiveCount: number;
  platformTotalUsers: number;
  onPlatform: number;
  notOnPlatform: number;
  missingEmails: string[];
}

export default function SkioAuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n");
      const header = lines[0].split(",");
      const statusIdx = header.indexOf("status");
      const productIdx = header.indexOf("subscriptionLineProductVariantProductTitle");
      const emailIdx = header.indexOf("storefrontUserEmail");

      if (statusIdx === -1 || emailIdx === -1 || productIdx === -1) {
        throw new Error("CSV missing expected columns. Make sure this is a Skio subscription export.");
      }

      const communityProducts = ["Premium Community", "Community & Workouts", "VIP Community"];
      const emails = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV parse — handle quoted fields
        const cols = parseCSVLine(lines[i]);
        if (!cols[statusIdx]) continue;
        const status = cols[statusIdx].replace(/"/g, "").trim();
        const product = cols[productIdx]?.replace(/"/g, "").trim() ?? "";
        const email = cols[emailIdx]?.replace(/"/g, "").trim().toLowerCase() ?? "";

        if (status === "ACTIVE" && communityProducts.some((p) => product.includes(p)) && email) {
          emails.add(email);
        }
      }

      const emailList = [...emails];

      // Send to API in batches of 5000
      let combined: AuditResult | null = null;
      const BATCH = 5000;
      for (let i = 0; i < emailList.length; i += BATCH) {
        const batch = emailList.slice(i, i + BATCH);
        const res = await fetch("/api/admin/skio-crossref", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: batch }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data: AuditResult = await res.json();
        if (!combined) {
          combined = data;
        } else {
          combined.onPlatform += data.onPlatform;
          combined.notOnPlatform += data.notOnPlatform;
          combined.missingEmails.push(...data.missingEmails);
        }
      }

      if (combined) {
        combined.skioActiveCount = emailList.length;
        setResult(combined);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <h1 className="font-display text-3xl font-bold">Skio ↔ Platform Audit</h1>
      <p className="text-muted-foreground text-sm">
        Upload your Skio subscription export CSV to see who has an active subscription but hasn&apos;t joined the platform.
      </p>

      <Card>
        <CardContent className="p-6">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center hover:border-primary/50 transition-colors">
            <span className="text-4xl">📁</span>
            <span className="font-semibold">Click to upload Skio CSV export</span>
            <span className="text-xs text-muted-foreground">subscription-export-*.csv</span>
            <input type="file" accept=".csv" className="sr-only" onChange={handleFile} disabled={loading} />
          </label>
          {loading && <p className="mt-4 text-center text-sm text-muted-foreground animate-pulse">Processing… this may take a moment</p>}
          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Skio active subscribers" value={result.skioActiveCount.toLocaleString()} />
            <StatCard label="Platform total users" value={result.platformTotalUsers.toLocaleString()} />
            <StatCard label="Skio → on platform" value={result.onPlatform.toLocaleString()} color="green" />
            <StatCard label="Skio → NOT on platform" value={result.notOnPlatform.toLocaleString()} color="red" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {result.notOnPlatform.toLocaleString()} active subscribers haven&apos;t joined yet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                These people have an active Skio community subscription but have never signed up on ihcommunity.com.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([result.missingEmails.join("\n")], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "skio-not-on-platform.txt";
                  a.click();
                }}
              >
                Download email list (.txt)
              </Button>
              <div className="mt-3 max-h-64 overflow-y-auto rounded border bg-muted/30 p-3 font-mono text-xs">
                {(showAll ? result.missingEmails : result.missingEmails.slice(0, 100)).map((e) => (
                  <div key={e}>{e}</div>
                ))}
                {!showAll && result.missingEmails.length > 100 && (
                  <button
                    className="mt-2 text-primary underline"
                    onClick={() => setShowAll(true)}
                  >
                    Show all {result.missingEmails.length.toLocaleString()} emails…
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold ${color === "green" ? "text-green-600 dark:text-green-400" : color === "red" ? "text-red-600 dark:text-red-400" : ""}`}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}
