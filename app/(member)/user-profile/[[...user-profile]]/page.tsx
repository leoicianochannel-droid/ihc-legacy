import { UserProfile } from "@clerk/nextjs";

export default function UserProfilePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-8">
      <UserProfile
        path="/user-profile"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-transparent shadow-none p-0",
            headerTitle: "font-display text-2xl",
            formButtonPrimary: "rounded-full h-11 bg-primary hover:bg-primary/90",
          },
        }}
      />
    </div>
  );
}
