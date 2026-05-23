import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Props {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  loading: boolean;
  overridden: boolean;
  isCurrentMonth: boolean;
  onEdit: (rate: number) => void;
}

export function MonthRateCell({
  baseCurrency,
  targetCurrency,
  rate,
  loading,
  overridden,
  isCurrentMonth,
  onEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  function startEdit() {
    setInput(rate.toFixed(4));
    setEditing(true);
  }

  function commit() {
    const v = parseFloat(input);
    if (!isNaN(v) && v > 0) onEdit(v);
    setEditing(false);
  }

  const badge = overridden ? (
    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/50 text-amber-600 dark:text-amber-400">
      custom
    </Badge>
  ) : isCurrentMonth ? (
    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-green-500/50 text-green-600 dark:text-green-400">
      live
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-blue-400/40 text-blue-500/80">
      avg
    </Badge>
  );

  return (
    <div className="flex flex-col items-end gap-0.5 font-normal">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>1 {baseCurrency} =</span>
        {loading ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : editing ? (
          <Input
            autoFocus
            className="h-5 w-20 text-[10px] px-1.5 py-0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-0.5 font-medium text-foreground hover:text-primary transition-colors"
            title="Click to edit rate for this month"
          >
            {rate.toFixed(4)} {targetCurrency}
            <Pencil className="w-2.5 h-2.5 opacity-40" />
          </button>
        )}
      </div>
      {!loading && !editing && <div className="flex items-center gap-1">{badge}</div>}
    </div>
  );
}
