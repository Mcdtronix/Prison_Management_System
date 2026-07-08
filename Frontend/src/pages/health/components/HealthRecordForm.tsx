import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// Define the form schema matching AdmissionHealthAssessment model
const formSchema = z.object({
  weight: z.coerce.number().min(20, { message: 'Weight must be at least 20 kg' }),
  height: z.coerce.number().min(100, { message: 'Height must be at least 100 cm' }).optional().or(z.literal('')),
  comment: z.string().optional(),
  is_chronic_patient: z.boolean().default(false),
});

export type HealthFormValues = z.infer<typeof formSchema>;

interface HealthRecordFormProps {
  healthRecord: any | null;
  isSaving: boolean;
  onSubmit: (data: HealthFormValues & { assessed_by: string }) => void;
  onCancel: () => void;
}

export const HealthRecordForm: React.FC<HealthRecordFormProps> = ({
  healthRecord,
  isSaving,
  onSubmit,
  onCancel,
}) => {
  const { user } = useAuth();
  
  // Initialize form
  const form = useForm<HealthFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weight: healthRecord?.weight || '',
      height: healthRecord?.height || '',
      comment: healthRecord?.comment || '',
      is_chronic_patient: healthRecord?.is_chronic_patient || false,
    },
  });

  const handleFormSubmit = (data: HealthFormValues) => {
    // Inject the logged-in user's name or a default into the payload
    onSubmit({
      ...data,
      assessed_by: user?.name || user?.username || 'Health Officer',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {healthRecord ? 'Update Admission Assessment' : 'New Admission Assessment'}
        </CardTitle>
        <CardDescription>
          {healthRecord
            ? 'Update the health assessment for this inmate'
            : 'Record initial health assessment for this inmate'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="e.g., 72.5" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm) - Optional</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="e.g., 178" 
                        {...field} 
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Assessment Comments</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any medical observations or notes"
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="is_chronic_patient"
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
                      Chronic Patient
                    </FormLabel>
                    <FormDescription>
                      Check this box if the inmate has chronic conditions requiring ongoing care
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0b4f2a] hover:bg-[#063f20]"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : (healthRecord ? 'Update Record' : 'Save Record')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
