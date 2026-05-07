import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormValues } from "./index";
import { Textarea } from "@/components/ui/textarea";
import { Shield } from "lucide-react";

interface ClassificationProps {
  form: UseFormReturn<FormValues>;
}

const Classification: React.FC<ClassificationProps> = ({ form }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          <CardTitle>Classification</CardTitle>
        </div>
        <CardDescription>
          Determine the inmate's security classification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="classification.classification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Security Classification</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="A">Class A</SelectItem>
                  <SelectItem value="B">Class B</SelectItem>
                  <SelectItem value="C">Class C</SelectItem>
                  <SelectItem value="D">Class D</SelectItem>
                  <SelectItem value="PUSOD">PUSOD</SelectItem>
                  <SelectItem value="CONDEM">CONDEM</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Classification based on offense severity and risk assessment
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="classification.reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Classification</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain the reasoning behind this classification"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="classification.authorizedBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authorized By</FormLabel>
              <FormControl>
                <Input placeholder="Name of authorizing officer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};

export default Classification;
