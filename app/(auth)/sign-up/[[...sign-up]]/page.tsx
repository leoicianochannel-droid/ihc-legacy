import { SignUp } from "@clerk/nextjs";
import { RefCapture } from "./ref-capture";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const ref = params.ref?.trim().toUpperCase() || null;

  return (
    <div className="flex justify-center">
      {ref && <RefCapture code={ref} />}
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-transparent shadow-none",
            headerTitle: "font-display text-3xl font-bold",
            headerSubtitle: "text-sm",
            formButtonPrimary: "rounded-full h-11 bg-primary hover:bg-primary/90",
            footerAction: "text-sm",
          },
        }}
      />
    </div>
  );
}
