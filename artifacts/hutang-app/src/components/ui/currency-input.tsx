import * as React from "react";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function toDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDigits(value: string) {
  if (!value) return "";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string | number | undefined | null;
  onValueChange: (rawDigits: string) => void;
  minValue?: number;
  maxValue?: number;
  prefix?: string;
  selectOnFocus?: boolean;
  /** Show yellow warning when value >= this threshold */
  warningThreshold?: number;
  /** Custom warning message (default: "Nominal cukup besar, pastikan sudah benar") */
  warningMessage?: string;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput({
  value,
  onValueChange,
  minValue,
  maxValue,
  prefix = "Rp",
  selectOnFocus = true,
  warningThreshold,
  warningMessage,
  ...props
}, ref) {
  const raw = typeof value === "number" ? String(value) : (value ?? "");
  const digits = toDigits(raw);
  const display = formatDigits(digits);
  const numericValue = digits ? Number(digits) : 0;

  // Warning state: yellow at threshold, red at 5x threshold
  const isWarning = typeof warningThreshold === "number" && numericValue >= warningThreshold;
  const isDanger = typeof warningThreshold === "number" && numericValue >= warningThreshold * 5;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newDigits = toDigits(e.target.value);
    if (typeof maxValue === "number" && newDigits && Number(newDigits) > maxValue) {
      newDigits = String(maxValue);
    }
    onValueChange(newDigits);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (selectOnFocus) {
      e.currentTarget.select();
    }
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const blurDigits = toDigits(raw);
    if (!blurDigits) {
      props.onBlur?.(e);
      return;
    }
    let numberValue = Number(blurDigits);
    if (Number.isNaN(numberValue)) {
      props.onBlur?.(e);
      return;
    }
    if (typeof minValue === "number") numberValue = Math.max(minValue, numberValue);
    if (typeof maxValue === "number") numberValue = Math.min(maxValue, numberValue);
    onValueChange(String(Math.trunc(numberValue)));
    props.onBlur?.(e);
  };

  return (
    <div className="relative w-full">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "font-semibold tabular-nums",
          prefix && "pl-11",
          isWarning && !isDanger && "border-yellow-400 ring-1 ring-yellow-400/30 focus-visible:ring-yellow-400/50",
          isDanger && "border-red-400 ring-1 ring-red-400/30 focus-visible:ring-red-400/50",
          props.className,
        )}
      />
      {isWarning && (
        <div className={cn(
          "mt-1.5 flex items-start gap-1.5 text-xs",
          isDanger ? "text-red-600" : "text-yellow-600",
        )}>
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {warningMessage ?? (isDanger
              ? "Nominal sangat besar! Periksa kembali sebelum menyimpan."
              : "Nominal cukup besar, pastikan sudah benar."
            )}
          </span>
        </div>
      )}
    </div>
  );
});
