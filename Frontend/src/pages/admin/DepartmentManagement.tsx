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

const departmentSchema = z.object({
  id: z.number().nullable().optional(),
  code: z.string().min(2, 'Code must be at least 2 characters').max(50, 'Code too long').regex(/^[A-Z0-9_]+$/, 'Only uppercase letters, numbers, and underscores allowed'),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      id: null,
      code: '',
      name: '',
      description: '',
      active: true,
    },
    mode: 'onChange', // Enables real-time validation
  });

  const fetchDepartments = async () => {
    setLoading(true);
    const res = await rbacApi.getDepartments();
    if (res.data) setDepartments(Array.isArray(res.data) ? res.data : (res.data as any).results || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const onSubmit = async (data: DepartmentFormValues) => {
    try {
      if (data.id) {
        await rbacApi.updateDepartment(data.id, data);
        toast({ title: "Department updated" });
      } else {
        await rbacApi.createDepartment(data);
        toast({ title: "Department created" });
      }
      setDialogOpen(false);
      form.reset();
      fetchDepartments();
    } catch (err) {
      toast({ title: "Error saving department", variant: "destructive" });
    }
  };

  const handleEdit = (dept: any) => {
    form.reset({
      id: dept.id,
      code: dept.code,
      name: dept.name,
      description: dept.description || '',
      active: dept.active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    try {
      await rbacApi.deleteDepartment(id);
      toast({ title: "Department deleted" });
      fetchDepartments();
    } catch (err) {
      toast({ title: "Error deleting department", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Department Management</CardTitle>
          <CardDescription>Manage organizational departments</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) form.reset({ id: null, code: '', name: '', description: '', active: true }); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.getValues('id') ? 'Edit Department' : 'Create New Department'}</DialogTitle>
              <DialogDescription>Define a new department within the organization.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. RECEPTION" {...field} />
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
                        <FormLabel>Department Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Reception / Admissions" {...field} />
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
                        <Input placeholder="Department description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active Department</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!form.formState.isValid}>Save Department</Button>
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
                {departments.map(dept => (
                  <tr key={dept.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{dept.code}</td>
                    <td className="px-4 py-3">{dept.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${dept.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {dept.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(dept)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(dept.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No departments found.
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

export default DepartmentManagement;
