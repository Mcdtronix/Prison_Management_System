
import React from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormValues } from './index';
import { Calendar } from 'lucide-react';

interface ReleaseDatesProps {
  form: UseFormReturn<FormValues>;
}

const ReleaseDates: React.FC<ReleaseDatesProps> = ({ form }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <Calendar className="mr-2 h-5 w-5" />
          <CardTitle>Release Dates</CardTitle>
        </div>
        <CardDescription>
          Record sentence and earliest date of release
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="releaseDates.sentence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sentence Summary</FormLabel>
              <FormControl>
                <Input placeholder="Total effective sentence" {...field} />
              </FormControl>
              <FormDescription>
                The total combined sentence for all offences
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="releaseDates.earliestDateOfRelease"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Earliest Date of Release</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormDescription>
                The calculated earliest possible release date
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="releaseDates.remission"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remission</FormLabel>
              <FormControl>
                <Input placeholder="Remission in months" {...field} />
              </FormControl>
              <FormDescription>
                The calculated remission amount (e.g., 1/3 of sentence)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};

export default ReleaseDates;
