import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { receptionApi } from "@/lib/api";
import { Gavel } from "lucide-react";

const DISCHARGE_REASONS = [
  { value: "BAIL", label: "Bail" },
  { value: "FINE", label: "Fine" },
  { value: "ACQUITTED", label: "Not guilty and acquitted" },
  { value: "WITHDRAWN", label: "Withdrawn before/after plea" },
  { value: "COMMUNITY_SERVICE", label: "Community service" },
  { value: "SENTENCE_EXPIRES", label: "Sentence expires" },
  { value: "AMNESTY", label: "Amnesty" },
];

const formSchema = z.object({
  session_date: z.string().min(1, "Session date is required"),
  outcome: z.enum(["REMANDED", "CONVICTED", "DISCHARGED"], {
    required_error: "Outcome is required",
  }),
  next_court_date: z.string().optional(),
  remarks: z.string().optional(),
  
  sentence_months: z.string().optional(),
  sentence_date: z.string().optional(),
  
  discharge_reason: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.outcome === "REMANDED") {
        if (!data.next_court_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Next court date is required when remanded.",
                path: ["next_court_date"]
            });
        } else if (new Date(data.next_court_date) <= new Date(data.session_date)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Next court date must be after session date",
                path: ["next_court_date"]
            });
        }
    } else if (data.outcome === "CONVICTED") {
        if (!data.sentence_months) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Sentence duration (months) is required.",
                path: ["sentence_months"]
            });
        }
        if (!data.sentence_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Sentence date is required.",
                path: ["sentence_date"]
            });
        }
    } else if (data.outcome === "DISCHARGED") {
        if (!data.discharge_reason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Discharge reason is required.",
                path: ["discharge_reason"]
            });
        }
    }
});

interface CourtSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  offenceId: number;
  offenceDescription: string;
  onSuccess: (newDate?: string) => void;
}

export function CourtSessionModal({ isOpen, onClose, offenceId, offenceDescription, onSuccess }: CourtSessionModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      session_date: new Date().toISOString().split('T')[0],
      outcome: "REMANDED",
      next_court_date: "",
      remarks: "",
      sentence_months: "",
      sentence_date: "",
      discharge_reason: "",
    },
    mode: "onChange"
  });

  const selectedOutcome = form.watch("outcome");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Clean up payload based on outcome to avoid sending unnecessary data
      const payload: any = {
        offence: offenceId,
        session_date: values.session_date,
        outcome: values.outcome,
        remarks: values.remarks,
      };

      if (values.outcome === "REMANDED") {
        payload.next_court_date = values.next_court_date;
      } else if (values.outcome === "CONVICTED") {
        payload.sentence_months = parseInt(values.sentence_months || "0");
        payload.sentence_date = values.sentence_date;
      } else if (values.outcome === "DISCHARGED") {
        payload.discharge_reason = values.discharge_reason;
      }

      await receptionApi.createCourtSession(payload);

      toast({
        title: "Court Session Logged",
        description: `The court appearance outcome (${values.outcome}) has been recorded successfully.`,
      });
      
      onSuccess(values.next_court_date);
      onClose();
      form.reset();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to log court session.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Log Court Appearance
          </DialogTitle>
          <DialogDescription>
            Record the outcome of the court session for: <br />
            <span className="font-medium text-foreground">{offenceDescription}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="session_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Court Outcome</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="REMANDED">Remanded</SelectItem>
                        <SelectItem value="CONVICTED">Convicted</SelectItem>
                        <SelectItem value="DISCHARGED">Discharged</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedOutcome === "REMANDED" && (
              <FormField
                control={form.control}
                name="next_court_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Court Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedOutcome === "CONVICTED" && (
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-secondary/20">
                <FormField
                  control={form.control}
                  name="sentence_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sentence (Months)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g. 24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sentence_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sentence Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {selectedOutcome === "DISCHARGED" && (
              <div className="p-4 border rounded-md bg-secondary/20">
                <FormField
                  control={form.control}
                  name="discharge_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discharge Reason</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DISCHARGE_REASONS.map(reason => (
                            <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}