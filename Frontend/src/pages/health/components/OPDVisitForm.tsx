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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';

const opdVisitSchema = z.object({
  temperature: z.coerce.number().min(30).max(45, { message: 'Temperature must be between 30 and 45 °C' }),
  blood_pressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/, { message: 'Format must be systolic/diastolic (e.g., 120/80)' }),
  weight: z.coerce.number().min(20, { message: 'Weight must be at least 20 kg' }),
  problem: z.string().min(3, { message: 'Problem/Complaint is required' }),
  duration: z.string().min(1, { message: 'Duration is required (e.g. 3 days)' }),
  diagnosis: z.string().min(3, { message: 'Diagnosis is required' }),
  treatment: z.string().min(3, { message: 'Treatment is required' }),
  referral: z.string().optional(),
  follow_up_required: z.boolean().default(false),
  remarks: z.string().optional(),
});

export type OPDVisitFormValues = z.infer<typeof opdVisitSchema>;

interface OPDVisitFormProps {
  initialData?: OPDVisitFormValues;
  inmateId: string;
  onSubmit: (data: OPDVisitFormValues & { attended_by: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const OPDVisitForm: React.FC<OPDVisitFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSaving,
}) => {
  const { user } = useAuth();

  const defaultValues: Partial<OPDVisitFormValues> = {
    problem: '',
    duration: '',
    diagnosis: '',
    treatment: '',
    referral: '',
    remarks: '',
    follow_up_required: false,
    ...initialData,
  };

  const form = useForm<OPDVisitFormValues>({
    resolver: zodResolver(opdVisitSchema),
    defaultValues,
  });

  const handleFormSubmit = (data: OPDVisitFormValues) => {
    onSubmit({
      ...data,
      attended_by: user?.name || user?.username || 'Health Officer',
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperature (°C)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="e.g., 37.2" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="blood_pressure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Blood Pressure</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 120/80" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="e.g., 70" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="problem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chief Complaint / Problem</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the patient's complaint" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 3 days, 2 weeks" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
          name="referral"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Referral (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Hospital X, Specialist Y" {...field} value={field.value ?? ''} />
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
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional notes" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="follow_up_required"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Follow-up Required
                </FormLabel>
                <FormDescription>
                  Check this box if the patient needs a follow-up visit.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
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
