
import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

// Define the form schema
const formSchema = z.object({
  temperature: z.string().min(1, { message: 'Temperature is required' }),
  height: z.string().min(1, { message: 'Height is required' }),
  weight: z.string().min(1, { message: 'Weight is required' }),
  blood_pressure: z.string().min(1, { message: 'Blood pressure is required' }),
  health_status: z.string().min(1, { message: 'Health status is required' }),
  medical_conditions: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type HealthFormValues = z.infer<typeof formSchema>;

// Common medical conditions for quick selection
const commonConditions = [
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'asthma', label: 'Asthma' },
  { id: 'hiv', label: 'HIV/AIDS' },
  { id: 'tuberculosis', label: 'Tuberculosis' },
  { id: 'depression', label: 'Depression' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'epilepsy', label: 'Epilepsy' },
];

// Common allergies for quick selection
const commonAllergies = [
  { id: 'penicillin', label: 'Penicillin' },
  { id: 'sulfa', label: 'Sulfa Drugs' },
  { id: 'nsaids', label: 'NSAIDs' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'latex', label: 'Latex' },
];

interface HealthRecordFormProps {
  healthRecord: any | null;
  isSaving: boolean;
  onSubmit: (data: HealthFormValues) => void;
  onCancel: () => void;
}

export const HealthRecordForm: React.FC<HealthRecordFormProps> = ({
  healthRecord,
  isSaving,
  onSubmit,
  onCancel,
}) => {
  const navigate = useNavigate();
  
  // Initialize form
  const form = useForm<HealthFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      temperature: healthRecord?.temperature || '',
      height: healthRecord?.height || '',
      weight: healthRecord?.weight || '',
      blood_pressure: healthRecord?.blood_pressure || '',
      health_status: healthRecord?.health_status || 'healthy',
      medical_conditions: healthRecord?.medical_conditions || [],
      medications: healthRecord?.medications || [],
      allergies: healthRecord?.allergies || [],
      notes: healthRecord?.notes || '',
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {healthRecord ? 'Update Health Record' : 'Create Health Record'}
        </CardTitle>
        <CardDescription>
          {healthRecord
            ? 'Update the health information for this inmate'
            : 'Record initial health information for this inmate'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 98.6°F" 
                        {...field} 
                      />
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
                      <Input 
                        placeholder="e.g., 120/80 mmHg" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 5'10&quot; or 178 cm" 
                        {...field} 
                      />
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
                    <FormLabel>Weight</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 160 lbs or 72.5 kg" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="health_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overall Health Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="healthy">Healthy</SelectItem>
                      <SelectItem value="stable">Stable with Conditions</SelectItem>
                      <SelectItem value="requires_monitoring">Requires Monitoring</SelectItem>
                      <SelectItem value="requires_treatment">Requires Treatment</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Assessment of the inmate&apos;s overall health condition
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            
            {/* Medical conditions section */}
            <div>
              <FormLabel className="text-base">Medical Conditions</FormLabel>
              <FormDescription className="mt-1 mb-3">
                Select any diagnosed medical conditions
              </FormDescription>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {commonConditions.map((condition) => (
                  <FormField
                    key={condition.id}
                    control={form.control}
                    name="medical_conditions"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={condition.id}
                          className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(condition.label)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      condition.label,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== condition.label
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {condition.label}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              
              <FormLabel className="text-base">Other Medical Conditions</FormLabel>
              <FormField
                control={form.control}
                name="medical_conditions"
                render={({ field }) => (
                  <FormItem className="mt-1">
                    <FormControl>
                      <Input
                        placeholder="Type additional condition and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value) {
                              field.onChange([...(field.value || []), value]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Current conditions: {(field.value || []).join(', ') || 'None'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />
            
            {/* Allergies section */}
            <div>
              <FormLabel className="text-base">Allergies</FormLabel>
              <FormDescription className="mt-1 mb-3">
                Select any known allergies
              </FormDescription>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {commonAllergies.map((allergy) => (
                  <FormField
                    key={allergy.id}
                    control={form.control}
                    name="allergies"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={allergy.id}
                          className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(allergy.label)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      allergy.label,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== allergy.label
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {allergy.label}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              
              <FormLabel className="text-base">Other Allergies</FormLabel>
              <FormField
                control={form.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem className="mt-1">
                    <FormControl>
                      <Input
                        placeholder="Type additional allergy and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value) {
                              field.onChange([...(field.value || []), value]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Current allergies: {(field.value || []).join(', ') || 'None'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="medications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Current Medications</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Type medication and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          e.preventDefault();
                          const value = e.currentTarget.value.trim();
                          if (value) {
                            field.onChange([...(field.value || []), value]);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Current medications: {(field.value || []).join(', ') || 'None'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional observations or notes"
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                className="bg-[#9b87f5] hover:bg-[#7E69AB]"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : (healthRecord ? 'Update Record' : 'Create Record')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
