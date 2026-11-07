import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, FileText, Gavel, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inmateApi } from "@/lib/api";
import { formatSentence } from "@/lib/sentence";
import { cn } from "@/lib/utils";

type Outcome = "ENDORSED" | "REDUCED" | "INCREASED";

const OUTCOMES: { value: Outcome; title: string; detail: string; icon: typeof CheckCircle2 }[] = [
  {
    value: "ENDORSED",
    title: "Endorsed",
    detail: "The court confirms the sentence as passed. Nothing changes.",
    icon: CheckCircle2,
  },
  {
    value: "REDUCED",
    title: "Reduced",
    detail: "Schedules a court session where the shorter sentence is passed.",
    icon: ArrowDown,
  },
  {
    value: "INCREASED",
    title: "Increased",
    detail: "Schedules a court session where the longer sentence is passed.",
    icon: ArrowUp,
  },
];

const today = () => new Date().toISOString().slice(0, 10);

export interface ConfirmableOffence {
  id: string | number;
  offence_description: string;
  sentence_years?: number;
  sentence_months?: number;
  sentence_days?: number;
  sentence_date?: string;
}

interface SentenceConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offence: ConfirmableOffence | null;
  /** Called after the confirmation is saved, with a message for the officer. */
  onRecorded: (message: string) => void;
}

/** Records the court's confirmation of sentence for one convicted count. */
export const SentenceConfirmationDialog = ({ open, onOpenChange, offence, onRecorded }: SentenceConfirmationDialogProps) => {
  const [outcome, setOutcome] = useState<Outcome>("ENDORSED");
  const [confirmationDate, setConfirmationDate] = useState(today());
  const [courtDate, setCourtDate] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setOutcome("ENDORSED");
      setConfirmationDate(today());
      setCourtDate("");
      setDocument(null);
      setRemarks("");
      setError(null);
    }
  }, [open]);

  const revising = outcome !== "ENDORSED";

  const submit = async () => {
    if (!offence) return;
    if (!document) return setError("Upload the confirmation of sentence document received from the court.");
    if (!confirmationDate) return setError("Enter the date of the confirmation.");
    if (revising && !courtDate) return setError("Set the court date for the revised sentence to be passed.");
    if (revising && courtDate < confirmationDate) return setError("The court date cannot be before the confirmation date.");

    const form = new FormData();
    form.append("outcome", outcome);
    form.append("confirmation_date", confirmationDate);
    form.append("document", document);
    if (revising) form.append("court_date", courtDate);
    if (remarks.trim()) form.append("remarks", remarks.trim());

    setSaving(true);
    setError(null);
    const result = await inmateApi.confirmSentence(offence.id, form);
    setSaving(false);
    if (result.error) return setError(result.error);

    onRecorded(
      revising
        ? `Confirmation recorded. Court session scheduled for ${new Date(courtDate).toLocaleDateString()}; the revised sentence applies once its outcome is recorded.`
        : "Confirmation recorded: sentence endorsed.",
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-[#0b4f2a]" aria-hidden="true" />
            Record Confirmation of Sentence
          </DialogTitle>
          <DialogDescription>
            {offence ? (
              <>
                {offence.offence_description}: sentence on record{" "}
                <span className="font-medium text-slate-700">
                  {formatSentence(offence.sentence_years, offence.sentence_months, offence.sentence_days)}
                </span>
                {offence.sentence_date && ` from ${new Date(offence.sentence_date).toLocaleDateString()}`}.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Court's decision</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
              {OUTCOMES.map(({ value, title, detail, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={outcome === value}
                  onClick={() => setOutcome(value)}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    outcome === value
                      ? "border-[#0b4f2a] bg-[#0b4f2a]/5 ring-1 ring-[#0b4f2a]"
                      : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {title}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="confirmation-date">Confirmation date *</Label>
              <Input
                id="confirmation-date"
                type="date"
                max={today()}
                value={confirmationDate}
                onChange={(e) => setConfirmationDate(e.target.value)}
              />
            </div>
            {revising && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmation-court-date">Court date for re-sentencing *</Label>
                <Input
                  id="confirmation-court-date"
                  type="date"
                  min={confirmationDate || undefined}
                  value={courtDate}
                  onChange={(e) => setCourtDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmation-document">Confirmation document *</Label>
            <Input
              id="confirmation-document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setDocument(e.target.files?.[0] || null)}
            />
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              The document sent by the court. It is kept on the inmate's record.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmation-remarks">Remarks</Label>
            <Textarea
              id="confirmation-remarks"
              rows={2}
              placeholder="e.g. Reviewed by the High Court, reference number"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {revising && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              The sentence on record stays as it is until the outcome of the court session is recorded. The revised
              sentence will count from the original sentence date for remission.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving} className="bg-[#0b4f2a] hover:bg-[#063f20]">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {revising ? "Record and schedule court" : "Record confirmation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SentenceConfirmationDialog;
