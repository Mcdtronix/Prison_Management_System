import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rbacApi } from '@/lib/api';
import { Plus, Edit, Trash2 } from 'lucide-react';
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
  is_active: z.boolean().default(true),
});

type RoleFormValues = z.infer<typeof roleSchema>;

const RoleManagement = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      id: null,
      code: '',
      name: '',
      description: '',
      is_active: true,
    },
    mode: 'onChange', // Enables real-time validation
  });

  const fetchRoles = async () => {
    setLoading(true);
    const res = await rbacApi.getRoles();
    if (res.data) setRoles(Array.isArray(res.data) ? res.data : (res.data as any).results || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const onSubmit = async (data: RoleFormValues) => {
    try {
      if (data.id) {
        await rbacApi.updateRole(data.id, data);
        toast({ title: "Role updated" });
      } else {
        await rbacApi.createRole(data);
        toast({ title: "Role created" });
      }
      setDialogOpen(false);
      form.reset();
      fetchRoles();
    } catch (err) {
      toast({ title: "Error saving role", variant: "destructive" });
    }
  };

  const handleEdit = (role: any) => {
    form.reset({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    try {
      await rbacApi.deleteRole(id);
      toast({ title: "Role deleted" });
      fetchRoles();
    } catch (err) {
      toast({ title: "Error deleting role", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Manage system roles and access levels</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) form.reset({ id: null, code: '', name: '', description: '', is_active: true }); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.getValues('id') ? 'Edit Role' : 'Create New Role'}</DialogTitle>
              <DialogDescription>Define a new role and its operational status.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. WARDEN" {...field} />
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{role.code}</td>
                    <td className="px-4 py-3">{role.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${role.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
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
