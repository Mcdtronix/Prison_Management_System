import React, { useState, useEffect } from 'react';
import { reportsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Loader2, Plus, Download, Trash2, FileText, ArrowLeft, RefreshCw, GripVertical, ChevronRight, ChevronLeft } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PrisonLayout } from '@/components/PrisonLayout';

function SortableItem({ id, label, onRemove }: { id: string, label: string, onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 border rounded mb-2 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:border-[#d7a928] transition-colors">
      <div className="flex items-center gap-3" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRemove(id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ReportBuilder() {
  const [fieldsSchema, setFieldsSchema] = useState<any>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'report'>('list');

  // Create Template State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Report View State
  const [currentReport, setCurrentReport] = useState<any[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchFieldsSchema();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await reportsApi.getTemplates();
      const data = (res.data as any)?.results || res.data || [];
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch templates", e);
    }
  };

  const fetchFieldsSchema = async () => {
    try {
      const res = await reportsApi.getAvailableFields();
      setFieldsSchema(res.data);
    } catch (e) {
      console.error("Failed to fetch fields schema", e);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName || selectedFields.length === 0) {
      alert('Please provide a name and select at least one field.');
      return;
    }
    setCreating(true);
    try {
      await reportsApi.createTemplate({
        name: newTemplateName,
        base_model: "Inmate",
        selected_fields: selectedFields,
      });
      await fetchTemplates();
      setView('list');
      setNewTemplateName('');
      setSelectedFields([]);
    } catch (e) {
      console.error("Failed to create template", e);
      alert("Failed to create template");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await reportsApi.deleteTemplate(id);
      fetchTemplates();
    } catch (e) {
      console.error("Failed to delete template", e);
    }
  };

  const handleGenerateReport = async (template: any) => {
    setGenerating(true);
    setCurrentTemplate(template);
    setView('report');
    try {
      const res = await reportsApi.generateReport(template.id);
      if (res.error) {
        throw new Error(res.error);
      }
      setCurrentReport(res.data.data);
    } catch (e: any) {
      console.error("Failed to generate report", e);
      alert(`Failed to generate report: ${e.message || 'Unknown error'}`);
      setView('list');
    } finally {
      setGenerating(false);
    }
  };

  const activeColumns = React.useMemo(() => {
    if (!currentTemplate || !currentReport || currentReport.length === 0) return [];
    return currentTemplate.selected_fields.filter((field: string) => {
      return currentReport.some(row => {
        const val = row[field];
        return val !== null && val !== undefined && val !== '';
      });
    });
  }, [currentTemplate, currentReport]);

  const handleExportCSV = () => {
    if (!currentReport || currentReport.length === 0) return;
    
    const headers = activeColumns.length > 0 ? activeColumns : Object.keys(currentReport[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of currentReport) {
      const values = headers.map((header: string) => {
        const val = row[header];
        const escaped = ('' + (val || '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${currentTemplate?.name || 'report'}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleFieldSelection = (fieldName: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldName) ? prev.filter(f => f !== fieldName) : [...prev, fieldName]
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSelectedFields((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Helper to get verbose name for a field key
  const getFieldVerboseName = (fieldName: string) => {
    for (const modelKey in fieldsSchema) {
      const field = fieldsSchema[modelKey].fields.find((f: any) => f.name === fieldName);
      if (field) return field.verbose_name || field.name;
    }
    return fieldName;
  };

  return (
    <PrisonLayout
      title="Report Builder"
      description="Create and generate custom reports from available data."
    >
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          {view === 'list' && (
            <Button onClick={() => setView('create')} className="bg-[#0b4f2a] hover:bg-[#063f20]">
              <Plus className="mr-2 h-4 w-4" /> Create Template
            </Button>
          )}
          {view !== 'list' && (
            <Button variant="outline" onClick={() => setView('list')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Templates
            </Button>
          )}
        </div>

      {view === 'list' && (
        <Card className="border-t-4 border-t-[#d7a928]">
          <CardHeader>
            <CardTitle>Saved Templates</CardTitle>
            <CardDescription>Select a template to generate a report.</CardDescription>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No templates found</h3>
                <p className="text-gray-500 mt-1">Create your first report template to get started.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map(t => (
                      <TableRow key={t.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-semibold">{t.name}</TableCell>
                        <TableCell>{t.created_by_name || 'System User'}</TableCell>
                        <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="mr-2 border-[#0b4f2a] text-[#0b4f2a] hover:bg-[#0b4f2a] hover:text-white" onClick={() => handleGenerateReport(t)}>
                            Generate
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteTemplate(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'create' && (
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-10">
            <Card className="border-t-4 border-t-[#0b4f2a] shrink-0">
              <CardHeader>
                <CardTitle>Report Details</CardTitle>
                <CardDescription>Name your report and arrange your selected columns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label>Template Name</Label>
                  <Input 
                    value={newTemplateName} 
                    onChange={e => setNewTemplateName(e.target.value)} 
                    placeholder="e.g., Monthly Inmate Admissions" 
                    className="border-gray-300 focus-visible:ring-[#0b4f2a]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 min-h-[300px]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Selected Columns ({selectedFields.length})</CardTitle>
                  <CardDescription>Drag and drop to reorder how they will appear in the report.</CardDescription>
                </div>
                {!isSidebarOpen && (
                  <Button variant="outline" size="sm" onClick={() => setIsSidebarOpen(true)} className="border-[#0b4f2a] text-[#0b4f2a]">
                    Add Columns <ChevronLeft className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {selectedFields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-gray-50 border-gray-200">
                    <FileText className="h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-sm font-medium text-gray-900">No columns selected</p>
                    <p className="text-sm text-gray-500">Select fields from the sidebar to add them to your report.</p>
                  </div>
                ) : (
                  <div className="max-w-2xl bg-gray-50/50 p-4 rounded-lg border">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={selectedFields} strategy={verticalListSortingStrategy}>
                        {selectedFields.map(id => (
                          <SortableItem key={id} id={id} label={getFieldVerboseName(id)} onRemove={toggleFieldSelection} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                <div className="mt-8">
                  <Button onClick={handleCreateTemplate} disabled={creating || selectedFields.length === 0} className="bg-[#d7a928] hover:bg-[#c29620] text-[#0b4f2a] font-bold">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Save Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Toggleable Sidebar for Available Fields */}
          {isSidebarOpen && (
            <Card className="w-80 shrink-0 flex flex-col h-full border-t-4 border-t-[#d7a928]">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between shrink-0">
                <div>
                  <CardTitle className="text-base">Available Data</CardTitle>
                  <CardDescription className="text-xs">Tick to add to report</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8 p-0">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
                {Object.entries(fieldsSchema).map(([modelKey, modelInfo]: any) => (
                  <div key={modelKey} className="space-y-3">
                    <h4 className="font-bold text-sm text-[#0b4f2a] uppercase tracking-wider">{modelInfo.verbose_name}</h4>
                    <div className="space-y-2">
                      {modelInfo.fields.map((field: any) => {
                        const isSelected = selectedFields.includes(field.name);
                        return (
                          <label 
                            key={field.name} 
                            className={`flex items-start space-x-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-[#0b4f2a]/5 border border-[#0b4f2a]/20' : 'hover:bg-gray-50'}`}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleFieldSelection(field.name)}
                              className="mt-0.5"
                            />
                            <div className="grid gap-1 leading-none">
                              <span className="text-sm font-medium">{field.verbose_name || field.name}</span>
                              <span className="text-[0.7rem] text-muted-foreground">{field.type.replace('Field', '')}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {view === 'report' && (
        <Card className="border-t-4 border-t-[#0b4f2a]">
          <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b">
            <div>
              <CardTitle className="text-xl text-[#0b4f2a]">{currentTemplate?.name}</CardTitle>
              <CardDescription>Generated Report Data ({currentReport.length} rows)</CardDescription>
            </div>
            <Button onClick={handleExportCSV} disabled={generating || currentReport.length === 0} className="bg-[#d7a928] hover:bg-[#c29620] text-[#0b4f2a] font-bold">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {generating ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <RefreshCw className="h-10 w-10 animate-spin mb-4 text-[#0b4f2a]" />
                <p className="font-medium text-lg text-gray-700">Crunching data...</p>
                <p className="text-sm">Please wait while we generate your report.</p>
              </div>
            ) : currentReport.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No data available</h3>
                <p className="text-gray-500 mt-1">There are no records matching the selected attributes.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto shadow-sm">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      {activeColumns.map((field: string) => (
                        <TableHead key={field} className="whitespace-nowrap font-bold text-gray-700">
                          {getFieldVerboseName(field)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentReport.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                        {activeColumns.map((field: string) => (
                          <TableCell key={field} className="whitespace-nowrap">
                            {row[field] !== null && row[field] !== undefined && row[field] !== '' ? String(row[field]) : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </PrisonLayout>
  );
}
