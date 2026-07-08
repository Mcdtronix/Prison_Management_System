import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { Toaster, toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PrisonLayout } from "@/components/PrisonLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";

import { adminApi, inmateApi } from "@/lib/api";

const courtOutcomeSchema = z.object({
  session_date: z.date({
    required_error: "A court session date is required.",
  }),
  outcome: z.enum(["REMANDED", "CONVICTED", "DISCHARGED"]),
  next_court_date: z.date().optional(),
  remarks: z.string().optional(),
  
  // Sentence
  sentence_years: z.number().min(0).optional(),
  sentence_months: z.number().min(0).optional(),
  sentence_days: z.number().min(0).optional(),
  sentence_date: z.date().optional(),
  has_fine: z.boolean().default(false).optional(),
  fine_amount: z.string().optional(),
  
  // Restitution
  has_restitution: z.boolean().default(false).optional(),
  restitution_amount: z.string().optional(),
  restitution_date: z.date().optional(),
  restitution_sentence_years: z.number().min(0).optional(),
  restitution_sentence_months: z.number().min(0).optional(),
  restitution_sentence_days: z.number().min(0).optional(),
  
  // Discharged
  discharge_reason: z.string().optional(),
  
  // Reclassification
  reclassification: z.string().optional(),
});

type FormValues = z.infer<typeof courtOutcomeSchema>;

export default function RecordCourtOutcome() {
  const { inmateId, offenceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inmate, setInmate] = useState<any>(null);
  const [offence, setOffence] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(courtOutcomeSchema),
    defaultValues: {
      outcome: "REMANDED",
      has_fine: false,
      has_restitution: false,
      sentence_years: 0,
      sentence_months: 0,
      sentence_days: 0,
      restitution_sentence_years: 0,
      restitution_sentence_months: 0,
      restitution_sentence_days: 0,
      remarks: "",
    },
  });

  const outcome = form.watch("outcome");
  const hasFine = form.watch("has_fine");
  const hasRestitution = form.watch("has_restitution");

  useEffect(() => {
    if (inmateId && offenceId) {
      fetchInmateDetails(inmateId);
    }
  }, [inmateId, offenceId]);

  const fetchInmateDetails = async (id: string) => {
    try {
      const response = await inmateApi.getInmateDetails(id);
      setInmate(response.data);
      const matchedOffence = response.data.offences?.find(
        (o: any) => o.id === parseInt(offenceId as string)
      );
      if (matchedOffence) {
        setOffence(matchedOffence);
        // Pre-fill reclassification if classification history exists
        if (response.data.classification) {
          form.setValue("reclassification", response.data.classification);
        }
      } else {
        toast.error("Offence not found.");
      }
    } catch (error) {
      console.error("Error fetching inmate:", error);
      toast.error("Failed to load inmate details.");
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!offenceId || !inmateId) return;

    // Additional validations
    if (data.outcome === "REMANDED" && !data.next_court_date) {
      toast.error("Next Court Date is required for remanded outcome.");
      return;
    }
    if (data.outcome === "CONVICTED" && !data.sentence_date) {
      toast.error("Sentence Date is required for convicted outcome.");
      return;
    }
    if (data.outcome === "DISCHARGED" && !data.discharge_reason) {
      toast.error("Discharge reason is required for discharged outcome.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        session_date: format(data.session_date, "yyyy-MM-dd"),
        outcome: data.outcome,
        remarks: data.remarks || "",
        reclassification: data.reclassification || "",
      };

      if (data.outcome === "REMANDED") {
        payload.next_court_date = format(data.next_court_date!, "yyyy-MM-dd");
      }

      if (data.outcome === "CONVICTED") {
        payload.sentence_years = data.sentence_years || 0;
        payload.sentence_months = data.sentence_months || 0;
        payload.sentence_days = data.sentence_days || 0;
        payload.sentence_date = format(data.sentence_date!, "yyyy-MM-dd");
        
        payload.has_fine = data.has_fine;
        if (data.has_fine) payload.fine_amount = data.fine_amount;

        payload.has_restitution = data.has_restitution;
        if (data.has_restitution) {
          payload.restitution_amount = data.restitution_amount;
          if (data.restitution_date) {
            payload.restitution_date = format(data.restitution_date, "yyyy-MM-dd");
          }
          payload.restitution_sentence_years = data.restitution_sentence_years || 0;
          payload.restitution_sentence_months = data.restitution_sentence_months || 0;
          payload.restitution_sentence_days = data.restitution_sentence_days || 0;
        }
      }

      if (data.outcome === "DISCHARGED") {
        payload.discharge_reason = data.discharge_reason;
      }

      await inmateApi.recordCourtSession(offenceId, payload);
      toast.success("Court session recorded successfully");
      navigate(`/inmates/${inmateId}`);
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to record court session: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PrisonLayout user={user}>
      <div className="container mx-auto p-6 max-w-4xl">
        <Toaster position="top-right" richColors />
        
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/inmates/${inmateId}`)}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inmate Details
          </Button>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Record Court Outcome</h1>
        </div>

        {inmate && offence && (
          <Card className="mb-8 border-l-4 border-l-blue-600 shadow-sm">
            <CardHeader className="bg-blue-50/50 pb-4">
              <CardTitle className="text-lg text-blue-900">Current Offence Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 font-medium">Inmate</p>
                <p className="font-semibold text-gray-900">{inmate.first_name} {inmate.surname} ({inmate.prison_number})</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Current Status</p>
                <p className="font-semibold text-gray-900 uppercase">{offence.conviction_status}</p>
              </div>
              <div className="md:col-span-2 mt-2">
                <p className="text-sm text-gray-500 font-medium">Offence Description</p>
                <p className="font-semibold text-gray-900">{offence.offence_description}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500 font-medium">Court</p>
                <p className="font-semibold text-gray-900">{offence.court}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-md border-t-4 border-t-emerald-600">
          <CardHeader>
            <CardTitle>Log New Court Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <FormField
                    control={form.control}
                    name="session_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Court Session Date <span className="text-red-500">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="outcome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outcome <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select outcome" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="REMANDED">Remanded (Unconvicted)</SelectItem>
                            <SelectItem value="CONVICTED">Convicted & Sentenced</SelectItem>
                            <SelectItem value="DISCHARGED">Discharged</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  {outcome === "REMANDED" && (
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                      <h3 className="font-semibold text-orange-800 mb-4">Remand Details</h3>
                      <FormField
                        control={form.control}
                        name="next_court_date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Next Court Date <span className="text-red-500">*</span></FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal bg-white",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {outcome === "DISCHARGED" && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                      <h3 className="font-semibold text-emerald-800 mb-4">Discharge Details</h3>
                      <FormField
                        control={form.control}
                        name="discharge_reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reason for Discharge <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Select a reason" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="BAIL">Bail</SelectItem>
                                <SelectItem value="FINE">Fine</SelectItem>
                                <SelectItem value="ACQUITTED">Not guilty and acquitted</SelectItem>
                                <SelectItem value="WITHDRAWN">Withdrawn before/after plea</SelectItem>
                                <SelectItem value="COMMUNITY_SERVICE">Community service</SelectItem>
                                <SelectItem value="SENTENCE_EXPIRES">Sentence expires</SelectItem>
                                <SelectItem value="AMNESTY">Amnesty</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {outcome === "CONVICTED" && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg space-y-6 animate-in fade-in zoom-in-95 duration-200">
                      <h3 className="font-semibold text-red-800">Sentence Details</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="sentence_years"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Years</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="bg-white" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="sentence_months"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Months</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="bg-white" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="sentence_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="bg-white" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="sentence_date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Sentence Date <span className="text-red-500">*</span></FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal bg-white",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="pt-4 border-t border-red-200">
                        <FormField
                          control={form.control}
                          name="has_fine"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Include a Fine?</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />

                        {hasFine && (
                          <FormField
                            control={form.control}
                            name="fine_amount"
                            render={({ field }) => (
                              <FormItem className="mt-4">
                                <FormLabel>Fine Amount ($)</FormLabel>
                                <FormControl>
                                  <Input placeholder="0.00" type="number" step="0.01" {...field} className="bg-white" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      <div className="pt-4 border-t border-red-200">
                        <FormField
                          control={form.control}
                          name="has_restitution"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Include Restitution?</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />

                        {hasRestitution && (
                          <div className="mt-4 space-y-4">
                            <FormField
                              control={form.control}
                              name="restitution_amount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Restitution Amount ($)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0.00" type="number" step="0.01" {...field} className="bg-white" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="restitution_date"
                              render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel>Restitution Due Date</FormLabel>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button
                                          variant={"outline"}
                                          className={cn(
                                            "w-full pl-3 text-left font-normal bg-white",
                                            !field.value && "text-muted-foreground"
                                          )}
                                        >
                                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div>
                              <FormLabel className="mb-2 block">Alternative Sentence (if restitution unpaid)</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                  control={form.control}
                                  name="restitution_sentence_years"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Years</FormLabel>
                                      <FormControl>
                                        <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="bg-white" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="restitution_sentence_months"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Months</FormLabel>
                                      <FormControl>
                                        <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="bg-white" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="restitution_sentence_days"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Days</FormLabel>
                                      <FormControl>
                                        <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="bg-white" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* --- Added Computed Summary Block --- */}
                      <div className="pt-4 border-t border-red-200 mt-6">
                        <div className="bg-white p-4 rounded-md border border-indigo-100 shadow-sm">
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                            Computed Release Dates Summary
                          </h4>
                          
                          {(() => {
                            const y = form.watch("sentence_years") || 0;
                            const m = form.watch("sentence_months") || 0;
                            const d = form.watch("sentence_days") || 0;
                            const totalDays = (y * 365) + (m * 30) + d;
                            const standardRemission = Math.floor(totalDays / 3);

                            const ry = form.watch("restitution_sentence_years") || 0;
                            const rm = form.watch("restitution_sentence_months") || 0;
                            const rd = form.watch("restitution_sentence_days") || 0;
                            const restDays = (ry * 365) + (rm * 30) + rd;
                            const netDays = Math.max(0, totalDays - restDays);
                            const restitutionRemission = Math.floor(netDays / 3);

                            return (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                  <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Standard Computation</h5>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between border-b border-gray-200 pb-1">
                                      <span className="text-gray-600">Total Effective Sentence:</span>
                                      <span className="font-semibold">{totalDays} Days</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-200 pb-1">
                                      <span className="text-gray-600">Remission (1/3):</span>
                                      <span className="font-semibold text-emerald-600">{standardRemission} Days</span>
                                    </div>
                                    <div className="flex justify-between pt-1">
                                      <span className="text-gray-600">Net Days Served:</span>
                                      <span className="font-bold text-indigo-700">{totalDays - standardRemission} Days</span>
                                    </div>
                                  </div>
                                </div>

                                {hasRestitution && (
                                  <div className="bg-amber-50 p-3 rounded border border-amber-200">
                                    <h5 className="text-xs font-bold text-amber-700 uppercase mb-2">If Restitution is Paid</h5>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between border-b border-amber-200 pb-1">
                                        <span className="text-amber-800">Sentence Reduction:</span>
                                        <span className="font-semibold text-amber-700">-{restDays} Days</span>
                                      </div>
                                      <div className="flex justify-between border-b border-amber-200 pb-1">
                                        <span className="text-amber-800">New Effective Sentence:</span>
                                        <span className="font-semibold">{netDays} Days</span>
                                      </div>
                                      <div className="flex justify-between border-b border-amber-200 pb-1">
                                        <span className="text-amber-800">New Remission (1/3):</span>
                                        <span className="font-semibold text-emerald-600">{restitutionRemission} Days</span>
                                      </div>
                                      <div className="flex justify-between pt-1">
                                        <span className="text-amber-800">Net Days Served:</span>
                                        <span className="font-bold text-indigo-700">{netDays - restitutionRemission} Days</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t mt-6">
                    <FormField
                      control={form.control}
                      name="reclassification"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Propose New Classification (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select classification" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                              <SelectItem value="PUSOD">PUSOD</SelectItem>
                              <SelectItem value="COND">CONDEMNED</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500 mt-1">If the court outcome changes the inmate's security risk.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Remarks / Session Notes</FormLabel>
                        <FormControl>
                          <Input placeholder="Any additional notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-6">
                  <Button type="submit" disabled={loading} className="w-full bg-[#0b4f2a] hover:bg-[#083b1f]">
                    {loading ? "Recording..." : "Record Court Outcome"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </PrisonLayout>
  );
}
