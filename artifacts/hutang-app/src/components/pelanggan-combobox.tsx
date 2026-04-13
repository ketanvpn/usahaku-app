import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Pelanggan } from "@workspace/api-client-react";

interface PelangganComboboxProps {
  value: number | null | undefined;
  onValueChange: (id: number | null) => void;
  pelangganList?: Pelanggan[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PelangganCombobox({
  value,
  onValueChange,
  pelangganList = [],
  placeholder = "Pilih pelanggan...",
  disabled = false,
  className,
}: PelangganComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = pelangganList.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selected ? selected.nama : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={8}
      >
        <Command>
          <CommandInput placeholder="Ketik nama pelanggan..." />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              Pelanggan tidak ditemukan.
            </CommandEmpty>
            <CommandGroup>
              {pelangganList.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.nama}
                  onSelect={() => {
                    onValueChange(p.id === value ? null : p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {p.nama}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
