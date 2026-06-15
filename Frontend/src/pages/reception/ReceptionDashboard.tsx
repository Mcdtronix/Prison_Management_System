import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Home, LogOut, Plus, Search, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { receptionApi } from "@/lib/api";
import { PrisonLayout } from "@/components/PrisonLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PendingApprovalInmate {
  id: number;
  prison_number: string;
  name: string;
  admission_date: string;
  offense: string;
  status: "pending_approval";
}

interface PendingOffenceInmate {
  id: number;
  prison_number: string;
  name: string;
  admission_date: string;
  status: "pending_offence_registration";
}

const ReceptionDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingApprovalInmates, setPendingApprovalInmates] = useState<
    PendingApprovalInmate[]
  >([]);
  const [pendingOffenceInmates, setPendingOffenceInmates] = useState<
    PendingOffenceInmate[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPendingInmates();
  }, []);

  const fetchPendingInmates = async () => {
    try {
      setIsLoading(true);
      const [approvalResponse, offenceResponse] = await Promise.all([
        receptionApi.getPendingApprovalInmates(),
        receptionApi.getPendingOffenceInmates(),
      ]);

      if (approvalResponse.data) {
        setPendingApprovalInmates(
          approvalResponse.data as PendingApprovalInmate[],
        );
      }
      if (offenceResponse.data) {
        setPendingOffenceInmates(
          offenceResponse.data as PendingOffenceInmate[],
        );
      }
    } catch (error) {
      console.error("Error fetching pending inmates:", error);
      toast({
        title: "Error",
        description: "Failed to fetch pending inmates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredApprovalInmates = pendingApprovalInmates.filter(
    (inmate) =>
      inmate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inmate.prison_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inmate.offense.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredOffenceInmates = pendingOffenceInmates.filter(
    (inmate) =>
      inmate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inmate.prison_number.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  return (
    <PrisonLayout
      title="Reception Dashboard"
      description="Register new inmates and manage their valuables"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Admin Approval
            </CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingApprovalInmates.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting admin approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Offence Registration
            </CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingOffenceInmates.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Basic info registered, need offences
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Admissions
            </CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">New inmates today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valuables Processed
            </CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Items registered today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Discharges
            </CardTitle>
            <div className="h-4 w-4 rounded-full bg-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        {/* Pending Admin Approval Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Admin Approval</CardTitle>
              <CardDescription>
                Inmates with complete registration awaiting administrative
                approval
              </CardDescription>
            </div>
            <Button onClick={() => navigate("/reception/register")}>
              <Plus className="mr-2 h-4 w-4" />
              Register New Inmate
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-4">Loading...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prison #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission Date</TableHead>
                      <TableHead>Offense</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApprovalInmates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          No inmates pending admin approval
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredApprovalInmates.map((inmate) => (
                        <TableRow key={inmate.id}>
                          <TableCell 
                            className="font-medium text-blue-600 hover:underline cursor-pointer"
                            onClick={() => navigate(`/inmates/${inmate.id}`)}
                          >
                            {inmate.prison_number}
                          </TableCell>
                          <TableCell>{inmate.name}</TableCell>
                          <TableCell>
                            {new Date(
                              inmate.admission_date,
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{inmate.offense}</TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-500">
                              Pending Approval
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/inmates/${inmate.id}`)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Offence Registration Table */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pending Offence Registration</CardTitle>
              <CardDescription>
                Inmates with basic information registered but no offence details
                yet
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inmates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center p-4">Loading...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prison #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffenceInmates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          No inmates pending offence registration
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOffenceInmates.map((inmate) => (
                        <TableRow key={inmate.id}>
                          <TableCell 
                            className="font-medium text-blue-600 hover:underline cursor-pointer"
                            onClick={() => navigate(`/inmates/${inmate.id}`)}
                          >
                            {inmate.prison_number}
                          </TableCell>
                          <TableCell>{inmate.name}</TableCell>
                          <TableCell>
                            {new Date(
                              inmate.admission_date,
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-500">
                              Pending Offences
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/reception/register-offences/${inmate.id}`,
                                )
                              }
                              className="mr-2"
                            >
                              Add Offences
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/inmates/${inmate.id}`)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PrisonLayout>
  );
};

export default ReceptionDashboard;
