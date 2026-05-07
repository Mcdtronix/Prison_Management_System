import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Trash2, Pencil } from "lucide-react";
import { receptionApi } from "@/lib/api";
import { useNavigate, useParams, useLocation } from "react-router-dom";

// Form Sections
import Offences from "./Offences";
import ReleaseDates from "./ReleaseDates";
import Restitution from "./Restitution";

// Base schema for common offence fields
const baseOffenceSchema = z.object({
  offence: z.string().min(1, "Offence description is required"),
  furtherCharge: z.string().optional(),
  court: z.string().min(1, "Court is required"),
  hasRestitution: z.boolean().optional(),
});

// Schema for convicted and unconvicted offences using a discriminated union
export const offenceDataSchema = z.discriminatedUnion("convictionStatus", [
  z.object({
    convictionStatus: z.literal("convicted"),
    sentence: z.string().min(1, "Sentence is required for convicted status"),
    sentenceDate: z.string().min(1, "Sentence date is required for convicted status"),
    nextCourtDate: z.string().optional(), // Ensure it's optional here
  }).merge(baseOffenceSchema),
  z.object({
    convictionStatus: z.literal("unconvicted"),
    nextCourtDate: z.string().min(1, "Next court date is required for unconvicted status"),
    remandStartDate: z.string().optional(),
    sentence: z.string().optional(), // Ensure it's optional here
    sentenceDate: z.string().optional(), // Ensure it's optional here
  }).merge(baseOffenceSchema),
]);

export const releaseDatesSchema = z.object({
  sentence: z.string().min(1, "Total sentence summary is required"),
  earliestDateOfRelease: z.string().min(1, "Earliest date of release is required"),
  remission: z.string().min(1, "Remission is required"),
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
    furtherCharge: '',
    court: '',
    sentence: '',
    sentenceDate: '',
    nextCourtDate: '',
    remandStartDate: '',
    hasRestitution: false,
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
        furtherCharge: '',
        court: '',
        sentence: '',
        sentenceDate: '',
        nextCourtDate: '',
        remandStartDate: '',
        hasRestitution: false,
      };
    }

    const convictionStatus =
      o.conviction_status === "convicted" ? "convicted" : "unconvicted";
    const mapped: any = {
      convictionStatus,
      offence: o.offence_description || o.description || "",
      furtherCharge: o.further_charge || "",
      court: o.court || "",
      hasRestitution: Boolean(o.restitution_amount),
    };

    if (convictionStatus === "convicted") {
      mapped.sentence = o.sentence || "";
      mapped.sentenceDate = o.date_of_sentence
        ? new Date(o.date_of_sentence).toISOString().split('T')[0]
        : "";
      mapped.nextCourtDate = "";
    } else {
      mapped.nextCourtDate = o.next_court_date
        ? new Date(o.next_court_date).toISOString().split('T')[0]
        : "";
      mapped.remandStartDate = o.remand_start_date
        ? new Date(o.remand_start_date).toISOString().split('T')[0]
        : "";
      mapped.sentence = "";
      mapped.sentenceDate = "";
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
    },
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
        offences: data.offences.map((offence, index) => {
          // Find the corresponding original offence from the summary to get its ID
          const originalOffence = offencesSummary.find(
            (o: any) => String(o.id) === String(offenceToEditId)
          );
          return {
            ...offence,
            id: editMode && originalOffence ? originalOffence.id : undefined,
          };
        }),
      };

      console.log("=== OFFENCE FORM SUBMISSION: Prepared data ===");
      console.log("Raw form data:", data);
      console.log("Formatted data:", formattedData);

      const response = await receptionApi.registerOffences(formattedData);

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
      console.error("Offence registration failed:", error);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                        style={{backgroundColor: (o.conviction_status === "convicted" ? '#ef4444' : '#f97316')}}>
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
        />

        {/* Show Restitution if any offence (or current draft) is convicted AND has restitution */}
        {(offences.some((o) => o.convictionStatus === "convicted" && o.hasRestitution) ||
          (draftConvictionStatus === "convicted" && draftHasRestitution)) && (
            <Restitution
              form={form}
              restitutions={restitutions}
              offences={offences}
              addRestitution={addRestitution}
              removeRestitution={removeRestitution}
            />
        )}

        {/* Show ReleaseDates if any offence (or current draft) is convicted */}
        {(offences.some((o) => o.convictionStatus === "convicted") ||
          draftConvictionStatus === "convicted") && (
            <ReleaseDates form={form} />
        )}

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
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
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
