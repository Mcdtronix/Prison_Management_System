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
import { Clock } from "lucide-react";

const formSchema = z.object({
  new_date: z.string().min(1, "New date is required"),
  reason: z.string().min(1, "Reason is required"),
});

interface RestitutionExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  restitutionId: number;
  currentDate: string;
  onSuccess: (newDate: string) => void;
}

export function RestitutionExtensionModal({ isOpen, onClose, restitutionId, currentDate, onSuccess }: RestitutionExtensionModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      new_date: "",
      reason: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (new Date(values.new_date) <= new Date(currentDate)) {
        form.setError("new_date", { message: "New date must be after the current deadline" });
        return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        restitution: restitutionId,
        previous_date: currentDate,
        new_date: values.new_date,
        reason: values.reason
      };
      
      // Cast to any to avoid TS errors if api.ts hasn't been updated yet
      await (receptionApi as any).createRestitutionExtension(payload);

      toast({
        title: "Deadline Extended",
        description: "The restitution deadline has been updated.",
      });
      
      onSuccess(values.new_date);
      onClose();
      form.reset();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to extend restitution.",
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
            <Clock className="h-5 w-5" />
            Extend Restitution Deadline
          </DialogTitle>
          <DialogDescription>
            Current Deadline: <span className="font-medium">{currentDate}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Deadline</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Extension</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Why is the deadline being extended?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Extend Deadline"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}