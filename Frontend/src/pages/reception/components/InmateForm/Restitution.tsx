
import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
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
import { FormValues, offenceSchema, restitutionSchema } from './index';
import { z } from 'zod';
import { DollarSign, Calendar, Plus, X } from 'lucide-react';

interface RestitutionProps {
  form: UseFormReturn<FormValues>;
  restitutions: z.infer<typeof restitutionSchema>[];
  offences: z.infer<typeof offenceSchema>[];
  addRestitution: (restitution: z.infer<typeof restitutionSchema>) => void;
  removeRestitution: (index: number) => void;
}

const Restitution: React.FC<RestitutionProps> = ({
  form,
  restitutions,
  offences,
  addRestitution,
  removeRestitution
}) => {
  const [currentRestitution, setCurrentRestitution] = useState<z.infer<typeof restitutionSchema>>({
    offenceIndex: 0,
    restitutionAmount: '',
    restitutionDate: '',
    restitutionSentence: '',
    restitutionStatus: 'pending',
    restitutionReceipt: null,
  });

  // Filter to only convicted offences
  const convictedOffences = offences.filter((offence, index) =>
    offence.convictionStatus === 'convicted'
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentRestitution(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field: string, value: string | number) => {
    setCurrentRestitution(prev => ({ ...prev, [field]: value }));
  };

  const handleAddRestitution = () => {
    // Validation
    if (!currentRestitution.restitutionAmount || !currentRestitution.restitutionDate) {
      return;
    }

    // Check if restitution already exists for this offence
    if (restitutions.some(r => r.offenceIndex === currentRestitution.offenceIndex)) {
      return; // Prevent duplicate restitutions for same offence
    }

    addRestitution(currentRestitution);

    // Reset form
    setCurrentRestitution({
      offenceIndex: 0,
      restitutionAmount: '',
      restitutionDate: '',
      restitutionSentence: '',
      restitutionStatus: 'pending',
      restitutionReceipt: null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <DollarSign className="mr-2 h-5 w-5" />
          <CardTitle>Restitution</CardTitle>
        </div>
        <CardDescription>
          Record restitution details for convicted offences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing Restitutions */}
        {restitutions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Added Restitutions</h3>
            {restitutions.map((restitution, index) => {
              const relatedOffence = offences[restitution.offenceIndex];
              return (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">
                        Offence: {relatedOffence?.offence || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Amount: ${restitution.restitutionAmount} |
                        Status: {restitution.restitutionStatus} |
                        Date: {restitution.restitutionDate}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRestitution(index)}
                      className="ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add New Restitution */}
        {convictedOffences.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Add Restitution</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Related Convicted Offence</label>
                <Select
                  value={currentRestitution.offenceIndex.toString()}
                  onValueChange={(value) => handleSelectChange('offenceIndex', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select convicted offence" />
                  </SelectTrigger>
                  <SelectContent>
                    {convictedOffences.map((offence, index) => {
                      const actualIndex = offences.indexOf(offence);
                      const alreadyHasRestitution = restitutions.some(r => r.offenceIndex === actualIndex);
                      return (
                        <SelectItem
                          key={actualIndex}
                          value={actualIndex.toString()}
                          disabled={alreadyHasRestitution}
                        >
                          {offence.offence || 'Draft Offence (Unsaved)'} {alreadyHasRestitution ? '(Already has restitution)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Restitution Amount</label>
                  <Input
                    name="restitutionAmount"
                    placeholder="Enter amount"
                    value={currentRestitution.restitutionAmount}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Restitution Date</label>
                  <Input
                    name="restitutionDate"
                    type="date"
                    value={currentRestitution.restitutionDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Restitution Sentence</label>
                <Input
                  name="restitutionSentence"
                  placeholder="Sentence related to restitution"
                  value={currentRestitution.restitutionSentence}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Restitution Status</label>
                <Select
                  value={currentRestitution.restitutionStatus}
                  onValueChange={(value) => handleSelectChange('restitutionStatus', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partially Paid</SelectItem>
                    <SelectItem value="paid">Fully Paid</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              <div>
                <label className="text-sm font-medium">Restitution Receipt</label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setCurrentRestitution(prev => ({ ...prev, restitutionReceipt: file }));
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload a copy of the restitution receipt if available
                </p>
              </div>

              <Button
                type="button"
                onClick={handleAddRestitution}
                className="w-full"
                disabled={!currentRestitution.restitutionAmount || !currentRestitution.restitutionDate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Restitution
              </Button>
            </div>
          </div>
        )}

        {convictedOffences.length === 0 && (
          <p className="text-gray-500 text-center py-4">
            No convicted offences available for restitution. Add convicted offences first.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default Restitution;
