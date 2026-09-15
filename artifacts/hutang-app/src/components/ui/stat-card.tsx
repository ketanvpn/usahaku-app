import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function extractTextFromNode(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractTextFromNode(props.children);
  }
  return "";
}

export function getAdaptiveFontSize(text: string): string {
  const len = text.trim().length;
  if (len >= 20) return "text-sm sm:text-base";
  if (len >= 16) return "text-base sm:text-lg";
  if (len >= 13) return "text-lg sm:text-xl";
  return "text-xl sm:text-2xl";
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "info";
  trend?: {
    value: string | number;
    label?: string;
    isUp?: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  trend,
  className,
  ...props
}: StatCardProps) {
  const borderVariants = {
    default: "border-l-primary",
    success: "border-l-emerald-600 dark:border-l-emerald-500",
    danger: "border-l-rose-600 dark:border-l-rose-500",
    warning: "border-l-amber-500 dark:border-l-amber-400",
    info: "border-l-blue-600 dark:border-l-blue-500",
  };

  const iconBgVariants = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  const rawText = React.useMemo(() => extractTextFromNode(value), [value]);
  const fontSizeClass = React.useMemo(() => getAdaptiveFontSize(rawText), [rawText]);

  return (
    <Card
      className={cn(
        "premium-card relative overflow-hidden border-l-4 transition-all duration-200 hover:shadow-md",
        borderVariants[variant],
        className
      )}
      {...props}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title={title}>
              {title}
            </p>
            <div
              className={cn(
                "font-bold tracking-tight text-foreground tabular-nums break-words leading-tight",
                fontSizeClass
              )}
              title={rawText || undefined}
            >
              {value}
            </div>
          </div>
          {icon && (
            <div
              className={cn(
                "flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl transition-transform",
                iconBgVariants[variant]
              )}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
        </div>
        {(subtitle || trend) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            {trend && (
              <span
                className={cn(
                  "font-medium shrink-0",
                  trend.isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.isUp ? "↑" : "↓"} {trend.value}
              </span>
            )}
            {subtitle && (
              <span className="truncate min-w-0" title={typeof subtitle === "string" ? subtitle : undefined}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
