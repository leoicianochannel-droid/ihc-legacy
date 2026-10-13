import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        accent: "border-transparent bg-accent text-accent-foreground",
        outline: "text-foreground border-foreground/15",
        gold: "border-transparent text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  const goldStyle =
    variant === "gold"
      ? { background: "linear-gradient(135deg, hsl(40 90% 60%), hsl(25 85% 55%))" }
      : undefined;
  return <div className={cn(badgeVariants({ variant }), className)} style={goldStyle} {...props} />;
}

export { badgeVariants };
