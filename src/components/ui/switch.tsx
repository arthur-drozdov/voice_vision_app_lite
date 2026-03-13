import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked, ...props }, ref) => {
  const isChecked = checked ?? props.defaultChecked ?? false;

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border/40 p-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      checked={checked}
      {...props}
      ref={ref}
      style={{
        backgroundColor: isChecked
          ? "hsl(var(--primary) / 0.80)"
          : "hsl(var(--input) / 0.35)",
        transition: "background-color 250ms ease",
      }}
    >
      {/* Thumb — real element, primary circle in OFF, dark in ON */}
      <span
        aria-hidden
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: "hsl(var(--primary))",
          boxShadow: isChecked ? "none" : "0 1px 3px rgba(0,0,0,0.3)",
          opacity: isChecked ? 0 : 1,
          transform: isChecked ? "translateX(20px)" : "translateX(0px)",
          transition: "transform 250ms ease, opacity 200ms ease",
          pointerEvents: "none",
        }}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
