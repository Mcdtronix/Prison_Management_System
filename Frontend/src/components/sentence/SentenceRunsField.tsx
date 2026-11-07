import { GitMerge, ArrowRightLeft } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ConcurrentOption {
  /** "new:<index>" or "existing:<offence id>" in registration; offence id on Record Court Outcome. */
  value: string;
  label: string;
  /** Sentence summary, e.g. "3 yrs". */
  detail?: string;
  group?: string;
}

const CONSECUTIVE = "__consecutive";

interface SentenceRunsFieldProps {
  value?: string | null;
  onChange: (value: string) => void;
  options: ConcurrentOption[];
  id?: string;
}

/**
 * "Sentence runs" choice for a convicted count, identical on offence registration
 * and Record Court Outcome. Empty value = consecutive.
 */
export const SentenceRunsField = ({ value, onChange, options, id = "sentence-runs" }: SentenceRunsFieldProps) => {
  const current = value && options.some((o) => o.value === value) ? value : CONSECUTIVE;
  const groups = [...new Set(options.map((o) => o.group || "Other counts"))];

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
      <Label htmlFor={id} className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-slate-500" aria-hidden="true" />
        Sentence runs
      </Label>
      <Select value={current} onValueChange={(v) => onChange(v === CONSECUTIVE ? "" : v)}>
        <SelectTrigger id={id} className="bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CONSECUTIVE}>Consecutively — served after the other sentences</SelectItem>
          {groups.map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>Concurrently with ({group})</SelectLabel>
              {options
                .filter((o) => (o.group || "Other counts") === group)
                .map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                    {o.detail ? <span className="ml-2 text-slate-500">· {o.detail}</span> : null}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <GitMerge className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {current === CONSECUTIVE
          ? "This sentence starts after the other sentences end."
          : "Served at the same time as the selected count; only the longer sentence counts toward release."}
        {options.length === 0 && " No other convicted count to run alongside yet."}
      </p>
    </div>
  );
};

export default SentenceRunsField;
