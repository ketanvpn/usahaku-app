import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "standard" | "featured";
}

export function PageHero({
  eyebrow,
  title,
  description,
  badge,
  actions,
  variant = "standard",
  className,
  children,
  ...props
}: PageHeroProps) {
  if (variant === "featured") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-6 text-white shadow-2xl shadow-emerald-950/20",
          className
        )}
        {...props}
      >
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-200/14 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {badge && <div className="mb-3">{badge}</div>}
            {eyebrow && !badge && (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/90">
                {eyebrow}
              </p>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-emerald-50/80 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {children && <div className="relative mt-5">{children}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "page-hero flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">
            {eyebrow}
          </p>
        )}
        <h1 className="page-hero-title mt-1.5">{title}</h1>
        {description && (
          <p className="page-hero-description mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {children}
    </div>
  );
}
