
import React, { useEffect, useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { OffenceFormValues, offenceDataSchema } from './OffenceRegistrationForm';
import { z } from 'zod';
import { Plus, X, Check, FileText, Pencil } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface OffencesProps {
  form: UseFormReturn<OffenceFormValues>;
  offences: z.infer<typeof offenceDataSchema>[];
  addOffence: (offence: z.infer<typeof offenceDataSchema>) => void;
  removeOffence: (index: number) => void;
  editOffence: (index: number) => void; // New prop for editing
  onDraftChange?: (draft: { convictionStatus: 'convicted' | 'unconvicted'; hasRestitution?: boolean }) => void;
  // Props for controlling the local form from the parent
  draftOffence: z.infer<typeof offenceDataSchema>;
  onDraftOffenceChange: (offence: z.infer<typeof offenceDataSchema>) => void;
  isGrouped?: boolean;
}

const Offences: React.FC<OffencesProps> = ({ 
  form: mainForm, 
  offences, 
  addOffence, 
  removeOffence,
  editOffence, 
  onDraftChange,
  draftOffence,
  onDraftOffenceChange,
  isGrouped = false,
}) => {
  const localSchema = useMemo(() => {
    return offenceDataSchema.superRefine((data, ctx) => {
      if (data.convictionStatus === 'convicted' && !isGrouped) {
        if (!data.sentence) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sentence duration is required for a convicted offence",
            path: ["sentence"]
          });
        }
        if (!data.sentenceDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sentence date is required for a convicted offence",
            path: ["sentenceDate"]
          });
        }
      }
    });
  }, [isGrouped]);

  const localForm = useForm<z.infer<typeof offenceDataSchema>>({
    resolver: zodResolver(localSchema),
    defaultValues: draftOffence, // Initialize with draft from parent
    mode: "all",
  });

  // Keep local form in sync with draftOffence from parent
  useEffect(() => {
    localForm.reset(draftOffence);
  }, [draftOffence, localForm]);

  const convictionStatus = localForm.watch("convictionStatus");
  const hasRestitution = localForm.watch("hasRestitution");

  // Emit draft changes to parent for conditional sections (release/restitution)
  useEffect(() => {
    if (onDraftChange) {
      onDraftChange({ convictionStatus: convictionStatus as 'convicted' | 'unconvicted', hasRestitution });
    }
  }, [convictionStatus, hasRestitution, onDraftChange]);



  const handleAddOffence = async () => {
    const isValid = await localForm.trigger();
    if (!isValid) {
      return;
    }

    const values = localForm.getValues();
    addOffence(values);
    
    // Reset the local form to default values via parent
    const defaultOffence: z.infer<typeof offenceDataSchema> = {
      offence: '',
      convictionStatus: 'unconvicted',
      furtherCharge: '',
      court: '',
      sentence: '',
      sentenceDate: '',
      nextCourtDate: '',
      hasRestitution: false,
    };
    onDraftOffenceChange(defaultOffence);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          <CardTitle>Offences</CardTitle>
        </div>
        <CardDescription>
          Record the inmate's offences and conviction status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new offence form */}
        <div className="border rounded-md p-4">
          <h4 className="font-medium mb-4 flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add New Offence
          </h4>
          
          <Form {...localForm}>
            <form className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={localForm.control}
                  name="offence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offence Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the offence" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={localForm.control}
                  name="court"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Court</FormLabel>
                      <FormControl>
                        <Input placeholder="Name of court" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={localForm.control}
                name="convictionStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conviction Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="convicted">Convicted</SelectItem>
                        <SelectItem value="unconvicted">Unconvicted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={localForm.control}
                name="furtherCharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Further Charge (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Any additional charges" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {convictionStatus === 'convicted' ? (
                <div className="space-y-4">
                  {!isGrouped && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={localForm.control}
                        name="sentence"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sentence</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 5 years" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={localForm.control}
                        name="sentenceDate"
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
                  <FormField
                    control={localForm.control}
                    name="hasRestitution"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Has Restitution</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <FormField
                  control={localForm.control}
                  name="nextCourtDate"
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
            </form>
          </Form>
          
          <Button 
            type="button"
            className="mt-4"
            onClick={handleAddOffence}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Offence
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Offences;
