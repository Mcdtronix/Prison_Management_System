
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const opdVisitSchema = z.object({
  complaint: z.string().min(3, { message: 'Complaint is required' }),
  diagnosis: z.string().min(3, { message: 'Diagnosis is required' }),
  treatment: z.string().min(3, { message: 'Treatment is required' }),
  medications: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'treated', 'follow-up']),
});

export type OPDVisitFormValues = z.infer<typeof opdVisitSchema>;

interface OPDVisitFormProps {
  initialData?: OPDVisitFormValues;
  inmateId: string;
  onSubmit: (data: OPDVisitFormValues) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const OPDVisitForm: React.FC<OPDVisitFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSaving,
}) => {
  const defaultValues: Partial<OPDVisitFormValues> = {
    complaint: '',
    diagnosis: '',
    treatment: '',
    medications: '',
    notes: '',
    status: 'pending',
    ...initialData,
  };

  const form = useForm<OPDVisitFormValues>({
    resolver: zodResolver(opdVisitSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="complaint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chief Complaint</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the patient's complaint" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="diagnosis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Diagnosis</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter diagnosis" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="treatment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Treatment</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter prescribed treatment" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="medications"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medications</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter medications prescribed" {...field} />
              </FormControl>
              <FormDescription>List all medications with their dosages</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="treated">Treated</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="follow-up">Follow-up Required</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save OPD Record'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
