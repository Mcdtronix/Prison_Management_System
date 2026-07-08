import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import { receptionApi } from "@/lib/api";
import { useNavigate } from "react-router-dom";

// Form Sections
import InmateDetails from "./InmateDetails";
import NextOfKin from "./NextOfKin";
import Offences from "./Offences";
import Classification from "./Classification";
import ReleaseDates from "./ReleaseDates";
import Restitution from "./Restitution";
import InmateValuables from "./InmateValuables";

// Define the schema for each section
export const inmateDetailsSchema = z.object({
  prison_number: z.string().min(1, "Prison number is required"),
  first_name: z.string().min(1, "First name is required"),
  surname: z.string().min(1, "Surname is required"),
  other_names: z.string().optional(),
  gender: z.enum(["Male", "Female"]),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  nationality: z.string().min(1, "Nationality is required"),
  national_id: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  marital_status: z.enum(["Single", "Married", "Divorced", "Widowed"]),
  educational_level: z.string().min(1, "Educational level is required"),
  race: z.string().min(1, "Race is required"),
  headman: z.string().optional(),
  chief: z.string().optional(),
  district: z.string().min(1, "District is required"),
  occupation: z.string().optional(),
  is_first_time_offender: z.boolean(),
  inmate_image: z.any().optional(), // For file upload
});

export const nextOfKinSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  address: z.string().min(1, "Address is required"),
  contact: z.string().min(1, "Contact is required"),
});

export const offenceSchema = z.object({
  offence: z.string().min(1, "Offence description is required"),
  convictionStatus: z.enum(["convicted", "unconvicted"]),
  furtherCharge: z.string().optional(),
  court: z.string().min(1, "Court is required"),
  sentence: z.string().optional(),
  sentenceDate: z.string().optional(),
  remission: z.string().optional(),
  nextCourtDate: z.string().optional(),
});

export const classificationSchema = z.object({
  classification: z.enum(["A", "B", "C", "D", "COND", "PUSOD"]),
  reason: z.string().min(1, "Reason for classification is required"),
  authorizedBy: z.string().min(1, "Authorization is required"),
});

export const releaseDatesSchema = z.object({
  sentence: z.string().optional(),
  earliestDateOfRelease: z.string().optional(),
});

export const restitutionSchema = z.object({
  offenceIndex: z.number().min(0, "Related offence is required"),
  restitutionAmount: z.string().min(1, "Restitution amount is required"),
  restitutionDate: z.string().min(1, "Restitution date is required"),
  restitutionSentence: z.string().optional(),
  restitutionStatus: z
    .enum(["pending", "partial", "paid", "waived"])
    .default("pending"),
  earliestDateOfReleaseWithRestitution: z.string().optional(),
  restitutionReceipt: z.any().optional(), // For file upload
});

export const inmateValuablesSchema = z.object({
  bagNo: z.string().min(1, "Bag number is required"),
  cash: z.string().optional(),
  tShirt: z.number().int().min(0).optional(),
  shorts: z.number().int().min(0).optional(),
  belt: z.number().int().min(0).optional(),
  shoes: z.number().int().min(0).optional(),
  socks: z.number().int().min(0).optional(),
  jersey: z.number().int().min(0).optional(),
  wallet: z.number().int().min(0).optional(),
  others: z.string().optional(),
});

// Combined schema for the entire form
const formSchema = z.object({
  inmateDetails: inmateDetailsSchema,
  nextOfKin: nextOfKinSchema,
  offences: z.array(offenceSchema).min(1, "At least one offence must be added"),
  classification: classificationSchema,
  releaseDates: releaseDatesSchema,
  restitutions: z.array(restitutionSchema),
  inmateValuables: inmateValuablesSchema,
});

export type FormValues = z.infer<typeof formSchema>;

const InmateForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offences, setOffences] = useState<z.infer<typeof offenceSchema>[]>([]);
  const [restitutions, setRestitutions] = useState<
    z.infer<typeof restitutionSchema>[]
  >([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inmateDetails: {
        prison_number: "",
        first_name: "",
        surname: "",
        other_names: "",
        gender: "Male",
        date_of_birth: "",
        nationality: "",
        national_id: "",
        address: "",
        marital_status: "Single",
        educational_level: "",
        race: "",
        headman: "",
        chief: "",
        district: "",
        occupation: "",
        is_first_time_offender: true,
        inmate_image: null,
      },
      nextOfKin: {
        full_name: "",
        relationship: "",
        address: "",
        contact: "",
      },
      offences: [],
      classification: {
        classification: "D",
        reason: "",
        authorizedBy: "",
      },
      releaseDates: {
        sentence: "",
        earliestDateOfRelease: "",
      },
      restitutions: [],
      inmateValuables: {
        bagNo: "",
        cash: "",
        tShirt: 0,
        shorts: 0,
        belt: 0,
        shoes: 0,
        socks: 0,
        jersey: 0,
        wallet: 0,
        others: "",
      },
    },
  });

  // Add offence to the list
  const addOffence = (offence: z.infer<typeof offenceSchema>) => {
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

  // Calculate remission (1/3 of sentence) and earliest date of release
  const calculateRemission = (sentence: string) => {
    // This is a placeholder - actual implementation would depend on sentence format
    return `${parseInt(sentence) / 3} months`;
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      // Format data for API if needed
      const formattedData = {
        ...data,
        // Any additional formatting if needed
      };

      console.log("=== FORM SUBMISSION: Prepared data ===");
      console.log("Raw form data:", data);
      console.log("Formatted data:", formattedData);
      console.log(
        "Inmate details keys:",
        Object.keys(formattedData.inmateDetails || {}),
      );
      console.log("Offences:", formattedData.offences);
      console.log("Restitutions:", formattedData.restitutions);

      const response = await receptionApi.registerInmate(formattedData);

      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Registration Successful",
        description: "The inmate has been registered and is pending approval.",
      });

      setTimeout(() => {
        navigate("/reception");
      }, 1500);
    } catch (error) {
      console.error("Registration failed:", error);
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <InmateDetails form={form} />
        <NextOfKin form={form} />
        <Offences
          form={form}
          offences={offences}
          addOffence={addOffence}
          removeOffence={removeOffence}
          calculateRemission={calculateRemission}
        />
        <Classification form={form} />
        <ReleaseDates form={form} />
        <Restitution
          form={form}
          restitutions={restitutions}
          offences={offences}
          addRestitution={addRestitution}
          removeRestitution={removeRestitution}
        />
        <InmateValuables form={form} />

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
                <UserPlus className="h-4 w-4 mr-2" />
                Register Inmate
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default InmateForm;
