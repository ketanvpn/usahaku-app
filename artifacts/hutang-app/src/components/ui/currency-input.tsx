import * as React from "react";
import { Input } from "@/components/ui/input";

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
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput({
  value,
  onValueChange,
  minValue,
  maxValue,
  prefix = "Rp",
  selectOnFocus = true,
  ...props
}, ref) {
  const raw = typeof value === "number" ? String(value) : (value ?? "");
  const display = formatDigits(toDigits(raw));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = toDigits(e.target.value);
    onValueChange(digits);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (selectOnFocus) {
      e.currentTarget.select();
    }
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const digits = toDigits(raw);
    if (!digits) {
      props.onBlur?.(e);
      return;
    }
    let numberValue = Number(digits);
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
        className={prefix ? `pl-11 font-semibold tabular-nums ${props.className ?? ""}`.trim() : `font-semibold tabular-nums ${props.className ?? ""}`.trim()}
      />
    </div>
  );
});
