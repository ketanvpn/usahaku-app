import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";

const QUICK_ADD_AMOUNTS = [50_000, 100_000, 250_000, 500_000, 1_000_000] as const;

interface CurrencyQuickAddProps {
  onAdd: (nominal: number) => void;
  isDisabled?: (nominal: number) => boolean;
  className?: string;
}

export function CurrencyQuickAdd({ onAdd, isDisabled, className }: CurrencyQuickAddProps) {
  return (
    <div className={className ?? "flex flex-wrap gap-1 pt-1"}>
      {QUICK_ADD_AMOUNTS.map((nominal) => (
        <Button
          key={nominal}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onAdd(nominal)}
          disabled={isDisabled?.(nominal)}
        >
          +{formatRupiah(nominal)}
        </Button>
      ))}
    </div>
  );
}
