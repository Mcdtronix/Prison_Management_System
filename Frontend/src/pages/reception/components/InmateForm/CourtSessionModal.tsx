import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { receptionApi } from "@/lib/api";
import { Gavel } from "lucide-react";

const formSchema = z.object({
  session_date: z.string().min(1, "Session date is required"),
  outcome: z.string().min(1, "Outcome is required"),
  next_court_date: z.string().min(1, "Next court date is required"),
  remarks: z.string().optional(),
}).refine((data) => {
    if (!data.session_date || !data.next_court_date) return true;
    return new Date(data.next_court_date) > new Date(data.session_date);
}, {
    message: "Next court date must be after session date",
    path: ["next_court_date"],
});

interface CourtSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  offenceId: number;
  offenceDescription: string;
  onSuccess: (newDate: string) => void;
}

export function CourtSessionModal({ isOpen, onClose, offenceId, offenceDescription, onSuccess }: CourtSessionModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      session_date: new Date().toISOString().split('T')[0],
      outcome: "",
      next_court_date: "",
      remarks: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        offence: offenceId,
        ...values
      };
      
      // Cast to any to avoid TS errors if api.ts hasn't been updated yet
      await (receptionApi as any).createCourtSession(payload);

      toast({
        title: "Court Session Logged",
        description: "The court appearance has been recorded and the next court date updated.",
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
            </div>

            <FormField
              control={form.control}
              name="outcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Remanded, Bail Denied" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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