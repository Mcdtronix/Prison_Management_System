import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { receptionApi } from "@/lib/api";
import { useNavigate, useParams, useLocation } from "react-router-dom";

// Form Sections
import Offences from "./Offences";
import ReleaseDates from "./ReleaseDates";
import Restitution from "./Restitution";

const baseOffenceSchema = z.object({
  offence: z.string().min(1, "Offence description is required"),
  court: z.string().min(1, "Court is required"),
  hasRestitution: z.boolean().optional(),
  hasBail: z.boolean().optional(),
  bailAmount: z.string().optional(),
});

// Schema for convicted and unconvicted offences using a discriminated union
export const offenceDataSchema = z.discriminatedUnion("convictionStatus", [
  z.object({
    convictionStatus: z.literal("convicted"),
    sentenceYears: z.coerce.number().min(0).optional(),
    sentenceMonths: z.coerce.number().min(0).optional(),
    sentenceDays: z.coerce.number().min(0).optional(),
    sentenceDate: z.string().optional(), // Validated via superRefine
    nextCourtDate: z.string().optional(),
    hasFine: z.boolean().optional(),
    fineAmount: z.string().optional(),
  }).merge(baseOffenceSchema),
  z.object({
    convictionStatus: z.literal("unconvicted"),
    nextCourtDate: z.string().min(1, "Next court date is required for unconvicted status"),
    remandStartDate: z.string().optional(),
    sentenceYears: z.coerce.number().min(0).optional(),
    sentenceMonths: z.coerce.number().min(0).optional(),
    sentenceDays: z.coerce.number().min(0).optional(),
    sentenceDate: z.string().optional(),
  }).merge(baseOffenceSchema),
  z.object({
    convictionStatus: z.literal("discharged"),
    dischargeReason: z.string().min(1, "Discharge reason is required"),
    dischargeDate: z.string().min(1, "Discharge date is required"),
    remarks: z.string().optional(),
  }).merge(baseOffenceSchema),
]);

export const releaseDatesSchema = z.object({
  sentence: z.string().optional(),
  earliestDateOfRelease: z.string().optional(),
  remission: z.string().optional(),
});

export const restitutionSchema = z.object({
  offenceIndex: z.number().min(0, "Related offence is required"),
  restitutionAmount: z.string().min(1, "Restitution amount is required"),
  restitutionDate: z.string().min(1, "Restitution date is required"),
  restitutionSentence: z.string().optional(),
  restitutionStatus: z
    .enum(["pending", "partial", "paid", "waived"])
    .default("pending"),
  restitutionReceipt: z.any().optional(), // For file upload
});

// Combined schema for offence registration
const offenceFormSchema = z.object({
  inmate_id: z.number().min(1, "Inmate ID is required"),
  offences: z
    .array(offenceDataSchema)
    .optional(), // Make offences optional for initial render
  releaseDates: releaseDatesSchema.optional(), // Also make releaseDates optional
  restitutions: z.array(restitutionSchema).optional(),
  sentenceGroup: z.object({
    isGrouped: z.boolean().default(false),
    duration: z.string().optional(),
    date: z.string().optional()
  }).optional(),
  reclassification: z.string().optional()
}).superRefine((data, ctx) => {
  const hasConvicted = data.offences?.some(o => o.convictionStatus === 'convicted');

  // Release dates are now automatically calculated by the backend upon save,
  // so we no longer require the user to input them.

  if (data.sentenceGroup?.isGrouped && hasConvicted) {
    if (!data.sentenceGroup.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Grouped sentence duration is required",
        path: ["sentenceGroup", "duration"]
      });
    }
    if (!data.sentenceGroup.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Grouped sentence date is required",
        path: ["sentenceGroup", "date"]
      });
    }
  } else if (!data.sentenceGroup?.isGrouped && hasConvicted) {
    data.offences?.forEach((offence, index) => {
      if (offence.convictionStatus === 'convicted') {
        if (!offence.sentenceYears && !offence.sentenceMonths && !offence.sentenceDays) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sentence duration is required",
            path: ["offences", index, "sentenceYears"] // attaching to years as a general marker
          });
        }
        if (!offence.sentenceDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sentence date is required",
            path: ["offences", index, "sentenceDate"]
          });
        }
      }
    });
  }

  // Enforce Restitution Records
  data.offences?.forEach((offence, index) => {
    if (offence.convictionStatus === 'convicted' && offence.hasRestitution) {
      const hasMatchingRestitution = data.restitutions?.some(r => r.offenceIndex === index);
      if (!hasMatchingRestitution) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Restitution details missing for Offence #${index + 1} (${offence.offence || 'Unnamed'}). Please fill out the Restitution section and click 'Add Restitution'.`,
          path: ["restitutions"] // Attaches to the array root
        });
      }
    }
  });
});

export type OffenceFormValues = z.infer<typeof offenceFormSchema>;

interface OffenceRegistrationFormProps {
  inmateId?: number;
}

const OffenceRegistrationForm = ({
  inmateId,
}: OffenceRegistrationFormProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation() as { state?: any };
  const editMode = location.state?.mode === "edit";
  const offenceToEditId = location.state?.offenceToEditId as string | undefined;
  const offencesFromState = (location.state?.offences as any[]) || [];
  const inmateSummaryFromState = location.state?.inmateSummary as
    | { id?: string; prison_number?: string; surname?: string; first_name?: string }
    | undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offences, setOffences] = useState<z.infer<typeof offenceDataSchema>[]>(
    [],
  );
  const [restitutions, setRestitutions] = useState<
    z.infer<typeof restitutionSchema>[]
  >([]);
  const [inmate, setInmate] = useState<any>(null);
  const [offencesSummary, setOffencesSummary] = useState<any[]>([]);
  // Track live draft values from the Offences subform to control conditional sections
  const [draftConvictionStatus, setDraftConvictionStatus] = useState<
    "convicted" | "unconvicted"
  >("unconvicted");
  const [draftHasRestitution, setDraftHasRestitution] = useState<boolean>(false);

  // State for the draft offence being edited in the form
  const [draftOffence, setDraftOffence] = useState<z.infer<typeof offenceDataSchema>>({
    offence: '',
    convictionStatus: 'unconvicted',
    court: '',
    sentenceYears: 0,
    sentenceMonths: 0,
    sentenceDays: 0,
    sentenceDate: '',
    nextCourtDate: '',
    remandStartDate: '',
    hasRestitution: false,
    hasBail: false,
    bailAmount: '',
    hasFine: false,
    fineAmount: '',
  });

  const resolvedInmateId =
    inmateId || (params.inmateId ? parseInt(params.inmateId) : null);

  // Map an offence object from inmate details to form schema shape
  const mapOffenceToForm = (o: any) => {
    if (!o) {
      // Return a default empty offence object if o is null or undefined
      return {
        offence: '',
        convictionStatus: 'unconvicted',
        court: '',
        sentenceYears: 0,
        sentenceMonths: 0,
        sentenceDays: 0,
        sentenceDate: '',
        nextCourtDate: '',
        remandStartDate: '',
        hasRestitution: false,
      };
    }

    let convictionStatus: "convicted" | "unconvicted" | "discharged" = "unconvicted";
    if (o.conviction_status === "convicted" || o.Offence_status === "CONVICTED") {
      convictionStatus = "convicted";
    } else if (o.conviction_status === "discharged" || o.Offence_status === "DISCHARGED") {
      convictionStatus = "discharged";
    }
    const mapped: any = {
      convictionStatus,
      offence: o.offence_description || o.description || "",
      court: o.court || "",
      hasRestitution: Boolean(o.restitution_amount),
      hasBail: Boolean(o.has_bail),
      bailAmount: o.bail_amount?.toString() || "",
    };

    if (convictionStatus === "convicted") {
      mapped.sentenceYears = o.sentence_years || 0;
      mapped.sentenceMonths = o.sentence_months || 0;
      mapped.sentenceDays = o.sentence_days || 0;
      mapped.sentenceDate = o.date_of_sentence
        ? new Date(o.date_of_sentence).toISOString().split('T')[0]
        : "";
      mapped.nextCourtDate = "";
      mapped.hasFine = Boolean(o.has_fine);
      mapped.fineAmount = o.fine_amount?.toString() || "";
    } else if (convictionStatus === "discharged") {
      mapped.dischargeReason = o.discharge_reason || "";
      mapped.dischargeDate = o.discharge_date
        ? new Date(o.discharge_date).toISOString().split('T')[0]
        : "";
      mapped.remarks = o.remarks || "";
    } else {
      mapped.nextCourtDate = o.next_court_date
        ? new Date(o.next_court_date).toISOString().split('T')[0]
        : "";
      mapped.remandStartDate = o.remand_start_date
        ? new Date(o.remand_start_date).toISOString().split('T')[0]
        : "";
      mapped.sentenceYears = 0;
      mapped.sentenceMonths = 0;
      mapped.sentenceDays = 0;
      mapped.sentenceDate = "";
      mapped.hasFine = false;
      mapped.fineAmount = "";
    }
    return mapped;
  };

  // Sync draft status variables whenever the draftOffence changes
  useEffect(() => {
    setDraftConvictionStatus(draftOffence.convictionStatus);
    setDraftHasRestitution(Boolean(draftOffence.hasRestitution));
  }, [draftOffence]);

  // Initialize when editing or creating
  useEffect(() => {
    if (resolvedInmateId) {
      // Prefer summary from navigation state when editing
      if (editMode && inmateSummaryFromState) {
        setInmate({
          id: resolvedInmateId,
          prison_number: inmateSummaryFromState.prison_number,
          surname: inmateSummaryFromState.surname,
          first_name: inmateSummaryFromState.first_name,
        });
      } else {
        setInmate({ id: resolvedInmateId });
      }

      // Prefill offences for edit
      if (editMode && offencesFromState.length) {
        setOffencesSummary(offencesFromState);
        const selected = offenceToEditId
          ? offencesFromState.find((o: any) => String(o.id) === String(offenceToEditId))
          : offencesFromState[0];
        if (selected) {
          const mappedOffence = mapOffenceToForm(selected);
          setOffences([mappedOffence]);
          form.setValue("offences", [mappedOffence]);

          if (location.state?.currentClass) {
            form.setValue("reclassification", location.state.currentClass);
          }

          // Pre-fill release dates if the selected offence is convicted
          if (mappedOffence.convictionStatus === 'convicted') {
            // Assuming release history is on the inmate object passed via state or fetched separately
            // For now, we'll try to get it from the first offence's data if available, or leave it empty.
            const releaseData = {
              sentence: selected.sentence || "", // This might need adjustment based on actual data structure
              earliestDateOfRelease: selected.edr_with_restitution || selected.edr_without_restitution || "",
              remission: selected.remission || "",
            };
            form.setValue("releaseDates", releaseData);
          }

          // Pre-fill restitution if it exists for the selected offence
          if (selected.restitution_amount) {
            const restitutionData = {
              offenceIndex: 0, // Since we are editing one offence, its index is 0
              restitutionAmount: selected.restitution_amount.toString(),
              restitutionDate: selected.restitution_date ? new Date(selected.restitution_date).toISOString().split('T')[0] : "",
              restitutionSentence: "", // This field might not be in the summary
              restitutionStatus: "pending" as const, // Default or from summary if available
            };
            setRestitutions([restitutionData]);
            form.setValue("restitutions", [restitutionData]);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedInmateId, editMode, offenceToEditId]);

  const form = useForm<OffenceFormValues>({
    resolver: zodResolver(offenceFormSchema),
    defaultValues: {
      inmate_id: resolvedInmateId || 0,
      offences: editMode && offencesFromState.length > 0 ? offencesFromState.map(mapOffenceToForm) : [],
      releaseDates: {
        sentence: "",
        earliestDateOfRelease: "",
        remission: "",
      },
      restitutions: [],
      sentenceGroup: {
        isGrouped: false,
        duration: "",
        date: ""
      }
    },
    mode: "all",
  });

  // Add offence to the list
  const addOffence = (offence: z.infer<typeof offenceDataSchema>) => {
    const updatedOffences = [...offences, offence];
    setOffences(updatedOffences);
    form.setValue("offences", updatedOffences);

    toast({
      title: "Offence Added",
      description: "The offence has been added to the registration",
    });
  };

  // Remove offence from the list
  const removeOffence = (index: number) => {
    const updatedOffences = [...offences];
    updatedOffences.splice(index, 1);
    setOffences(updatedOffences);
    form.setValue("offences", updatedOffences);

    // Remove associated restitutions
    const updatedRestitutions = restitutions
      .filter((r) => r.offenceIndex !== index)
      .map((r) =>
        r.offenceIndex > index ? { ...r, offenceIndex: r.offenceIndex - 1 } : r,
      );
    setRestitutions(updatedRestitutions);
    form.setValue("restitutions", updatedRestitutions);
  };

  // Edit an existing offence from the list
  const editOffence = (index: number) => {
    const offenceToEdit = offences[index];
    if (offenceToEdit) {
      // Populate the draft offence state, which will in turn populate the form
      setDraftOffence(offenceToEdit);
    }
  };

  // Add restitution to the list
  const addRestitution = (restitution: z.infer<typeof restitutionSchema>) => {
    const updatedRestitutions = [...restitutions, restitution];
    setRestitutions(updatedRestitutions);
    form.setValue("restitutions", updatedRestitutions);

    toast({
      title: "Restitution Added",
      description: "The restitution has been added to the registration",
    });
  };

  // Remove restitution from the list
  const removeRestitution = (index: number) => {
    const updatedRestitutions = [...restitutions];
    updatedRestitutions.splice(index, 1);
    setRestitutions(updatedRestitutions);
    form.setValue("restitutions", updatedRestitutions);
  };


  const onSubmit = async (data: OffenceFormValues) => {
    // Client-side validation: ensure at least one offence is present
    if (!data.offences || data.offences.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one offence must be added.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // If in edit mode, embed the offence ID into the payload
      const formattedData = {
        ...data,
        restitutions: data.restitutions?.map(r => ({
          ...r,
          restitutionAmount: String(r.restitutionAmount).replace(/[^\d.]/g, '')
        })),
        offences: data.offences.map((offence, index) => {
          const originalOffence = offencesSummary.find(
            (o: any) => String(o.id) === String(offenceToEditId)
          );

          // ✅ Build sentence string for convicted offences
          let sentenceString = "";
          if (offence.convictionStatus === "convicted") {
            const parts: string[] = [];
            const years = Number(offence.sentenceYears) || 0;
            const months = Number(offence.sentenceMonths) || 0;
            const days = Number(offence.sentenceDays) || 0;

            if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
            if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
            if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
            sentenceString = parts.length > 0 ? parts.join(", ") : "0 days";
          }

          return {
            ...offence,
            bailAmount: offence.bailAmount ? String(offence.bailAmount).replace(/[^\d.]/g, '') : undefined,
            fineAmount: offence.fineAmount ? String(offence.fineAmount).replace(/[^\d.]/g, '') : undefined,
            // ✅ Add computed sentence field
            sentence: offence.convictionStatus === "convicted" ? sentenceString : undefined,
            id: editMode && originalOffence ? originalOffence.id : undefined,
          };
        }),
      };

      console.log("=========================================");
      console.log("DEBUG: FIRING MAIN SUBMIT BUTTON!");
      console.log("DEBUG: Raw form data:", data);
      console.log("DEBUG: Formatted data sent to API:", formattedData);
      console.log("DEBUG: Hitting endpoint: /reception/register-offences/");
      console.log("=========================================");

      const response = await receptionApi.registerOffences(formattedData);

      console.log("DEBUG: Received response from API:", response);

      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Offence Registration Successful",
        description: editMode ? "The offence has been updated successfully." : "The inmate offences have been registered successfully.",
      });

      setTimeout(() => {
        navigate("/reception");
      }, 1500);
    } catch (error) {
      console.error("DEBUG: Offence registration completely FAILED! Error:", error);
      toast({
        title: "Registration Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!resolvedInmateId) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Inmate Selected
          </h3>
          <p className="text-gray-600 mb-4">
            Please select an inmate to register offences for.
          </p>
          <Button onClick={() => navigate("/reception")}>
            Back to Reception
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
        console.error("DEBUG: Main form validation failed. Errors:", errors);

        const extractErrors = (obj: any): string[] => {
          if (!obj) return [];
          if (typeof obj.message === 'string') return [obj.message];

          let messages: string[] = [];
          if (Array.isArray(obj)) {
            obj.forEach(item => {
              messages = [...messages, ...extractErrors(item)];
            });
          } else if (typeof obj === 'object') {
            Object.values(obj).forEach(val => {
              messages = [...messages, ...extractErrors(val)];
            });
          }
          return messages;
        };

        const errorMessages = Array.from(new Set(extractErrors(errors)));

        toast({
          title: "Form Validation Failed",
          description: (
            <div className="mt-2 text-sm">
              <p className="mb-2 font-medium">Please fix the following errors:</p>
              <ul className="list-disc pl-4 space-y-1">
                {errorMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          ),
          variant: "destructive",
        });
      })} className="space-y-8">
        {/* Inmate Info Display */}
        <Card className="p-4">
          <h3 className="text-lg font-medium mb-2">
            {editMode ? "Edit Offence For:" : "Registering Offences For:"}
          </h3>
          <p className="text-gray-600">
            Inmate ID: {resolvedInmateId}
            {inmate && (
              <span className="ml-4">
                {inmate.prison_number ? `${inmate.prison_number} - ` : ""}
                {inmate.surname} {inmate.first_name}
              </span>
            )}
          </p>
        </Card>

        {editMode && offencesSummary.length > 0 && (
          <Card className="p-4">
            <h4 className="text-md font-medium mb-3">Current Offences Summary</h4>
            <div className="space-y-3">
              {offencesSummary.map((o: any, i: number) => (
                <div key={o.id ?? i} className="text-sm border-b pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Offence #{i + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-white text-xs"
                        style={{ backgroundColor: (o.conviction_status === "convicted" ? '#ef4444' : '#f97316') }}>
                        {o.conviction_status === "convicted" ? "Convicted" : "Unconvicted"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const mappedOffence = mapOffenceToForm(o);
                          setDraftOffence(mappedOffence);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Edit/Review
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1">
                    <div><span className="font-medium">Description:</span> {o.offence_description || o.description}</div>
                    <div><span className="font-medium">Court:</span> {o.court || "-"}</div>
                    {o.conviction_status === "convicted" ? (
                      <div><span className="font-medium">Sentence:</span> {o.sentence || "-"}</div>
                    ) : (
                      <>
                        <div><span className="font-medium">Next Court Date:</span> {o.next_court_date ? new Date(o.next_court_date).toLocaleDateString() : "Not scheduled"}</div>
                        {o.remand_start_date && (
                          <div><span className="font-medium">Remand Start:</span> {new Date(o.remand_start_date).toLocaleDateString()}</div>
                        )}
                      </>
                    )}

                    {/* History Display */}
                    {o.court_history && o.court_history.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Court History:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {o.court_history.map((h: any) => (
                            <li key={h.id}>• {new Date(h.session_date).toLocaleDateString()}: {h.outcome} → Next: {new Date(h.next_court_date).toLocaleDateString()}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {o.restitution_history && o.restitution_history.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Restitution Extensions:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {o.restitution_history.map((h: any) => (
                            <li key={h.id}>• {new Date(h.date_extended).toLocaleDateString()}: Extended to {new Date(h.new_date).toLocaleDateString()}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Sentencing Strategy Toggle */}
        {(offences.some((o) => o.convictionStatus === "convicted") || draftConvictionStatus === "convicted") && (
          <Card className="p-4 border-[#d7a928] bg-[#d7a928]/10">
            <h4 className="text-md font-medium text-blue-800 mb-4">Sentencing Strategy</h4>
            <FormField
              control={form.control}
              name="sentenceGroup.isGrouped"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-[#d7a928] bg-white p-4 shadow-sm mb-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-blue-900 font-semibold">
                      Apply Grouped / Concurrent Sentence
                    </FormLabel>
                    <p className="text-sm text-blue-700">
                      Check this if the magistrate imposed a single combined sentence for all convicted offences.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {form.watch("sentenceGroup.isGrouped") && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4 p-4 bg-white rounded border border-blue-100">
                <FormField
                  control={form.control}
                  name="sentenceGroup.duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grouped Sentence Duration (Months)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sentenceGroup.date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Grouped Sentence</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </Card>
        )}

        {offences.length > 0 && (
          <Card className="p-4 border-emerald-200 bg-emerald-50/30 shadow-sm">
            <h4 className="text-md font-medium text-emerald-800 mb-3 flex items-center">
              <Check className="w-5 h-5 mr-2 text-emerald-600" />
              Added Offences (Ready to Register)
            </h4>
            <div className="overflow-x-auto rounded-md border border-emerald-100 bg-white">
              <Table>
                <TableHeader className="bg-emerald-50/50">
                  <TableRow>
                    <TableHead>Offence</TableHead>
                    <TableHead>Court</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sentence / Next Court</TableHead>
                    <TableHead>Restitution</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offences.map((o, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={o.offence}>{o.offence}</TableCell>
                      <TableCell>{o.court || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.convictionStatus === 'convicted' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                          {o.convictionStatus === 'convicted' ? 'Convicted' : 'Unconvicted'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {o.convictionStatus === 'convicted'
                          ? (`${o.sentenceYears}Y ${o.sentenceMonths}M ${o.sentenceDays}D (from ${o.sentenceDate})`)
                          : (o.nextCourtDate ? `Next Court: ${o.nextCourtDate}` : '-')
                        }
                      </TableCell>
                      <TableCell>
                        {o.hasRestitution ? <span className="text-emerald-600 font-semibold">Yes</span> : <span className="text-gray-400">No</span>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => editOffence(i)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeOffence(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-emerald-600 mt-3 text-right">
              * Please verify these details before clicking "Register Offences" below.
            </p>
          </Card>
        )}

        <Offences
          form={form}
          offences={offences}
          addOffence={addOffence}
          removeOffence={removeOffence}
          editOffence={editOffence}
          onDraftChange={(draft) => {
            setDraftConvictionStatus(draft.convictionStatus);
            setDraftHasRestitution(Boolean(draft.hasRestitution));
          }}
          draftOffence={draftOffence}
          onDraftOffenceChange={setDraftOffence}
          isGrouped={form.watch("sentenceGroup.isGrouped")}
        />

        {/* Show Restitution if any offence (or current draft) is convicted AND has restitution */}
        {(offences.some((o) => o.convictionStatus === "convicted" && o.hasRestitution) ||
          (draftConvictionStatus === "convicted" && draftHasRestitution)) && (
            <div className="space-y-2">
              <Restitution
                form={form}
                restitutions={restitutions}
                offences={[
                  ...offences,
                  ...(draftConvictionStatus === "convicted" && draftHasRestitution
                    ? [draftOffence]
                    : [])
                ]}
                addRestitution={addRestitution}
                removeRestitution={removeRestitution}
              />
              {/* Display real-time validation errors for missing restitution records */}
              {form.formState.errors.restitutions?.root?.message && (
                <p className="text-sm font-medium text-destructive px-2">
                  {form.formState.errors.restitutions.root.message}
                </p>
              )}
              {form.formState.errors.restitutions?.message && typeof form.formState.errors.restitutions.message === "string" && (
                <p className="text-sm font-medium text-destructive px-2">
                  {form.formState.errors.restitutions.message}
                </p>
              )}
            </div>
          )}

        {/* Show ReleaseDates if any offence (or current draft) is convicted */}
        {(offences.some((o) => o.convictionStatus === "convicted") ||
          draftConvictionStatus === "convicted") && (
            <ReleaseDates form={form} />
          )}

        {/* Reclassification (Optional) */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium">Reclassification</h3>
              <p className="text-sm text-muted-foreground">
                Optionally update the inmate's classification based on the court outcome.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="reclassification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Class (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="PUSOD">PUSOD</SelectItem>
                      <SelectItem value="CONDEM">CONDEM</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/reception")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#0b4f2a] hover:bg-[#063f20] text-white font-medium"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>Processing...</>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {editMode ? "Save Changes" : "Register Offences"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default OffenceRegistrationForm;
