import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, ShieldPlus } from "lucide-react";

import { authApi } from "@/lib/api";
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

interface RoleOption {
  id: number;
  code: string;
  name: string;
}

const OfficerManagement = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<ManagedUserProfile[]>([]);
  const [officerOptions, setOfficerOptions] = useState<OfficerOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [formData, setFormData] = useState({
    officer: "",
    role: "",
    password: "",
    email: "",
  });

  const loadData = async (background = false) => {
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [usersResponse, optionsResponse] = await Promise.all([
        authApi.getUsers(),
        authApi.getUserCreationOptions(),
      ]);

      if (usersResponse.error) {
        throw new Error(usersResponse.error);
      }

      if (optionsResponse.error) {
        throw new Error(optionsResponse.error);
      }

      setUsers((usersResponse.data as ManagedUserProfile[]) || []);
      setOfficerOptions(optionsResponse.data?.officers || []);
      setRoleOptions(optionsResponse.data?.roles || []);
    } catch (error) {
      toast({
        title: "Unable to load user accounts",
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
    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [user.username, user.officer_name, user.officer_service_number, user.role_name, user.station_name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [searchQuery, users]);

  const resetForm = () => {
    setFormData({
      officer: "",
      role: "",
      password: "",
      email: "",
    });
  };

  const selectedOfficer = officerOptions.find((officer) => officer.service_number === formData.officer);

  const handleCreate = async () => {
    if (!formData.officer || !formData.role || !formData.password) {
      toast({
        title: "Missing information",
        description: "Officer, role, and password are required.",
        variant: "destructive",
      });
      return;
    }

    const roleId = Number(formData.role);
    if (Number.isNaN(roleId)) {
      toast({
        title: "Invalid role",
        description: "Please select a valid role.",
        variant: "destructive",
      });
      return;
    }

    const response = await authApi.createUserFromOfficer({
      officer: formData.officer,
      role: roleId,
      password: formData.password,
      email: formData.email || undefined,
    });

    if (response.error) {
      toast({
        title: "Account creation failed",
        description: response.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "System account created",
      description: `${selectedOfficer?.full_name || formData.officer} can now sign in with service number ${formData.officer}.`,
    });

    resetForm();
    setDialogOpen(false);
    loadData(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle>Officer User Accounts</CardTitle>
          <CardDescription>
            Create login accounts only from existing officer records. Username is set to the officer&apos;s service number.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={officerOptions.length === 0}>
                <ShieldPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Officer Account</DialogTitle>
                <DialogDescription>
                  Select an eligible officer, assign a system role, and set a starting password.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="officer">Officer</Label>
                  <Select
                    value={formData.officer}
                    onValueChange={(value) => setFormData((current) => ({ ...current, officer: value }))}
                  >
                    <SelectTrigger id="officer">
                      <SelectValue placeholder="Select an officer" />
                    </SelectTrigger>
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
                  <Label htmlFor="role">System Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData((current) => ({ ...current, role: value }))}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Optional email address"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Set an initial password"
                    value={formData.password}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Create Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            className="max-w-md"
            placeholder="Search by officer, service number, role, or station"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Eligible officers without accounts: {officerOptions.length}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8 text-sm text-muted-foreground">
            Loading officer accounts...
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Officer</TableHead>
                  <TableHead>Service Number</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
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
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
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
  );
};

export default OfficerManagement;
