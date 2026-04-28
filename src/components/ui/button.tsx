import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-warm)] hover:bg-primary/90 hover:shadow-[var(--shadow-warm),0_0_0_3px_var(--color-primary)/20]",
        destructive:
          "rounded-full bg-destructive text-destructive-foreground shadow-[var(--shadow-warm)] hover:bg-destructive/90",
        outline:
          "rounded-full border border-input bg-background shadow-[var(--shadow-card)] hover:bg-accent-soft hover:text-accent hover:border-accent/30",
        secondary:
          "rounded-full bg-secondary text-secondary-foreground shadow-[var(--shadow-card)] hover:bg-secondary/80",
        ghost: "rounded-xl hover:bg-accent-soft hover:text-accent",
        link: "text-accent underline-offset-4 hover:underline",
        accent:
          "rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-warm)] hover:bg-accent/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        xl: "h-11 px-6",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
