import { notFound } from "next/navigation";
import Link from "next/link";
import { db, challenges } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, FileText, Image as ImageIcon, FileType2 } from "lucide-react";
import { listResources, deleteResource } from "./actions";
import { UploadResourceForm } from "./upload-form";

export const dynamic = "force-dynamic";

const ICON: Record<string, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  doc: FileType2,
};

export default async function AdminChallengeResourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1);
  if (!challenge) notFound();

  const resources = await listResources(challenge.id);

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/content">
          <ChevronLeft /> Back to content
        </Link>
      </Button>

      <div>
        <h1 className="font-display text-3xl font-bold">Cheat sheets & downloads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For: <span className="font-semibold">{challenge.title}</span> ({challenge.durationDays}-day)
        </p>
      </div>

      <UploadResourceForm challengeSlug={slug} />

      <section>
        <h2 className="mb-2 font-display text-xl font-bold">
          Existing resources ({resources.length})
        </h2>
        {resources.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No downloads yet. Upload one above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => {
              const Icon = ICON[r.fileType] ?? FileText;
              return (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.title}</div>
                      {r.description && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {r.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {r.fileName} · {(r.fileSize / 1024).toFixed(0)} KB · {r.fileType.toUpperCase()}
                      </div>
                    </div>
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Open
                    </a>
                    <form action={deleteResource.bind(null, r.id, slug)}>
                      <Button type="submit" variant="outline" size="sm">
                        Delete
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
