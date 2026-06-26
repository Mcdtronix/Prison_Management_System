// Force HMR reload
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rbacApi, authApi } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const assignmentSchema = z.object({
  user: z.string().min(1, 'User ID is required'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
  org_unit: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

const UserAssignmentManagement = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      user: '',
      role: '',
      department: '',
      org_unit: '',
    },
    mode: 'onChange',
  });

  const fetchData = async () => {
    setLoading(true);
    const [assnRes, rolesRes, deptRes, usersRes] = await Promise.all([
      rbacApi.getUserAssignments(),
      rbacApi.getRoles(),
      rbacApi.getDepartments(),
      authApi.getUsers()
    ]);
    if (assnRes.data) setAssignments(Array.isArray(assnRes.data) ? assnRes.data : (assnRes.data as any).results || []);
    if (rolesRes.data) setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : (rolesRes.data as any).results || []);
    if (deptRes.data) setDepartments(Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data as any).results || []);
    if (usersRes.data) setUsers(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data as any).results || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSubmit = async (data: AssignmentFormValues) => {
    try {
      const payload = { ...data, is_active: true, is_primary: true };
      await rbacApi.createUserAssignment(payload);
      toast({ title: "Assignment created" });
      setDialogOpen(false);
      form.reset();
      fetchData();
    } catch (err) {
      toast({ title: "Error creating assignment", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to revoke this assignment?")) return;
    try {
      await rbacApi.deleteUserAssignment(id);
      toast({ title: "Assignment revoked" });
      fetchData();
    } catch (err) {
      toast({ title: "Error revoking assignment", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Assignments</CardTitle>
          <CardDescription>Manage which users have which roles in your station</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) form.reset(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Assign Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role</DialogTitle>
              <DialogDescription>Assign a system role and department to a user account.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Account</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a user..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.username} {u.officer_name ? `(${u.officer_name})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="org_unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Org Unit ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Defaults to current station..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a department..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!form.formState.isValid}>Save Assignment</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p>Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="px-4 py-3 font-medium">
                      {a.full_name || a.username || `User ID: ${a.user}`}
                    </td>
                    <td className="px-4 py-3">{a.role_name || a.role}</td>
                    <td className="px-4 py-3">{a.department_name || a.department}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${a.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {a.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No assignments found for your station.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserAssignmentManagement;
