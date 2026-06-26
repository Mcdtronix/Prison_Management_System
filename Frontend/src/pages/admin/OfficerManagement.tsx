import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, RefreshCw, ShieldPlus, UserPlus, UserMinus, UserCheck } from "lucide-react";

import { authApi, hrApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ManagedUserProfile {
  id: number;
  username: string;
  email: string;
  officer_service_number: string | null;
  officer_name: string | null;
  role_name: string;
  role_code: string;
  station_name: string;
  station_code: string;
  is_active: boolean;
  created_at: string;
}

interface OfficerOption {
  service_number: string;
  full_name: string;
  current_station_name?: string | null;
  current_station_code?: string | null;
}

interface FullOfficer {
  service_number: string;
  first_name: string;
  surname: string;
  national_id: string;
  gender: string;
  current_status: string;
  date_of_birth: string;
  date_of_attestation: string;
}

interface RoleOption {
  id: number;
  code: string;
  name: string;
}

const OfficerManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addOfficerDialogOpen, setAddOfficerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<ManagedUserProfile[]>([]);
  const [officers, setOfficers] = useState<FullOfficer[]>([]);
  const [officerOptions, setOfficerOptions] = useState<OfficerOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [formData, setFormData] = useState({
    officer: "",
    role: "",
    password: "",
    email: "",
  });

  const [officerFormData, setOfficerFormData] = useState({
    service_number: "",
    first_name: "",
    surname: "",
    national_id: "",
    gender: "",
    date_of_birth: "",
    date_of_attestation: "",
  });

  const loadData = async (background = false) => {
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [usersResponse, optionsResponse, officersResponse] = await Promise.all([
        authApi.getUsers(),
        authApi.getUserCreationOptions(),
        hrApi.getOfficers(),
      ]);

      if (usersResponse.error) throw new Error(usersResponse.error);
      if (optionsResponse.error) throw new Error(optionsResponse.error);
      if (officersResponse.error) throw new Error(officersResponse.error);

      setUsers((usersResponse.data as ManagedUserProfile[]) || []);
      setOfficerOptions(optionsResponse.data?.officers || []);
      setRoleOptions(optionsResponse.data?.roles || []);
      setOfficers(officersResponse.data || []);
    } catch (error) {
      toast({
        title: "Unable to load data",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.username, user.officer_name, user.officer_service_number, user.role_name, user.station_name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [searchQuery, users]);

  const filteredOfficers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return officers;
    return officers.filter((off) =>
      [off.service_number, off.first_name, off.surname, off.national_id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchQuery, officers]);

  const resetForm = () => {
    setFormData({ officer: "", role: "", password: "", email: "" });
  };

  const resetOfficerForm = () => {
    setOfficerFormData({
      service_number: "", first_name: "", surname: "", national_id: "", gender: "", date_of_birth: "", date_of_attestation: "",
    });
  };

  const selectedOfficer = officerOptions.find((officer) => officer.service_number === formData.officer);

  const handleAddOfficer = async () => {
    if (!officerFormData.service_number || !officerFormData.first_name || !officerFormData.surname || !officerFormData.national_id || !officerFormData.gender || !officerFormData.date_of_birth || !officerFormData.date_of_attestation) {
      toast({ title: "Missing information", description: "All fields are required.", variant: "destructive" });
      return;
    }

    const response = await hrApi.createOfficer(officerFormData);

    if (response.error) {
      toast({ title: "Officer creation failed", description: response.error, variant: "destructive" });
      return;
    }

    toast({ title: "Officer Registered", description: `${officerFormData.first_name} ${officerFormData.surname} added to the system.` });
    resetOfficerForm();
    setAddOfficerDialogOpen(false);
    loadData(true);
  };

  const handleCreate = async () => {
    if (!formData.officer || !formData.role || !formData.password) {
      toast({ title: "Missing information", description: "Officer, role, and password are required.", variant: "destructive" });
      return;
    }

    const roleId = Number(formData.role);
    if (Number.isNaN(roleId)) {
      toast({ title: "Invalid role", description: "Please select a valid role.", variant: "destructive" });
      return;
    }

    const response = await authApi.createUserFromOfficer({
      officer: formData.officer, role: roleId, password: formData.password, email: formData.email || undefined,
    });

    if (response.error) {
      toast({ title: "Account creation failed", description: response.error, variant: "destructive" });
      return;
    }

    toast({ title: "System account created", description: `${selectedOfficer?.full_name || formData.officer} can now sign in.` });
    resetForm();
    setDialogOpen(false);
    loadData(true);
  };

  const handleToggleUserStatus = async (user: ManagedUserProfile) => {
    const newStatus = !user.is_active;
    const response = await authApi.updateUserStatus(user.id, newStatus);
    
    if (response.error) {
      toast({ title: "Failed to update status", description: response.error, variant: "destructive" });
      return;
    }

    toast({ title: `Account ${newStatus ? 'Activated' : 'Deactivated'}`, description: `${user.username} is now ${newStatus ? 'active' : 'inactive'}.` });
    loadData(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle>Officer Management</CardTitle>
          <CardDescription>
            Manage the Human Resources database and map officers to system accounts.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadData(true)} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {/* ADD OFFICER DIALOG */}
          <Dialog open={addOfficerDialogOpen} onOpenChange={(open) => { setAddOfficerDialogOpen(open); if (!open) resetOfficerForm(); }}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Officer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Officer</DialogTitle>
                <DialogDescription>Enter official details to register an officer in the HR system.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Service Number</Label>
                  <Input placeholder="e.g. 1234567Z" value={officerFormData.service_number} onChange={(e) => setOfficerFormData(curr => ({...curr, service_number: e.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input placeholder="John" value={officerFormData.first_name} onChange={(e) => setOfficerFormData(curr => ({...curr, first_name: e.target.value}))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Surname</Label>
                    <Input placeholder="Doe" value={officerFormData.surname} onChange={(e) => setOfficerFormData(curr => ({...curr, surname: e.target.value}))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>National ID</Label>
                  <Input placeholder="e.g. 12-345678 A 90" value={officerFormData.national_id} onChange={(e) => setOfficerFormData(curr => ({...curr, national_id: e.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={officerFormData.gender} onValueChange={(v) => setOfficerFormData(curr => ({...curr, gender: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={officerFormData.date_of_birth} onChange={(e) => setOfficerFormData(curr => ({...curr, date_of_birth: e.target.value}))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date of Attestation</Label>
                  <Input type="date" value={officerFormData.date_of_attestation} onChange={(e) => setOfficerFormData(curr => ({...curr, date_of_attestation: e.target.value}))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOfficerDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddOfficer}><UserPlus className="mr-2 h-4 w-4" /> Save Officer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* CREATE SYSTEM USER DIALOG */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button disabled={officerOptions.length === 0}>
                <ShieldPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Officer Account</DialogTitle>
                <DialogDescription>Select an eligible officer, assign a system role, and set a starting password.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Officer</Label>
                  <Select value={formData.officer} onValueChange={(value) => setFormData((current) => ({ ...current, officer: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select an officer" /></SelectTrigger>
                    <SelectContent>
                      {officerOptions.map((officer) => (
                         <SelectItem key={officer.service_number} value={officer.service_number}>
                           {officer.full_name} ({officer.service_number})
                         </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedOfficer && (
                    <p className="text-xs text-muted-foreground">
                      Station: {selectedOfficer.current_station_name} ({selectedOfficer.current_station_code})
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>System Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData((current) => ({ ...current, role: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="Optional email address" value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input type="password" placeholder="Set an initial password" value={formData.password} onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}><KeyRound className="mr-2 h-4 w-4" /> Create Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            className="max-w-md"
            placeholder="Search..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8 text-sm text-muted-foreground">
            Loading data...
          </div>
        ) : (
          <Tabs defaultValue="all_officers" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all_officers">All Officers (Database)</TabsTrigger>
              <TabsTrigger value="system_users">System Users</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all_officers">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>National ID</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>System Account</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOfficers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No officers found in the database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOfficers.map((off) => {
                        const hasAccount = users.some(u => u.officer_service_number === off.service_number);
                        return (
                        <TableRow key={off.service_number}>
                          <TableCell className="font-medium">{off.service_number}</TableCell>
                          <TableCell>{off.first_name} {off.surname}</TableCell>
                          <TableCell>{off.national_id}</TableCell>
                          <TableCell>{off.gender}</TableCell>
                          <TableCell>
                            <Badge variant={hasAccount ? "default" : "secondary"}>
                              {hasAccount ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/officers/${off.service_number}`)}>
                              View Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="system_users">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Officer</TableHead>
                      <TableHead>Service Number</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Station</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No officer user accounts found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.officer_name || `${user.first_name} ${user.last_name}`.trim() || "-"}
                          </TableCell>
                          <TableCell>{user.officer_service_number || user.username}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{user.role_name}</span>
                              <span className="text-xs text-muted-foreground">{user.role_code}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{user.station_name}</span>
                              <span className="text-xs text-muted-foreground">{user.station_code}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? "default" : "secondary"}>
                              {user.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button 
                               variant={user.is_active ? "destructive" : "default"} 
                               size="sm" 
                               onClick={() => handleToggleUserStatus(user)}
                             >
                               {user.is_active ? <UserMinus className="w-4 h-4 mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                               {user.is_active ? "Deactivate" : "Activate"}
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default OfficerManagement;
