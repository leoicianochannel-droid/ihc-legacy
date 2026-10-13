/**
 * Generates a personalized completion certificate PDF for a challenge member.
 * Authorization: caller must own the membership.
 *
 * GET /api/certificate/[memberId] → application/pdf
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, challengeMembers, challenges } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }

  const [mem] = await db
    .select()
    .from(challengeMembers)
    .where(eq(challengeMembers.id, memberId))
    .limit(1);
  if (!mem || mem.userId !== me.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, mem.challengeId))
    .limit(1);
  if (!challenge) {
    return NextResponse.json({ error: "challenge_not_found" }, { status: 404 });
  }

  const fullName = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || "Hooper";
  const completedDate = mem.completedAt ?? new Date();
  const dateStr = completedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pdf = await PDFDocument.create();
  // Landscape letter for the certificate feel
  const page = pdf.addPage([792, 612]);
  const { width, height } = page.getSize();

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvBoldOb = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

  const PRIMARY = rgb(0.820, 0.012, 0.322);   // #d10352
  const PRIMARY_SOFT = rgb(0.988, 0.867, 0.910); // #FCDCe8
  const INK = rgb(0.04, 0.04, 0.04);
  const MUTED = rgb(0.42, 0.45, 0.5);
  const GOLD = rgb(0.83, 0.64, 0.30);

  // Pink top + bottom bands
  page.drawRectangle({
    x: 0,
    y: height - 60,
    width,
    height: 60,
    color: PRIMARY,
  });
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 30,
    color: PRIMARY,
  });

  // Decorative inner border
  const inset = 40;
  page.drawRectangle({
    x: inset,
    y: inset + 10,
    width: width - 2 * inset,
    height: height - 2 * inset - 50,
    borderColor: PRIMARY,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: inset + 8,
    y: inset + 18,
    width: width - 2 * inset - 16,
    height: height - 2 * inset - 66,
    borderColor: PRIMARY_SOFT,
    borderWidth: 1,
  });

  // Top wordmark
  page.drawText("INFINITY HOOP", {
    x: inset + 20,
    y: height - 42,
    size: 18,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Community", {
    x: inset + 195,
    y: height - 42,
    size: 14,
    font: helv,
    color: rgb(1, 1, 1),
  });

  // Center stack
  const cx = width / 2;

  // Eyebrow
  page.drawText("CERTIFICATE OF COMPLETION", {
    x: cx - helvBold.widthOfTextAtSize("CERTIFICATE OF COMPLETION", 14) / 2,
    y: height - 130,
    size: 14,
    font: helvBold,
    color: PRIMARY,
  });

  // Underline accent
  page.drawLine({
    start: { x: cx - 70, y: height - 142 },
    end: { x: cx + 70, y: height - 142 },
    color: PRIMARY,
    thickness: 1.4,
  });

  // "This celebrates"
  page.drawText("This celebrates", {
    x: cx - helv.widthOfTextAtSize("This celebrates", 13) / 2,
    y: height - 180,
    size: 13,
    font: helv,
    color: MUTED,
  });

  // Member name — large display
  const nameSize = 44;
  const nameWidth = helvBoldOb.widthOfTextAtSize(fullName, nameSize);
  page.drawText(fullName, {
    x: cx - nameWidth / 2,
    y: height - 232,
    size: nameSize,
    font: helvBoldOb,
    color: INK,
  });

  // Decorative flourish under name
  page.drawLine({
    start: { x: cx - 130, y: height - 248 },
    end: { x: cx + 130, y: height - 248 },
    color: GOLD,
    thickness: 1.5,
  });

  // "for completing"
  const line2 = "for completing";
  page.drawText(line2, {
    x: cx - helv.widthOfTextAtSize(line2, 13) / 2,
    y: height - 280,
    size: 13,
    font: helv,
    color: MUTED,
  });

  // Challenge title
  const titleSize = 22;
  const titleW = helvBold.widthOfTextAtSize(challenge.title, titleSize);
  page.drawText(challenge.title, {
    x: cx - titleW / 2,
    y: height - 315,
    size: titleSize,
    font: helvBold,
    color: PRIMARY,
  });

  // Body — durationDays + the why-it-matters line
  const bodyMsg = `${challenge.durationDays} days. ${challenge.durationDays} chances to choose herself. She showed up.`;
  const bodyW = helv.widthOfTextAtSize(bodyMsg, 12);
  page.drawText(bodyMsg, {
    x: cx - bodyW / 2,
    y: height - 350,
    size: 12,
    font: helv,
    color: INK,
  });

  // Bottom row — date and signature line
  const yBase = inset + 68;
  // Left: completed-on
  page.drawText("COMPLETED ON", {
    x: inset + 60,
    y: yBase + 14,
    size: 9,
    font: helvBold,
    color: MUTED,
  });
  page.drawText(dateStr, {
    x: inset + 60,
    y: yBase - 4,
    size: 13,
    font: helvBold,
    color: INK,
  });
  page.drawLine({
    start: { x: inset + 60, y: yBase - 8 },
    end: { x: inset + 240, y: yBase - 8 },
    color: PRIMARY_SOFT,
    thickness: 1,
  });

  // Right: signed by
  const sigX = width - inset - 240;
  page.drawText("INFINITY HOOP", {
    x: sigX,
    y: yBase - 4,
    size: 13,
    font: helvBoldOb,
    color: INK,
  });
  page.drawLine({
    start: { x: sigX, y: yBase - 8 },
    end: { x: sigX + 180, y: yBase - 8 },
    color: PRIMARY_SOFT,
    thickness: 1,
  });
  page.drawText("FOUNDER & COMMUNITY", {
    x: sigX,
    y: yBase - 22,
    size: 9,
    font: helvBold,
    color: MUTED,
  });

  // Bottom band motto
  page.drawText("small, repeated, on purpose. that's how you change a body.", {
    x: 40,
    y: 11,
    size: 9,
    font: helvBoldOb,
    color: rgb(1, 1, 1),
  });

  const bytes = await pdf.save();
  // Convert to a regular Uint8Array to avoid SharedArrayBuffer typing issues with the response API
  const body = new Uint8Array(bytes);
  const filenameSafe = fullName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `${filenameSafe}-${challenge.slug}-certificate.pdf`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
