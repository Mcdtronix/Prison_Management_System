import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { inmateApi, adminApi, receptionApi } from "@/lib/api";
import { PrisonLayout } from "@/components/PrisonLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  User,
  FileText,
  Calendar,
  Gavel,
  ArrowRight,
  LogOut,
  Thermometer,
  BookOpen,
  AlertCircle,

  Clock,
  Pencil,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "sonner";

interface Inmate {
  id: string;
  prison_number: string;
  first_name: string;
  surname: string;
  other_names?: string;
  national_id?: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  admission_type: string;
  admission_date: string;
  current_status: string;
  admission_status?: string;
  has_discharge_assessment?: boolean;
  created_at: string;
  updated_at: string;
  next_of_kin?: {
    full_name: string;
    relationship: string;
    address: string;
    contact: string;
  };
  classification?: {
    classification: string;
    effective_date: string;
  };
  valuables?: {
    id: string;
    bag_number: string;
    cash_amount: number;
    items_description: string;
    date_logged: string;
  };
  release_history?: {
    total_effective_sentence: number;
    total_sentences_days: number;
    remission: number;
    total_remission_days: number;
    earliest_date_of_release: string;
    active_edr: string;
    active_odr: string;
    edr_standard: string;
    odr_standard: string;
    edr_restitution_paid: string | null;
    odr_restitution_paid: string | null;
  };
  offences?: Array<{
    id: string;
    offence_description: string;
    court: string;
    conviction_status: string;
    sentence?: string;
    sentence_years?: number;
    sentence_months?: number;
    sentence_days?: number;
    effective_sentence_days?: number;
    remission_days?: number;
    sentence_date?: string;
    restitution_amount?: number;
    restitution_date?: string;
    restitution_status?: string;
    restitution_sentence_years?: number;
    restitution_sentence_months?: number;
    restitution_sentence_days?: number;
    restitution_sentence_days_total?: number;
    next_court_date?: string;
  }>;
  station_history?: Array<any>;
  name?: string; // Adding some fields used later
  dob?: string;
  address?: string;
  emergency_contact?: string;
  offense?: string;
  sentence?: string;
  expected_release_date?: string;
  age?: number;
  photo_url?: string;
  status?: string;
  admission_health_assessment?: {
    id: string;
    assessment_date: string;
    weight: string;
    height?: string;
    bmi?: string;
    comment?: string;
    is_chronic_patient: boolean;
    assessed_by: string;
  };
  timeline?: TimelineEvent[];
}

interface Offense {
  id: string;
  description: string;
  court: string;
  conviction_status: "convicted" | "unconvicted";
  sentence?: string;
  edr_with_restitution?: string;
  edr_without_restitution?: string;
  restitution_amount?: number;
  restitution_date?: string;
  next_court_date?: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  event_type: string;
  description: string;
  recorded_by: string;
}

interface Valuable {
  id: string;
  bag_number: string;
  description: string;
  quantity: number;
  estimated_value?: number;
  storage_location: string;
}

interface HealthRecord {
  id: string;
  date: string;
  temperature: string;
  height: string;
  weight: string;
  blood_pressure: string;
  medical_conditions: string[];
  medications: string[];
  allergies: string[];
  health_status: string;
  notes: string;
}

interface OPDVisit {
  id: string;
  date: string;
  complaint: string;
  diagnosis: string;
  treatment: string;
  doctor: string;
}

const InmateDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [inmate, setInmate] = useState<Inmate | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [opdVisits, setOPDVisits] = useState<OPDVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchInmateData(id);
    }
  }, [id]);

  const fetchInmateData = async (inmateId: string) => {
    setIsLoading(true);
    try {
      // Fetch inmate details
      const detailsResponse = await inmateApi.getInmateDetails(inmateId);
      if (detailsResponse.data) {
        const inmateData = detailsResponse.data as Inmate;
        setInmate(inmateData);

        if (inmateData.timeline) {
          setTimeline(inmateData.timeline);
        }

        if (inmateData.admission_health_assessment) {
          const assessment = inmateData.admission_health_assessment;
          setHealthRecord({
            id: assessment.id.toString(),
            date: assessment.assessment_date,
            temperature: 'N/A',
            height: assessment.height ? `${assessment.height} cm` : 'N/A',
            weight: `${assessment.weight} kg`,
            blood_pressure: 'N/A',
            medical_conditions: assessment.is_chronic_patient ? ['Chronic Condition Reported'] : [],
            medications: [],
            allergies: [],
            health_status: assessment.is_chronic_patient ? 'Chronic Patient' : 'Standard',
            notes: assessment.comment || 'No notes provided',
          });
        } else {
          setHealthRecord(null);
        }
      }
    } catch (error) {
      console.error("Error fetching inmate data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inmate details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleApproveInmate = async () => {
    if (!id) return;

    try {
      await adminApi.approveInmate(id);
      setInmate((prev) => (prev ? { ...prev, status: "active" } : null));
      toast({
        title: "Success",
        description: "Inmate approved successfully",
      });
    } catch (error) {
      console.error("Error approving inmate:", error);
      toast({
        title: "Error",
        description: "Failed to approve inmate",
        variant: "destructive",
      });
    }
  };

  const handleDischargeInmate = async () => {
    if (!id) return;

    try {
      await receptionApi.approveDischarge(id);
      setInmate((prev) => (prev ? { ...prev, status: "discharged" } : null));
      toast({
        title: "Success",
        description: "Inmate discharged successfully",
      });
    } catch (error) {
      console.error("Error discharging inmate:", error);
      toast({
        title: "Error",
        description: "Failed to discharge inmate",
        variant: "destructive",
      });
    }
  };

  const handleTransferInmate = async () => {
    if (!id) return;

    // In a real app, you'd open a dialog to get the destination
    const destination = "Central Prison";

    try {
      await adminApi.transferInmate(id, destination);
      setInmate((prev) => (prev ? { ...prev, status: "transferred" } : null));
      toast({
        title: "Success",
        description: "Inmate transfer initiated successfully",
      });
    } catch (error) {
      console.error("Error transferring inmate:", error);
      toast({
        title: "Error",
        description: "Failed to transfer inmate",
        variant: "destructive",
      });
    }
  };

  const handleClassifyInmate = async (classification: string) => {
    if (!id) return;

    try {
      await adminApi.classifyInmate(id, classification);
      setInmate((prev) =>
        prev ? { ...prev, classification: classification as any } : null,
      );
      toast({
        title: "Success",
        description: `Inmate classified as Class ${classification}`,
      });
    } catch (error) {
      console.error("Error classifying inmate:", error);
      toast({
        title: "Error",
        description: "Failed to classify inmate",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;

    switch (status) {
      case "IN_CUSTODY":
        return <Badge className="bg-green-500">In Custody</Badge>;
      case "TRANSFERRED":
        return <Badge className="bg-[#0b4f2a]">Transferred</Badge>;
      case "ESCAPED":
        return <Badge className="bg-red-500">Escaped</Badge>;
      case "DISCHARGED":
        return <Badge className="bg-[#0b4f2a]">Discharged</Badge>;
      case "DECEASED":
        return <Badge className="bg-gray-500">Deceased</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const navItems = [
    {
      icon: <Home size={20} />,
      label: "Dashboard",
      href:
        user?.role === "admin"
          ? "/admin"
          : user?.role === "reception"
            ? "/reception"
            : "/health",
    },
    {
      icon: <User size={20} />,
      label: "Inmates",
      href:
        user?.role === "admin"
          ? "/admin/inmates"
          : user?.role === "reception"
            ? "/reception/inmates"
            : "/health/inmates",
    },
    {
      icon: <FileText size={20} />,
      label: "Records",
      href:
        user?.role === "admin"
          ? "/admin/records"
          : user?.role === "reception"
            ? "/reception/records"
            : "/health/records",
    },
  ];

  if (isLoading) {
    return (
      <PrisonLayout
        title="Inmate Details"
        description="Loading inmate information..."
      >
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b4f2a] mx-auto mb-4"></div>
            <p>Loading inmate information...</p>
          </div>
        </div>
      </PrisonLayout>
    );
  }

  if (!inmate) {
    return (
      <PrisonLayout
        title="Inmate Details"
        description="Inmate not found"
      >
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <AlertCircle className="h-16 w-16 text-red-500" />
          <h2 className="text-2xl font-bold">Inmate Not Found</h2>
          <p className="text-gray-500">The requested inmate could not be found or you do not have permission to view them.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </PrisonLayout>
    );
  }


  return (
    <PrisonLayout
      title="Inmate Details"
      description="View comprehensive inmate information"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden">
                {inmate.photo_url ? (
                  <img
                    src={inmate.photo_url}
                    alt={inmate.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F1F0FB]">
                    <User className="h-12 w-12 text-[#0b4f2a]" />
                  </div>
                )}
              </div>
              <CardTitle className="text-xl">
                {inmate.first_name} {inmate.surname}
              </CardTitle>
              <CardDescription>
                Prison Number: {inmate.prison_number}
              </CardDescription>
              <div className="mt-2">
                {getStatusBadge(inmate.current_status)}
                <Badge className="ml-2 bg-[#d7a928]">
                  Class {inmate.classification?.classification}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Age:</span>
                  <span className="text-sm">{inmate.age} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Gender:</span>
                  <span className="text-sm">{inmate.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Nationality:</span>
                  <span className="text-sm">{inmate.nationality}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Admission Date:</span>
                  <span className="text-sm">
                    {new Date(inmate.admission_date).toLocaleDateString()}
                  </span>
                </div>
                {inmate.expected_release_date && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">
                      Expected Release:
                    </span>
                    <span className="text-sm">
                      {new Date(
                        inmate.expected_release_date,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Primary Offense:</span>
                  <span className="text-sm">{inmate.offense}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Sentence:</span>
                  <span className="text-sm">{inmate.sentence || "N/A"}</span>
                </div>
              </div>

              {/* Admin actions */}
              {user?.role === "admin" && (
                <div className="mt-6 space-y-2">
                  {inmate.status === "pending" && inmate.admission_status === "PENDING_HEALTH_ASSESSMENT" && (
                    <Button
                      className="w-full bg-gray-400"
                      disabled
                      title="Health Assessment required before admin approval"
                    >
                      Awaiting Health Assessment
                    </Button>
                  )}
                  {inmate.status === "pending" && inmate.admission_status !== "PENDING_HEALTH_ASSESSMENT" && (
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      onClick={handleApproveInmate}
                    >
                      Approve Admission
                    </Button>
                  )}
                  {inmate.status === "active" && (
                    <>
                      {inmate.has_discharge_assessment ? (
                        <Button
                          className="w-full bg-[#0b4f2a] hover:bg-[#0b4f2a]"
                          onClick={handleDischargeInmate}
                        >
                          Discharge Inmate
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-gray-400"
                          disabled
                          title="Discharge Health Assessment required before discharge"
                        >
                          Awaiting Discharge Assessment
                        </Button>
                      )}
                      <Button
                        className="w-full bg-[#0b4f2a] hover:bg-[#0b4f2a]"
                        onClick={handleTransferInmate}
                      >
                        Transfer Inmate
                      </Button>
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">
                          Change Classification:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {["A", "B", "C", "D", "PUSOD", "CONDEM"].map(
                            (cls) => (
                              <Button
                                key={cls}
                                variant="outline"
                                size="sm"
                                className={
                                  inmate.classification === cls
                                    ? "bg-[#0b4f2a] text-white"
                                    : ""
                                }
                                onClick={() => handleClassifyInmate(cls)}
                              >
                                {cls}
                              </Button>
                            ),
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="offenses">Offenses</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Personal Information</CardTitle>
                    {(user?.role === "RECEPTION_OFFICER" ||
                      user?.role === "ADMIN_OFFICER" ||
                      user?.role === "SUPER_ADMIN" ||
                      user?.role === "admin" ||
                      user?.role === "reception") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/reception/register?inmateId=${id}`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="font-medium mb-2">Personal Details</h3>
                      <div className="space-y-2">
                        <div className="flex items-start">
                          <User className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Full Name</p>
                            <p className="text-sm">{inmate.name}</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <Calendar className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Date of Birth</p>
                            <p className="text-sm">
                              {new Date(inmate.dob).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <Home className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Address</p>
                            <p className="text-sm">{inmate.address}</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              Emergency Contact
                            </p>
                            <p className="text-sm">
                              {inmate.emergency_contact}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">
                        Incarceration Details
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-start">
                          <Gavel className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              Primary Offense
                            </p>
                            <p className="text-sm">{inmate.offense}</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <Clock className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Total Sentence</p>
                            <p className="text-sm">
                              {inmate.release_history 
                                ? `${inmate.release_history.total_effective_sentence} months (${inmate.release_history.total_sentences_days} days)` 
                                : inmate.sentence || "N/A"}
                            </p>
                          </div>
                        </div>
                        {inmate.release_history && (
                          <div className="flex items-start">
                            <Clock className="h-4 w-4 mr-2 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Remission</p>
                              <p className="text-sm">
                                {inmate.release_history.total_remission_days} days
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start">
                          <Calendar className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              Admission Date
                            </p>
                            <p className="text-sm">
                              {new Date(
                                inmate.admission_date,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {(inmate.release_history?.active_edr || inmate.expected_release_date) && (
                          <div className="flex items-start">
                            <Calendar className="h-4 w-4 mr-2 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">
                                Active Earliest Date of Release (EDR)
                              </p>
                              <p className="text-sm font-semibold text-blue-700">
                                {new Date(
                                  inmate.release_history?.active_edr || inmate.expected_release_date || "",
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}
                        {inmate.release_history?.active_odr && (
                          <div className="flex items-start">
                            <Calendar className="h-4 w-4 mr-2 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">
                                Active Oldest Date of Release (ODR)
                              </p>
                              <p className="text-sm">
                                {new Date(
                                  inmate.release_history.active_odr,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inmate Valuables</CardTitle>
                </CardHeader>
                <CardContent>
                  {inmate.valuables ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Bag Number:</span>
                        <span className="text-sm">
                          {inmate.valuables.bag_number}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">
                          Cash Amount:
                        </span>
                        <span className="text-sm">
                          ${inmate.valuables.cash_amount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Items:</span>
                        <span className="text-sm">
                          {inmate.valuables.items_description}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">
                          Date Logged:
                        </span>
                        <span className="text-sm">
                          {new Date(
                            inmate.valuables.date_logged,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No valuables recorded for this inmate.
                    </p>
                  )}

                  {user?.role === "reception" && (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() =>
                        navigate(`/reception/inmates/${id}/valuables`)
                      }
                    >
                      Register Valuables
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="offenses" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Offense Record</CardTitle>
                      <CardDescription>
                        Complete record of offenses and sentences
                      </CardDescription>
                    </div>
                    {(user?.role === "RECEPTION_OFFICER" ||
                      user?.role === "ADMIN_OFFICER" ||
                      user?.role === "SUPER_ADMIN" ||
                      user?.role === "admin" ||
                      user?.role === "reception") && (
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(`/reception/register-offences/${id}` as string, {
                            state: {
                              mode: "edit",
                              offences: inmate.offences,
                              inmateSummary: {
                                id,
                                prison_number: inmate.prison_number,
                                surname: inmate.surname,
                                first_name: inmate.first_name,
                              },
                            },
                          })
                        }
                      >
                        <Pencil className="h-4 w-4 mr-2" /> Edit Offences
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {inmate.offences && inmate.offences.length > 0 ? (
                    <div className="space-y-6">
                      {inmate.offences.map((offense, index) => (
                        <div
                          key={offense.id}
                          className="border-b pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                            <Badge
                              className={
                                offense.conviction_status === "convicted"
                                  ? "bg-red-500"
                                  : "bg-orange-500"
                              }
                            >
                              {offense.conviction_status === "convicted"
                                ? "Convicted"
                                : "Unconvicted"}
                            </Badge>
                            <span className="ml-2 text-sm font-semibold">
                              Offense #{index + 1}
                            </span>
                            </div>
                          </div>
                          <p className="text-sm font-medium my-2">
                            Description:
                          </p>
                          <p className="text-sm mb-3">
                            {offense.offence_description}
                          </p>
                          <p className="text-sm font-medium mb-1">Court:</p>
                          <p className="text-sm mb-3">{offense.court}</p>

                          {offense.conviction_status === "convicted" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <div>
                                  <p className="text-sm font-medium mb-1">
                                    Next Court Date:
                                  </p>
                                  <p className="text-sm mb-3">
                                    {offense.restitution_date
                                      ? `${new Date(offense.restitution_date).toLocaleDateString()} (Restitution)`
                                      : "Closed"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-1">
                                    Sentence:
                                  </p>
                                  <p className="text-sm">
                                    {offense.sentence_years}Y {offense.sentence_months}M {offense.sentence_days}D
                                    <br/><span className="text-xs text-gray-500">Effective: {offense.effective_sentence_days} days</span>
                                  </p>
                                </div>
                                {offense.restitution_amount && (
                                  <>
                                    <div>
                                      <p className="text-sm font-medium mb-1">
                                        Restitution:
                                      </p>
                                      <p className="text-sm">
                                        Amount: ${offense.restitution_amount}
                                        <br/>Status: <Badge variant="outline">{offense.restitution_status}</Badge>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium mb-1">
                                        Alternative Sentence:
                                      </p>
                                      <p className="text-sm">
                                        {offense.restitution_sentence_years}Y {offense.restitution_sentence_months}M {offense.restitution_sentence_days}D
                                        <br/><span className="text-xs text-gray-500">Total: {offense.restitution_sentence_days_total} days</span>
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : offense.conviction_status === "discharged" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-sm font-medium mb-1">
                                  Discharge Reason:
                                </p>
                                <p className="text-sm mb-3">
                                  {offense.discharge_reason?.replace(/_/g, " ")}
                                </p>
                                <p className="text-sm font-medium mb-1">
                                  Discharge Date:
                                </p>
                                <p className="text-sm">
                                  {offense.discharge_date ? new Date(offense.discharge_date).toLocaleDateString() : "N/A"}
                                </p>
                                {offense.remarks && (
                                  <>
                                    <p className="text-sm font-medium mb-1 mt-3">
                                      Remarks:
                                    </p>
                                    <p className="text-sm">
                                      {offense.remarks}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-medium mb-1">
                                Next Court Date:
                              </p>
                              <p className="text-sm">
                                {offense.next_court_date
                                  ? new Date(
                                      offense.next_court_date,
                                    ).toLocaleDateString()
                                  : "Not scheduled"}
                              </p>
                              {(user?.role === "RECEPTION_OFFICER" ||
                                  user?.role === "ADMIN_OFFICER" ||
                                  user?.role === "SUPER_ADMIN" ||
                                  user?.role === "admin" ||
                                  user?.role === "reception") && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="mt-3"
                                    onClick={() =>
                                      navigate(`/reception/record-court-outcome/${id}/${offense.id}`)
                                    }
                                  >
                                    <Gavel className="w-4 h-4 mr-2" />
                                    Record Court Outcome
                                  </Button>
                                )}
                            </div>
                          )}

                          {/* Render Remand Dates and Court History */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm font-medium mb-2">History & Timeline</p>
                            {offense.remand_start_date && (
                              <div className="text-sm mb-2 text-gray-600 bg-gray-50 p-2 rounded">
                                <span className="font-semibold">Remanded: </span> 
                                {new Date(offense.remand_start_date).toLocaleDateString()}
                                {offense.remand_end_date && ` - ${new Date(offense.remand_end_date).toLocaleDateString()}`}
                              </div>
                            )}
                            
                            {offense.court_history && offense.court_history.length > 0 ? (
                              <div className="space-y-2 mt-2">
                                {offense.court_history.map((session: any, idx: number) => (
                                  <div key={idx} className="text-sm p-2 bg-gray-50 rounded border-l-2 border-[#0b4f2a]">
                                    <div className="flex justify-between mb-1">
                                      <span className="font-semibold text-xs text-gray-500">
                                        {new Date(session.session_date).toLocaleDateString()}
                                      </span>
                                      <Badge variant="outline" className="text-xs py-0 h-4">
                                        {session.outcome}
                                      </Badge>
                                    </div>
                                    {session.remarks && (
                                      <p className="text-gray-600 text-xs mt-1">Note: {session.remarks}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 italic mt-2">No court sessions recorded.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No detailed offense records available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inmate Timeline</CardTitle>
                  <CardDescription>
                    Chronological record of events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {timeline.length > 0 ? (
                    <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                      {timeline.map((event) => (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-9 mt-1.5 h-4 w-4 rounded-full bg-[#0b4f2a]"></div>
                          <div className="mb-1 flex items-center">
                            <Badge className="bg-[#d7a928]">
                              {event.event_type}
                            </Badge>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {new Date(event.date).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm mb-1">{event.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Recorded by: {event.recorded_by}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No timeline events recorded.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Health Record</CardTitle>
                  <CardDescription>
                    Medical information and health status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {healthRecord ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Temperature
                          </p>
                          <div className="flex items-center">
                            <Thermometer className="h-4 w-4 text-red-500 mr-1" />
                            <span className="text-sm font-medium">
                              {healthRecord.temperature}
                            </span>
                          </div>
                        </div>
                        <div className="border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Height
                          </p>
                          <span className="text-sm font-medium">
                            {healthRecord.height}
                          </span>
                        </div>
                        <div className="border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Weight
                          </p>
                          <span className="text-sm font-medium">
                            {healthRecord.weight}
                          </span>
                        </div>
                        <div className="border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Blood Pressure
                          </p>
                          <span className="text-sm font-medium">
                            {healthRecord.blood_pressure}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Health Status
                        </h3>
                        <p className="text-sm">{healthRecord.health_status}</p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            Medical Conditions
                          </h3>
                          {healthRecord.medical_conditions.length > 0 ? (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                              {healthRecord.medical_conditions.map(
                                (condition, index) => (
                                  <li key={index}>{condition}</li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              None reported
                            </p>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            Medications
                          </h3>
                          {healthRecord.medications.length > 0 ? (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                              {healthRecord.medications.map(
                                (medication, index) => (
                                  <li key={index}>{medication}</li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              None prescribed
                            </p>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            Allergies
                          </h3>
                          {healthRecord.allergies.length > 0 ? (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                              {healthRecord.allergies.map((allergy, index) => (
                                <li key={index}>{allergy}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              None reported
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">Notes</h3>
                        <p className="text-sm">
                          {healthRecord.notes || "No additional notes"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No health record available for this inmate.
                      </p>

                      {user?.role === "health" && (
                        <Button
                          className="mt-4"
                          onClick={() => navigate(`/health/inmate/${id}`)}
                        >
                          Create Health Record
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {healthRecord && (
                <Card>
                  <CardHeader>
                    <CardTitle>OPD Visits</CardTitle>
                    <CardDescription>
                      Out-patient department visit history
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {opdVisits.length > 0 ? (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 text-sm font-medium">
                                Date
                              </th>
                              <th className="text-left p-3 text-sm font-medium">
                                Complaint
                              </th>
                              <th className="text-left p-3 text-sm font-medium">
                                Diagnosis
                              </th>
                              <th className="text-left p-3 text-sm font-medium">
                                Doctor
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {opdVisits.map((visit) => (
                              <tr
                                key={visit.id}
                                className="border-b last:border-0"
                              >
                                <td className="p-3 text-sm">
                                  {new Date(visit.date).toLocaleDateString()}
                                </td>
                                <td className="p-3 text-sm">
                                  {visit.complaint}
                                </td>
                                <td className="p-3 text-sm">
                                  {visit.diagnosis}
                                </td>
                                <td className="p-3 text-sm">{visit.doctor}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No OPD visits recorded.
                      </p>
                    )}

                    {user?.role === "health" && (
                      <Button
                        className="mt-4"
                        onClick={() => navigate(`/health/inmate/${id}/opd/new`)}
                      >
                        Record OPD Visit
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </PrisonLayout>
  );
};

export default InmateDetails;
