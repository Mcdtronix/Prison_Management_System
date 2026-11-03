import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rbacApi } from '@/lib/api';
import { Plus, Edit, Trash2, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

const roleSchema = z.object({
  id: z.number().nullable().optional(),
  code: z.string().min(2, 'Code must be at least 2 characters').max(50, 'Code too long').regex(/^[A-Z0-9_]+$/, 'Only uppercase letters, numbers, and underscores allowed'),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  department: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
});

type RoleFormValues = z.infer<typeof roleSchema>;

const EMPTY: RoleFormValues = { id: null, code: '', name: '', description: '', department: null, is_active: true };

const asList = (data: any) => (Array.isArray(data) ? data : data?.results || []);

const RoleManagement = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBuiltin, setEditingBuiltin] = useState(false);
  const { toast } = useToast();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: EMPTY,
    mode: 'onChange',
  });

  const fetchRoles = async () => {
    setLoading(true);
    const [rolesRes, deptRes] = await Promise.all([rbacApi.getRoles(), rbacApi.getDepartments()]);
    setRoles(asList(rolesRes.data));
    setDepartments(asList(deptRes.data).filter((d: any) => d.active));
    setLoading(false);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const onSubmit = async (data: RoleFormValues) => {
    // Built-in roles send their locked fields unchanged; the server rejects any change to them.
    const payload = { ...data, department: data.department ?? null };
    const res = data.id ? await rbacApi.updateRole(data.id, payload) : await rbacApi.createRole(payload);
    if (res.error) {
      toast({ title: 'Could not save role', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: data.id ? 'Role updated' : 'Role created' });
    setDialogOpen(false);
    form.reset(EMPTY);
    fetchRoles();
  };

  const handleEdit = (role: any) => {
    setEditingBuiltin(!!role.is_system);
    form.reset({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description || '',
      department: role.department ?? null,
      is_active: role.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (role: any) => {
    if (!window.confirm(`Delete the role ${role.name}?`)) return;
    const res = await rbacApi.deleteRole(role.id);
    if (res.error) {
      toast({ title: 'Could not delete role', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Role deleted' });
    fetchRoles();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>
            Built-in roles are fixed. Add your own roles for other duties; each role can belong to a department.
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { form.reset(EMPTY); setEditingBuiltin(false); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBuiltin(false)}>
              <Plus className="w-4 h-4 mr-2" /> New Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.getValues('id') ? 'Edit Role' : 'Create New Role'}</DialogTitle>
              <DialogDescription>
                {editingBuiltin
                  ? 'This is a built-in role. Only its name and description can be changed.'
                  : 'Define a role, its department and whether it is active.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. WARDEN" disabled={editingBuiltin} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Chief Warden" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                          disabled={editingBuiltin}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">Any department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Role description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!editingBuiltin && (
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Active Role</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!form.formState.isValid}>Save Role</Button>
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
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id} className="border-b">
                    <td className="px-4 py-3 font-medium">
                      {role.code}
                      {role.is_system && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          <Lock className="w-3 h-3" /> Built-in
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{role.name}</td>
                    <td className="px-4 py-3">{role.department_name || <span className="text-muted-foreground">Any</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${role.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(role)} aria-label={`Edit ${role.name}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!role.is_system && (
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(role)} aria-label={`Delete ${role.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No roles found.
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

export default RoleManagement;
