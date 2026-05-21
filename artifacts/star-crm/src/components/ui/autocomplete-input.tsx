import * as React from "react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  lookupType: "customer" | "company" | "product";
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  lookupType,
  placeholder,
  className,
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const fetchSuggestions = React.useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/lookup?type=${lookupType}&q=${encodeURIComponent(q)}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const data: string[] = await res.json();
            setSuggestions(data);
            setOpen(data.length > 0);
          }
        } catch {
          setSuggestions([]);
        }
      }, 200);
    },
    [lookupType]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (v.length === 0) {
      fetchSuggestions("");
    } else {
      fetchSuggestions(v);
    }
  }

  function handleFocus() {
    fetchSuggestions(value);
  }

  function handleSelect(name: string) {
    onChange(name);
    setOpen(false);
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={() => setOpen(false)}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
              No matches — your entry will be saved as new.
            </CommandEmpty>
            {suggestions.map((name) => (
              <CommandItem
                key={name}
                value={name}
                onSelect={() => handleSelect(name)}
                className={cn(
                  "cursor-pointer",
                  name === value && "font-medium text-primary"
                )}
              >
                {name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
