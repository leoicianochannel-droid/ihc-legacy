import { NewWorkoutForm } from "./new-workout-form";

export default function NewWorkoutPage() {
  return (
    <div className="container max-w-2xl py-8">
      <h1 className="font-display text-3xl font-bold">New workout</h1>
      <p className="text-sm text-muted-foreground">
        Upload a video, set the metadata, hit publish. Members get access instantly.
      </p>
      <NewWorkoutForm />
    </div>
  );
}
