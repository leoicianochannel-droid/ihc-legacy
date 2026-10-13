import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex justify-center">
      <SignIn
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
