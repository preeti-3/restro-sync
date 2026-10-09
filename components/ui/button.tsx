import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold shadow-sm transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-primary text-primary-foreground hover:bg-orange-700", secondary: "bg-secondary text-secondary-foreground hover:bg-emerald-100", outline: "border-orange-200 bg-white hover:border-orange-300 hover:bg-orange-50", ghost: "shadow-none hover:bg-orange-50", destructive: "bg-destructive text-white hover:bg-destructive/90" }, size: { default: "h-11", sm: "h-9 min-h-9 px-3", lg: "h-12 px-6", icon: "h-11 w-11 p-0" } }, defaultVariants: { variant: "default", size: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => { const Comp = asChild ? Slot : "button"; return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />; });
Button.displayName = "Button";
export { buttonVariants };
