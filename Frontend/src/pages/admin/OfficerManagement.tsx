import React, { useEffect, useMemo, useState } from "react";
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

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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

const officerSchema = z.object({
  service_number: z.string().min(3, "Service number is required"),
  first_name: z.string().min(2, "First name is required"),
  surname: z.string().min(2, "Surname is required"),
  national_id: z.string().min(5, "National ID is required"),
  gender: z.string().min(1, "Gender is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  date_of_attestation: z.string().min(1, "Date of attestation is required"),
});

const userAccountSchema = z.object({
  officer: z.string().min(1, "Officer selection is required"),
  role: z.string().min(1, "Role selection is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

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

  const officerForm = useForm<z.infer<typeof officerSchema>>({
    resolver: zodResolver(officerSchema),
    defaultValues: {
      service_number: "",
      first_name: "",
      surname: "",
      national_id: "",
      gender: "",
      date_of_birth: "",
      date_of_attestation: "",
    },
    mode: "onChange",
  });

  const userAccountForm = useForm<z.infer<typeof userAccountSchema>>({
    resolver: zodResolver(userAccountSchema),
    defaultValues: {
      officer: "",
      role: "",
      email: "",
      password: "",
    },
    mode: "onChange",
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

  const selectedOfficer = officerOptions.find((officer) => officer.service_number === userAccountForm.watch("officer"));

  const onAddOfficerSubmit = async (data: z.infer<typeof officerSchema>) => {
    const response = await hrApi.createOfficer(data);

    if (response.error) {
      toast({ title: "Officer creation failed", description: response.error, variant: "destructive" });
      return;
    }

    toast({ title: "Officer Registered", description: `${data.first_name} ${data.surname} added to the system.` });
    officerForm.reset();
    setAddOfficerDialogOpen(false);
    loadData(true);
  };

  const onCreateUserSubmit = async (data: z.infer<typeof userAccountSchema>) => {
    const roleId = Number(data.role);
    const response = await authApi.createUserFromOfficer({
      officer: data.officer, role: roleId, password: data.password, email: data.email || undefined,
    });

    if (response.error) {
      toast({ title: "Account creation failed", description: response.error, variant: "destructive" });
      return;
    }

    toast({ title: "System account created", description: `${selectedOfficer?.full_name || data.officer} can now sign in.` });
    userAccountForm.reset();
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
          <Dialog open={addOfficerDialogOpen} onOpenChange={(open) => { setAddOfficerDialogOpen(open); if (!open) officerForm.reset(); }}>
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
              <Form {...officerForm}>
                <form onSubmit={officerForm.handleSubmit(onAddOfficerSubmit)} className="space-y-4 py-2">
                  <div className="space-y-4">
                    <FormField control={officerForm.control} name="service_number" render={({ field }) => (
                      <FormItem><FormLabel>Service Number</FormLabel><FormControl><Input placeholder="e.g. 1234567Z" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={officerForm.control} name="first_name" render={({ field }) => (
                        <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={officerForm.control} name="surname" render={({ field }) => (
                        <FormItem><FormLabel>Surname</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={officerForm.control} name="national_id" render={({ field }) => (
                      <FormItem><FormLabel>National ID</FormLabel><FormControl><Input placeholder="e.g. 12-345678 A 90" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={officerForm.control} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={officerForm.control} name="date_of_birth" render={({ field }) => (
                        <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={officerForm.control} name="date_of_attestation" render={({ field }) => (
                      <FormItem><FormLabel>Date of Attestation</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setAddOfficerDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={!officerForm.formState.isValid}><UserPlus className="mr-2 h-4 w-4" /> Save Officer</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* CREATE SYSTEM USER DIALOG */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) userAccountForm.reset(); }}>
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
              <Form {...userAccountForm}>
                <form onSubmit={userAccountForm.handleSubmit(onCreateUserSubmit)} className="space-y-4 py-2">
                  <FormField control={userAccountForm.control} name="officer" render={({ field }) => (
                    <FormItem><FormLabel>Officer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select an officer" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {officerOptions.map((officer) => (
                             <SelectItem key={officer.service_number} value={officer.service_number}>
                               {officer.full_name} ({officer.service_number})
                             </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedOfficer && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Station: {selectedOfficer.current_station_name} ({selectedOfficer.current_station_code})
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={userAccountForm.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>System Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={userAccountForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="Optional email address" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={userAccountForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" placeholder="Set an initial password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={!userAccountForm.formState.isValid}><KeyRound className="mr-2 h-4 w-4" /> Create Account</Button>
                  </DialogFooter>
                </form>
              </Form>
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
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
