import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
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

const optionalText = z.string().optional();

export const basicInmateDetailsSchema = z.object({
  admission_type: z.enum(["NEW_ADMISSION", "TRANSFER"]),
  prison_number: z.string().regex(/^\d{4}\/\d{2}$/, "Prison number must be in the format 0001/25 (4 digits, slash, 2 digits)"),
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

export const basicInmateValuablesSchema = z.object({
  bagNo: optionalText,
  cash: optionalText,
  shorts: optionalText,
  shortsColor: optionalText,
  tShirt: optionalText,
  tShirtColor: optionalText,
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

const FieldInput = ({
  form,
  name,
  label,
  placeholder,
  type = "text",
}: {
  form: UseFormReturn<BasicFormValues>;
  name: any;
  label: string;
  placeholder?: string;
  type?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input type={type} placeholder={placeholder} {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

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
  "Beitbridge",
  "Bikita",
  "Bindura",
  "Binga",
  "Bubi",
  "Buhera",
  "Bulawayo",
  "Bulilima",
  "Centenary",
  "Chegutu",
  "Chikomba",
  "Chimanimani",
  "Chipinge",
  "Chiredzi",
  "Chirumhanzu",
  "Chivi",
  "Gokwe North",
  "Gokwe South",
  "Goromonzi",
  "Guruve",
  "Gutu",
  "Gwanda",
  "Gweru",
  "Harare",
  "Hurungwe",
  "Hwange",
  "Insiza",
  "Kadoma",
  "Kariba",
  "Kwekwe",
  "Lupane",
  "Makonde",
  "Makoni",
  "Mangwe",
  "Marondera",
  "Masvingo",
  "Matobo",
  "Mazowe",
  "Mberengwa",
  "Mbire",
  "Mhondoro-Ngezi",
  "Mount Darwin",
  "Mudzi",
  "Murehwa",
  "Mutare",
  "Mutasa",
  "Mwenezi",
  "Nkayi",
  "Nyanga",
  "Rushinga",
  "Sanyati",
  "Shamva",
  "Seke",
  "Shurugwi",
  "Tsholotsho",
  "Umguza",
  "UMP",
  "Uzumba-Maramba-Pfungwe",
  "Wedza",
  "Zaka",
  "Zvimba",
  "Zvishavane",
];

const nextOfKinRelationshipOptions = [
  "Mother",
  "Father",
  "Sister",
  "Brother",
  "Wife",
  "Husband",
  "Daughter",
  "Son",
  "Aunt",
  "Uncle",
  "Grandmother",
  "Grandfather",
  "Guardian",
  "Cousin",
  "Friend",
  "Other",
];

const FieldSelect = ({
  form,
  name,
  label,
  options,
  placeholder,
}: {
  form: UseFormReturn<BasicFormValues>;
  name: any;
  label: string;
  options: string[];
  placeholder?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select onValueChange={field.onChange} value={field.value || ""}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);

const BasicInmateForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        cash: "",
        shorts: "",
        shortsColor: "",
        tShirt: "",
        tShirtColor: "",
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

  const clothingItems = useMemo(
    () => [
      { key: "shorts", colorKey: "shortsColor", label: "Short" },
      { key: "tShirt", colorKey: "tShirtColor", label: "T-shirts" },
      { key: "skirt", colorKey: "skirtColor", label: "Skirt" },
      { key: "dress", colorKey: "dressColor", label: "Dress" },
      { key: "cap", colorKey: "capColor", label: "Cap" },
      { key: "blouse", colorKey: "blouseColor", label: "Blouse" },
      { key: "shoes", colorKey: "shoesColor", label: "Shoes" },
      { key: "wallet", colorKey: "walletColor", label: "Wallet" },
      { key: "jersey", colorKey: "jerseyColor", label: "Jersey" },
      { key: "wallets", colorKey: "walletsColor", label: "Wallets" },
      { key: "socks", colorKey: "socksColor", label: "Socks" },
    ],
    [],
  );

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Accordion type="single" collapsible className="space-y-3">
          <AccordionItem value="prison" className="rounded-md border bg-white px-4">
            <AccordionTrigger>Prison Details</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-5 pb-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="inmateDetails.admission_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select admission type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NEW_ADMISSION">New Admission</SelectItem>
                          <SelectItem value="TRANSFER">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FieldInput form={form} name="inmateDetails.prison_number" label="Prison Number" placeholder="0001/26" />
                <FieldInput form={form} name="inmateDetails.crb_number" label="CRB Number" placeholder="Optional" />
                <FormField
                  control={form.control}
                  name="inmateDetails.is_first_time_offender"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-md border px-4 py-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0">First Time Offender</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="personal" className="rounded-md border bg-white px-4">
            <AccordionTrigger>Personal Details</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-5 pb-4 md:grid-cols-2 lg:grid-cols-3">
                <FieldInput form={form} name="inmateDetails.first_name" label="Name" />
                <FieldInput form={form} name="inmateDetails.surname" label="Surname" />
                <FieldInput form={form} name="inmateDetails.other_names" label="Other Names" placeholder="Optional" />
                <FormField
                  control={form.control}
                  name="inmateDetails.gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FieldInput form={form} name="inmateDetails.date_of_birth" label="Date of Birth" type="date" />
                <FieldSelect
                  form={form}
                  name="inmateDetails.nationality"
                  label="Nationality"
                  options={nationalityOptions}
                />
                <FieldInput form={form} name="inmateDetails.national_id" label="National ID" placeholder="Optional" />
                <FieldInput form={form} name="inmateDetails.address" label="Address" />
                <FormField
                  control={form.control}
                  name="inmateDetails.marital_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marital Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select marital status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Married">Married</SelectItem>
                          <SelectItem value="Divorced">Divorced</SelectItem>
                          <SelectItem value="Widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FieldSelect
                  form={form}
                  name="inmateDetails.educational_level"
                  label="Educational Level"
                  options={educationalLevelOptions}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="home" className="rounded-md border bg-white px-4">
            <AccordionTrigger>Local Home History</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-5 pb-4 md:grid-cols-2 lg:grid-cols-3">
                <FieldSelect
                  form={form}
                  name="inmateDetails.race"
                  label="Race"
                  options={raceOptions}
                />
                <FieldInput form={form} name="inmateDetails.headman" label="Headman" />
                <FieldInput form={form} name="inmateDetails.chief" label="Chief" />
                <FieldSelect
                  form={form}
                  name="inmateDetails.district"
                  label="District"
                  options={zimbabweDistrictOptions}
                />
                <FieldInput form={form} name="inmateDetails.occupation" label="Occupation" />
                <FormField
                  control={form.control}
                  name="inmateDetails.inmate_image"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Inmate Photo</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => onChange(event.target.files?.[0] || null)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="kin" className="rounded-md border bg-white px-4">
            <AccordionTrigger>Next of Kin</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-5 pb-4 md:grid-cols-2">
                <FieldInput form={form} name="nextOfKin.full_name" label="Full Name" />
                <FieldSelect
                  form={form}
                  name="nextOfKin.relationship"
                  label="Relationship"
                  options={nextOfKinRelationshipOptions}
                />
                <FieldInput form={form} name="nextOfKin.address" label="Address" />
                <FieldInput form={form} name="nextOfKin.contact" label="Contact" />
              </div>
            </AccordionContent>
          </AccordionItem>


          <AccordionItem value="valuables" className="rounded-md border bg-white px-4">
            <AccordionTrigger>Inmate Valuables</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-5 pb-4 md:grid-cols-2">
                <FieldInput form={form} name="inmateValuables.bagNo" label="Bag Number" />
                <FieldInput form={form} name="inmateValuables.cash" label="Cash" placeholder="0.00" />
              </div>

              <div className="mt-5 space-y-3">
                {clothingItems.map((item) => {
                  const selected = Boolean((valuables as any)?.[item.key]);
                  return (
                    <div key={item.key} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[1fr_220px] md:items-center">
                      <FormField
                        control={form.control}
                        name={`inmateValuables.${item.key}` as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3">
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
                            <FormLabel className="m-0">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`inmateValuables.${item.colorKey}` as any}
                        render={({ field }) => (
                          <FormItem>
                            <Select disabled={!selected} onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select colour" />
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

              <FormField
                control={form.control}
                name="inmateValuables.others"
                render={({ field }) => (
                  <FormItem className="mt-5">
                    <FormLabel>Others</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Type any other item here" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate("/reception")}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#0b4f2a] font-medium text-white hover:bg-[#063f20]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>Processing...</>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Register Inmate
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default BasicInmateForm;
