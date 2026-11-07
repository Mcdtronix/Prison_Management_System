import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { useFieldArray, useForm, UseFormReturn, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Briefcase,
  Home,
  ImageIcon,
  Loader2,
  Plus,
  ShieldCheck,
  User,
  UserPlus,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { receptionApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const optionalText = z.string().optional();

export const basicInmateDetailsSchema = z.object({
  admission_type: z.enum(["NEW_ADMISSION", "TRANSFER"]),
  prison_number: z.string().regex(/^\d{4}\/\d{2}$/, "Prison number must be in the format 0001/25 (4 digits, slash, 2 digits)").optional().or(z.literal('')),
  crb_number: optionalText,
  first_name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  other_names: optionalText,
  gender: z.enum(["Male", "Female"]),
  date_of_birth: z.string().min(1, "Date of birth is required").refine((date) => {
    return new Date(date) < new Date();
  }, { message: "Date of birth must be in the past" }),
  nationality: z.string().min(1, "Nationality is required"),
  national_id: z.string().regex(/^[0-9]{2}-[0-9]{6,7}\s?[A-Za-z]\s?[0-9]{2}$/, "Invalid National ID format. Example: 12-345678 A 90").optional().or(z.literal('')),
  address: z.string().min(1, "Address is required"),
  marital_status: z.enum(["Single", "Married", "Divorced", "Widowed"]),
  educational_level: z.string().min(1, "Educational level is required"),
  race: optionalText,
  fathers_name: z.string().max(150, "Father's name must be 150 characters or fewer").optional(),
  headman: optionalText,
  chief: optionalText,
  district: optionalText,
  occupation: optionalText,
  is_first_time_offender: z.boolean(),
  inmate_image: z.any().optional(),
});

export const basicNextOfKinSchema = z.object({
  full_name: optionalText,
  relationship: optionalText,
  address: optionalText,
  contact: optionalText,
});

/** Currencies accepted into safekeeping. Codes match InmateCashHolding.CURRENCY_CHOICES. */
export const CASH_CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "ZWG", label: "Zimbabwe Gold" },
  { code: "ZAR", label: "South African Rand" },
  { code: "BWP", label: "Botswana Pula" },
  { code: "GBP", label: "British Pound" },
  { code: "EUR", label: "Euro" },
] as const;

const cashHoldingSchema = z.object({
  currency: z.string().min(1, "Select a currency"),
  amount: z
    .string()
    .min(1, "Enter the amount")
    .regex(/^\d+(\.\d{1,2})?$/, "Use a number with up to 2 decimals, e.g. 150.50")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
});

export const basicInmateValuablesSchema = z.object({
  bagNo: optionalText,
  cashHoldings: z.array(cashHoldingSchema).superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (!row.currency) return;
      if (seen.has(row.currency)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "currency"],
          message: `${row.currency} is already listed. Add it to the existing line.`,
        });
      }
      seen.add(row.currency);
    });
  }),
  shorts: optionalText,
  shortsColor: optionalText,
  tShirt: optionalText,
  tShirtColor: optionalText,
  trousers: optionalText,
  trousersColor: optionalText,
  skirt: optionalText,
  skirtColor: optionalText,
  dress: optionalText,
  dressColor: optionalText,
  cap: optionalText,
  capColor: optionalText,
  blouse: optionalText,
  blouseColor: optionalText,
  shoes: optionalText,
  shoesColor: optionalText,
  wallet: optionalText,
  walletColor: optionalText,
  jersey: optionalText,
  jerseyColor: optionalText,
  wallets: optionalText,
  walletsColor: optionalText,
  socks: optionalText,
  socksColor: optionalText,
  others: optionalText,
});

const basicFormSchema = z.object({
  inmateDetails: basicInmateDetailsSchema,
  nextOfKin: basicNextOfKinSchema,
  inmateValuables: basicInmateValuablesSchema,
});

export type BasicFormValues = z.infer<typeof basicFormSchema>;

/* ------------------------------------------------------------------ */
/* Reference lists                                                     */
/* ------------------------------------------------------------------ */

const colorOptions = [
  "Black",
  "White",
  "Blue",
  "Red",
  "Green",
  "Grey",
  "Brown",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Multi-colour",
];

const nationalityOptions = [
  "Zimbabwean",
  "South African",
  "Mozambican",
  "Zambian",
  "Malawian",
  "Botswanan",
  "Namibian",
  "Other",
];

const educationalLevelOptions = [
  "Primary",
  "Ordinary Level",
  "Advanced Level",
  "Tertiary Level",
];

const raceOptions = [
  "Zimbabwean",
  "African",
  "White",
  "Coloured",
  "Asian",
  "Other",
];

const zimbabweDistrictOptions = [
  "Beitbridge", "Bikita", "Bindura", "Binga", "Bubi", "Buhera", "Bulawayo",
  "Bulilima", "Centenary", "Chegutu", "Chikomba", "Chimanimani", "Chipinge",
  "Chiredzi", "Chirumhanzu", "Chivi", "Gokwe North", "Gokwe South",
  "Goromonzi", "Guruve", "Gutu", "Gwanda", "Gweru", "Harare", "Hurungwe",
  "Hwange", "Insiza", "Kadoma", "Kariba", "Kwekwe", "Lupane", "Makonde",
  "Makoni", "Mangwe", "Marondera", "Masvingo", "Matobo", "Mazowe",
  "Mberengwa", "Mbire", "Mhondoro-Ngezi", "Mount Darwin", "Mudzi", "Murehwa",
  "Mutare", "Mutasa", "Mwenezi", "Nkayi", "Nyanga", "Rushinga", "Sanyati",
  "Shamva", "Seke", "Shurugwi", "Tsholotsho", "Umguza", "UMP",
  "Uzumba-Maramba-Pfungwe", "Wedza", "Zaka", "Zvimba", "Zvishavane",
];

const nextOfKinRelationshipOptions = [
  "Mother", "Father", "Sister", "Brother", "Wife", "Husband", "Daughter",
  "Son", "Aunt", "Uncle", "Grandmother", "Grandfather", "Guardian", "Cousin",
  "Friend", "Other",
];

/** Clothing items logged into the property bag. Order matches the backend. */
const clothingItems = [
  { key: "shorts", colorKey: "shortsColor", label: "Shorts" },
  { key: "tShirt", colorKey: "tShirtColor", label: "T-shirts" },
  { key: "trousers", colorKey: "trousersColor", label: "Trousers" },
  { key: "skirt", colorKey: "skirtColor", label: "Skirt" },
  { key: "dress", colorKey: "dressColor", label: "Dress" },
  { key: "cap", colorKey: "capColor", label: "Cap" },
  { key: "blouse", colorKey: "blouseColor", label: "Blouse" },
  { key: "shoes", colorKey: "shoesColor", label: "Shoes" },
  { key: "wallet", colorKey: "walletColor", label: "Wallet" },
  { key: "jersey", colorKey: "jerseyColor", label: "Jersey" },
  { key: "wallets", colorKey: "walletsColor", label: "Wallets" },
  { key: "socks", colorKey: "socksColor", label: "Socks" },
] as const;

/** Form sections, in display order, with the fields each one owns. */
const SECTIONS = [
  {
    id: "prison",
    title: "Prison Details",
    description: "Admission type and the identifiers issued at reception.",
    icon: ShieldCheck,
    fields: ["inmateDetails.admission_type", "inmateDetails.prison_number", "inmateDetails.crb_number"],
  },
  {
    id: "personal",
    title: "Personal Particulars",
    description: "Identity of the inmate as stated on their documents.",
    icon: User,
    fields: [
      "inmateDetails.first_name", "inmateDetails.surname", "inmateDetails.other_names",
      "inmateDetails.gender", "inmateDetails.date_of_birth", "inmateDetails.nationality",
      "inmateDetails.national_id", "inmateDetails.address", "inmateDetails.marital_status",
      "inmateDetails.educational_level",
    ],
  },
  {
    id: "home",
    title: "Local Home History",
    description: "Family and traditional-authority particulars of the inmate's home area.",
    icon: Home,
    fields: [
      "inmateDetails.race", "inmateDetails.fathers_name", "inmateDetails.headman",
      "inmateDetails.chief", "inmateDetails.district", "inmateDetails.occupation",
      "inmateDetails.inmate_image",
    ],
  },
  {
    id: "kin",
    title: "Next of Kin",
    description: "Person to contact on the inmate's behalf. Saved only when all four fields are filled.",
    icon: Users,
    fields: ["nextOfKin.full_name", "nextOfKin.relationship", "nextOfKin.address", "nextOfKin.contact"],
  },
  {
    id: "valuables",
    title: "Property & Valuables",
    description: "Items taken into safekeeping at reception. Tick each item and record its colour.",
    icon: Briefcase,
    fields: ["inmateValuables.bagNo", "inmateValuables.cashHoldings", "inmateValuables.others"],
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const errorAt = (errors: FieldErrors<BasicFormValues>, path: string) =>
  path.split(".").reduce<any>((node, key) => node?.[key], errors);

/* ------------------------------------------------------------------ */
/* Field primitives                                                    */
/* ------------------------------------------------------------------ */

const RequiredMark = () => (
  <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
);

const FieldInput = ({
  form,
  name,
  label,
  placeholder,
  description,
  type = "text",
  required = false,
  className,
}: {
  form: UseFormReturn<BasicFormValues>;
  name: any;
  label: string;
  placeholder?: string;
  description?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className={className}>
        <FormLabel>
          {label}
          {required && <RequiredMark />}
        </FormLabel>
        <FormControl>
          <Input type={type} placeholder={placeholder} {...field} value={field.value ?? ""} />
        </FormControl>
        {description && <FormDescription>{description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )}
  />
);

const FieldSelect = ({
  form,
  name,
  label,
  options,
  placeholder,
  required = false,
}: {
  form: UseFormReturn<BasicFormValues>;
  name: any;
  label: string;
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  required?: boolean;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          {label}
          {required && <RequiredMark />}
        </FormLabel>
        <Select onValueChange={field.onChange} value={field.value || ""}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((option) => {
              const value = typeof option === "string" ? option : option.value;
              const text = typeof option === "string" ? option : option.label;
              return (
                <SelectItem key={value} value={value}>
                  {text}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);

const FormSection = ({
  index,
  section,
  hasError,
  children,
}: {
  index: number;
  section: (typeof SECTIONS)[number];
  hasError: boolean;
  children: ReactNode;
}) => {
  const Icon = section.icon;
  return (
    <section
      id={`section-${section.id}`}
      aria-labelledby={`section-${section.id}-title`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-lg border bg-white shadow-sm",
        hasError ? "border-red-300" : "border-slate-200",
      )}
    >
      <header className="flex items-start gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0b4f2a] text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0b4f2a]">
            Section {index + 1}
          </p>
          <h2 id={`section-${section.id}-title`} className="text-base font-semibold text-slate-900">
            {section.title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
        </div>
        {hasError && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Needs attention
          </span>
        )}
      </header>
      <div className="px-5 py-6 sm:px-6">{children}</div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

const BasicInmateForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const form = useForm<BasicFormValues>({
    resolver: zodResolver(basicFormSchema),
    mode: "all",
    defaultValues: {
      inmateDetails: {
        admission_type: "NEW_ADMISSION",
        prison_number: "",
        crb_number: "",
        first_name: "",
        surname: "",
        other_names: "",
        gender: "Male",
        date_of_birth: "",
        nationality: "Zimbabwean",
        national_id: "",
        address: "",
        marital_status: "Single",
        educational_level: "Ordinary Level",
        race: "Zimbabwean",
        fathers_name: "",
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
      inmateValuables: {
        bagNo: "",
        cashHoldings: [],
        shorts: "",
        shortsColor: "",
        tShirt: "",
        tShirtColor: "",
        trousers: "",
        trousersColor: "",
        skirt: "",
        skirtColor: "",
        dress: "",
        dressColor: "",
        cap: "",
        capColor: "",
        blouse: "",
        blouseColor: "",
        shoes: "",
        shoesColor: "",
        wallet: "",
        walletColor: "",
        jersey: "",
        jerseyColor: "",
        wallets: "",
        walletsColor: "",
        socks: "",
        socksColor: "",
        others: "",
      },
    },
  });

  const valuables = form.watch("inmateValuables");
  const cashRows = useFieldArray({ control: form.control, name: "inmateValuables.cashHoldings" });
  const usedCurrencies = (valuables?.cashHoldings ?? []).map((row) => row.currency);
  const nextFreeCurrency = CASH_CURRENCIES.find((c) => !usedCurrencies.includes(c.code))?.code;
  const { errors, submitCount } = form.formState;
  const itemsLogged = clothingItems.filter((item) => Boolean((valuables as any)?.[item.key])).length;

  // Only flag sections once the officer has tried to submit, so a fresh form isn't covered in red.
  const sectionHasError = (id: SectionId) =>
    submitCount > 0 &&
    SECTIONS.find((s) => s.id === id)!.fields.some((path) => Boolean(errorAt(errors, path)));

  // Release the preview URL when the photo changes or the form unmounts.
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const scrollToSection = (id: SectionId) =>
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onInvalid = (formErrors: FieldErrors<BasicFormValues>) => {
    const first = SECTIONS.find((s) => s.fields.some((path) => Boolean(errorAt(formErrors, path))));
    toast({
      title: "Registration incomplete",
      description: first
        ? `Please correct the highlighted fields in “${first.title}”.`
        : "Please correct the highlighted fields.",
      variant: "destructive",
    });
    if (first) scrollToSection(first.id);
  };

  const onSubmit = async (data: BasicFormValues) => {
    setIsSubmitting(true);

    try {
      // 1. Real-time unique validation for prison_number and national_id
      const validationResponse = await receptionApi.validateInmateUnique({
        prison_number: data.inmateDetails.prison_number,
        national_id: data.inmateDetails.national_id,
      });

      if (validationResponse.error && validationResponse.errors) {
        const errors = validationResponse.errors;
        let hasError = false;
        if (errors.prison_number) {
          form.setError("inmateDetails.prison_number", { type: "manual", message: errors.prison_number[0] });
          hasError = true;
        }
        if (errors.national_id) {
          form.setError("inmateDetails.national_id", { type: "manual", message: errors.national_id[0] });
          hasError = true;
        }
        if (hasError) {
          setIsSubmitting(false);
          toast({
            title: "Validation Failed",
            description: "Please check the form for errors.",
            variant: "destructive",
          });
          // Focus the first field with error to smoothly redirect the user
          if (errors.prison_number) {
            form.setFocus("inmateDetails.prison_number");
          } else if (errors.national_id) {
            form.setFocus("inmateDetails.national_id");
          }
          return;
        }
      }

      // 2. Submit the data
      const payload = {
        ...data,
        inmateDetails: {
          ...data.inmateDetails,
          inmate_image: null,
        },
      };
      const response = await receptionApi.registerBasicInmate(payload);

      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Registration Successful",
        description: "The required inmate details were saved.",
      });

      const inmateId = response.data?.data?.id || response.data?.id;
      if (inmateId) {
        navigate(`/reception/register-offences/${inmateId}`);
      } else {
        navigate("/reception");
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [prison, personal, home, kin, property] = SECTIONS;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
        {/* Section index */}
        <nav
          aria-label="Form sections"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ol className="flex flex-wrap gap-2">
              {SECTIONS.map((section, index) => {
                const flagged = sectionHasError(section.id);
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        flagged
                          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border-slate-200 text-slate-600 hover:border-[#0b4f2a]/40 hover:text-[#0b4f2a]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
                          flagged ? "bg-red-600 text-white" : "bg-[#0b4f2a]/10 text-[#0b4f2a]",
                        )}
                      >
                        {index + 1}
                      </span>
                      {section.title}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-slate-500">
              Fields marked <RequiredMark /> are required.
            </p>
          </div>
        </nav>

        {/* 1. Prison details */}
        <FormSection index={0} section={prison} hasError={sectionHasError("prison")}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldSelect
              form={form}
              name="inmateDetails.admission_type"
              label="Admission Type"
              options={[
                { value: "NEW_ADMISSION", label: "New Admission" },
                { value: "TRANSFER", label: "Transfer" },
              ]}
              required
            />
            <FieldInput
              form={form}
              name="inmateDetails.prison_number"
              label="Prison Number"
              placeholder="0001/26"
              description="Format: four digits, slash, two-digit year."
            />
            <FieldInput form={form} name="inmateDetails.crb_number" label="CRB Number" placeholder="Optional" />
            <FormField
              control={form.control}
              name="inmateDetails.is_first_time_offender"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3 md:mt-8">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="m-0">First-time offender</FormLabel>
                    <FormDescription className="text-xs">
                      Untick if the inmate has a previous conviction.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* 2. Personal particulars */}
        <FormSection index={1} section={personal} hasError={sectionHasError("personal")}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FieldInput form={form} name="inmateDetails.first_name" label="Name" required />
            <FieldInput form={form} name="inmateDetails.surname" label="Surname" required />
            <FieldInput form={form} name="inmateDetails.other_names" label="Other Names" placeholder="Optional" />
            <FieldSelect
              form={form}
              name="inmateDetails.gender"
              label="Gender"
              options={["Male", "Female"]}
              required
            />
            <FieldInput form={form} name="inmateDetails.date_of_birth" label="Date of Birth" type="date" required />
            <FieldSelect
              form={form}
              name="inmateDetails.nationality"
              label="Nationality"
              options={nationalityOptions}
              required
            />
            <FieldInput
              form={form}
              name="inmateDetails.national_id"
              label="National ID"
              placeholder="12-345678 A 90"
              description="Optional. Must be unique."
            />
            <FieldSelect
              form={form}
              name="inmateDetails.marital_status"
              label="Marital Status"
              options={["Single", "Married", "Divorced", "Widowed"]}
              required
            />
            <FieldSelect
              form={form}
              name="inmateDetails.educational_level"
              label="Educational Level"
              options={educationalLevelOptions}
              required
            />
            <FieldInput
              form={form}
              name="inmateDetails.address"
              label="Residential Address"
              placeholder="House number, street, suburb / village"
              required
              className="md:col-span-2 lg:col-span-3"
            />
          </div>
        </FormSection>

        {/* 3. Local home history */}
        <FormSection index={2} section={home} hasError={sectionHasError("home")}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_200px]">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FieldInput
                form={form}
                name="inmateDetails.fathers_name"
                label="Father's Name"
                placeholder="Full name of the inmate's father"
                className="md:col-span-2"
              />
              <FieldSelect form={form} name="inmateDetails.race" label="Race" options={raceOptions} />
              <FieldSelect
                form={form}
                name="inmateDetails.district"
                label="District"
                options={zimbabweDistrictOptions}
              />
              <FieldInput form={form} name="inmateDetails.chief" label="Chief" />
              <FieldInput form={form} name="inmateDetails.headman" label="Headman" />
              <FieldInput
                form={form}
                name="inmateDetails.occupation"
                label="Occupation"
                placeholder="Before admission"
                className="md:col-span-2"
              />
            </div>

            <FormField
              control={form.control}
              name="inmateDetails.inmate_image"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Inmate Photo</FormLabel>
                  <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Selected inmate photo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 px-3 text-center text-xs text-slate-400">
                        <ImageIcon className="h-8 w-8" aria-hidden="true" />
                        No photo selected
                      </div>
                    )}
                  </div>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      className="text-xs"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        onChange(file);
                        setPhotoPreview(file ? URL.createObjectURL(file) : null);
                      }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* 4. Next of kin */}
        <FormSection index={3} section={kin} hasError={sectionHasError("kin")}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldInput form={form} name="nextOfKin.full_name" label="Full Name" />
            <FieldSelect
              form={form}
              name="nextOfKin.relationship"
              label="Relationship"
              options={nextOfKinRelationshipOptions}
            />
            <FieldInput form={form} name="nextOfKin.address" label="Address" />
            <FieldInput form={form} name="nextOfKin.contact" label="Contact Number" placeholder="e.g. 0771 234 567" />
          </div>
        </FormSection>

        {/* 5. Property & valuables */}
        <FormSection index={4} section={property} hasError={sectionHasError("valuables")}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldInput form={form} name="inmateValuables.bagNo" label="Property Bag Number" />
          </div>

          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Cash held</h3>
                <p className="text-xs text-slate-500">
                  Record each currency on its own line, in that currency. Amounts are never converted.
                </p>
              </div>
              {cashRows.fields.length > 0 && (
                <span className="text-xs text-slate-500">
                  {cashRows.fields.length} {cashRows.fields.length === 1 ? "currency" : "currencies"}
                </span>
              )}
            </div>

            {cashRows.fields.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                No cash recorded.
              </div>
            ) : (
              <ul className="space-y-2">
                {cashRows.fields.map((row, index) => (
                  <li
                    key={row.id}
                    className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[240px_1fr_auto]"
                  >
                    <FormField
                      control={form.control}
                      name={`inmateValuables.cashHoldings.${index}.currency` as const}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-slate-600">Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger aria-label={`Currency, line ${index + 1}`}>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CASH_CURRENCIES.map((c) => (
                                <SelectItem
                                  key={c.code}
                                  value={c.code}
                                  disabled={c.code !== field.value && usedCurrencies.includes(c.code)}
                                >
                                  <span className="font-mono font-semibold">{c.code}</span>
                                  <span className="ml-2 text-slate-500">{c.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:order-last"
                      onClick={() => cashRows.remove(index)}
                      aria-label={`Remove cash line ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <FormField
                      control={form.control}
                      name={`inmateValuables.cashHoldings.${index}.amount` as const}
                      render={({ field }) => (
                        <FormItem className="col-span-2 space-y-1 sm:col-span-1">
                          <FormLabel className="text-xs text-slate-600">Amount</FormLabel>
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs font-semibold text-slate-500">
                              {valuables?.cashHoldings?.[index]?.currency || "---"}
                            </span>
                            <FormControl>
                              <Input
                                inputMode="decimal"
                                placeholder="0.00"
                                className="pl-14 text-right tabular-nums"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={!nextFreeCurrency}
              onClick={() => cashRows.append({ currency: nextFreeCurrency ?? "", amount: "" })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {cashRows.fields.length === 0 ? "Add cash" : "Add another currency"}
            </Button>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Clothing & personal items</h3>
              <span className="text-xs text-slate-500">
                {itemsLogged} of {clothingItems.length} logged
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {clothingItems.map((item) => {
                const selected = Boolean((valuables as any)?.[item.key]);
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                      selected ? "border-[#0b4f2a]/40 bg-[#0b4f2a]/[0.04]" : "border-slate-200",
                    )}
                  >
                    <FormField
                      control={form.control}
                      name={`inmateValuables.${item.key}` as any}
                      render={({ field }) => (
                        <FormItem className="flex min-w-0 flex-1 items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={Boolean(field.value)}
                              onCheckedChange={(checked) => {
                                field.onChange(checked ? "yes" : "");
                                if (!checked) {
                                  form.setValue(`inmateValuables.${item.colorKey}` as any, "");
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="m-0 cursor-pointer truncate font-medium">{item.label}</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`inmateValuables.${item.colorKey}` as any}
                      render={({ field }) => (
                        <FormItem className="w-36 shrink-0 space-y-0">
                          <Select disabled={!selected} onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-xs" aria-label={`${item.label} colour`}>
                                <SelectValue placeholder="Colour" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {colorOptions.map((color) => (
                                <SelectItem key={color} value={color}>
                                  {color}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <FormField
            control={form.control}
            name="inmateValuables.others"
            render={({ field }) => (
              <FormItem className="mt-6">
                <FormLabel>Other Items</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Describe any other property, e.g. phone (Nokia, black), watch, ID card"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Offences are recorded on the next step, once these details are saved.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/reception")}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#0b4f2a] font-medium text-white hover:bg-[#063f20]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering…
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register Inmate
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default BasicInmateForm;
