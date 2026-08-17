import React, { useState, useEffect } from 'react';
import { reportsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
import { QueryBuilder, FilterGroup } from './components/QueryBuilder';

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
  const [fieldsSchema, setFieldsSchema] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'report'>('list');

  // Create Template State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterGroup>({ operator: 'AND', conditions: [] });
  const [creating, setCreating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [baseModel, setBaseModel] = useState('Inmate');
  const { user } = useAuth();

  const getAvailableBaseModels = () => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_OFFICER') {
      return [
        { value: 'Inmate', label: 'Inmate Report' },
        { value: 'Officer', label: 'Officer Report' },
        { value: 'Patient', label: 'Health - Patients' },
        { value: 'OutPatientVisit', label: 'Health - OPD Visits' },
        { value: 'ChronicPatient', label: 'Health - Chronic Patients' },
        { value: 'Medicine', label: 'Health - Medicine Inventory' },
      ];
    }
    if (user?.role === 'HEALTH_OFFICER') {
      return [
        { value: 'Patient', label: 'Patients Report' },
        { value: 'OutPatientVisit', label: 'OPD Visits Report' },
        { value: 'ChronicPatient', label: 'Chronic Patients Report' },
        { value: 'Medicine', label: 'Medicine Inventory Report' },
      ];
    }
    // Default for Reception, etc.
    return [
      { value: 'Inmate', label: 'Inmate Report' }
    ];
  };

  const availableBaseModels = getAvailableBaseModels();

  useEffect(() => {
    if (availableBaseModels.length > 0 && !availableBaseModels.find(m => m.value === baseModel)) {
      setBaseModel(availableBaseModels[0].value);
    }
  }, [user?.role]);

  // Report View State
  const [currentReport, setCurrentReport] = useState<any[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchFieldsSchema(baseModel);
    setSelectedFields([]); // Clear fields when changing base model
  }, [baseModel]);

  const fetchTemplates = async () => {
    try {
      const res = await reportsApi.getTemplates();
      const data = (res as any)?.results || (res as any)?.data?.results || res.data || [];
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch templates", e);
    }
  };

  const fetchFieldsSchema = async (model: string) => {
    try {
      const res = await reportsApi.getAvailableFields(model);
      setFieldsSchema(res.fields || res.data?.fields || []);
    } catch (e) {
      console.error("Failed to fetch fields schema", e);
      setFieldsSchema([]);
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
        base_model: baseModel,
        selected_fields: selectedFields,
        filters: filters,
      });
      await fetchTemplates();
      setView('list');
      setNewTemplateName('');
      setSelectedFields([]);
      setFilters({ operator: 'AND', conditions: [] });
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
    setExcludedIds([]);
    try {
      const res = await reportsApi.generateReport(template.id);
      if (res.error) {
        throw new Error(res.error);
      }
      setCurrentReport(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (e: any) {
      console.error("Failed to generate report", e);
      alert(`Failed to generate report: ${e.message || 'Unknown error'}`);
      setView('list');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!currentTemplate) return;
    setExportingFormat(format);
    try {
      const blob = await reportsApi.generateReport(currentTemplate.id, format, excludedIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      const ext = format === 'excel' ? 'xlsx' : format;
      a.setAttribute('download', `${currentTemplate?.name || 'report'}.${ext}`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(`Failed to export ${format}`, e);
      alert(`Failed to export: ${e.message || 'Unknown error'}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const activeColumns = React.useMemo(() => {
    if (!currentTemplate || !currentReport || currentReport.length === 0) return [];
    return currentTemplate.selected_fields;
  }, [currentTemplate, currentReport]);

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

  const getFieldVerboseName = (fieldName: string) => {
    const field = fieldsSchema.find(f => f.key === fieldName);
    return field ? `${field.group}: ${field.label}` : fieldName;
  };

  const groupedFields = fieldsSchema.reduce((acc: any, field: any) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {});

  return (
    <PrisonLayout
      title="Report Builder"
      description="Create and generate custom reports from available data using a visual query builder."
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
                <CardDescription>Name your report and select the base data model.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 max-w-md">
                  {availableBaseModels.length > 1 && (
                    <div className="space-y-2">
                      <Label>Report Type (Base Data)</Label>
                      <select 
                        value={baseModel}
                        onChange={(e) => setBaseModel(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#0b4f2a] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {availableBaseModels.map(model => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input 
                      value={newTemplateName} 
                      onChange={e => setNewTemplateName(e.target.value)} 
                      placeholder="e.g., Monthly Inmate Admissions" 
                      className="border-gray-300 focus-visible:ring-[#0b4f2a]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-[#0b4f2a] shrink-0">
              <CardHeader>
                <CardTitle>Filters (Where Clause)</CardTitle>
                <CardDescription>Visually construct conditions using AND/OR groups.</CardDescription>
              </CardHeader>
              <CardContent>
                <QueryBuilder group={filters} onChange={setFilters} fieldsSchema={fieldsSchema} />
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
                {Object.entries(groupedFields).map(([groupName, fields]: any) => (
                  <div key={groupName} className="space-y-3">
                    <h4 className="font-bold text-sm text-[#0b4f2a] uppercase tracking-wider">{groupName}</h4>
                    <div className="space-y-2">
                      {fields.map((field: any) => {
                        const isSelected = selectedFields.includes(field.key);
                        return (
                          <label 
                            key={field.key} 
                            className={`flex items-start space-x-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-[#0b4f2a]/5 border border-[#0b4f2a]/20' : 'hover:bg-gray-50'}`}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleFieldSelection(field.key)}
                              className="mt-0.5"
                            />
                            <div className="grid gap-1 leading-none">
                              <span className="text-sm font-medium">{field.label}</span>
                              <span className="text-[0.7rem] text-muted-foreground">{field.type}</span>
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
          <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b flex-wrap gap-4">
            <div>
              <CardTitle className="text-xl text-[#0b4f2a]">{currentTemplate?.name}</CardTitle>
              <CardDescription>Generated Report Data ({currentReport.filter(r => !excludedIds.includes(r._id)).length} records shown)</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => handleExport('csv')} disabled={generating || currentReport.length === 0 || exportingFormat !== null} variant="outline" className="border-[#0b4f2a] text-[#0b4f2a]">
                {exportingFormat === 'csv' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} CSV
              </Button>
              <Button onClick={() => handleExport('excel')} disabled={generating || currentReport.length === 0 || exportingFormat !== null} variant="outline" className="border-[#0b4f2a] text-[#0b4f2a]">
                {exportingFormat === 'excel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Excel
              </Button>
              <Button onClick={() => handleExport('pdf')} disabled={generating || currentReport.length === 0 || exportingFormat !== null} className="bg-[#d7a928] hover:bg-[#c29620] text-[#0b4f2a] font-bold">
                {exportingFormat === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {generating ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <RefreshCw className="h-10 w-10 animate-spin mb-4 text-[#0b4f2a]" />
                <p className="font-medium text-lg text-gray-700">Crunching data...</p>
                <p className="text-sm">Please wait while we generate your report.</p>
              </div>
            ) : currentReport.filter(r => !excludedIds.includes(r._id)).length === 0 ? (
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
                      <TableHead className="whitespace-nowrap font-bold text-gray-700 w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentReport.filter(row => !excludedIds.includes(row._id)).map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                        {activeColumns.map((field: string) => (
                          <TableCell key={field} className="whitespace-nowrap">
                            {row[field] !== null && row[field] !== undefined && row[field] !== '' ? String(row[field]) : '-'}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setExcludedIds([...excludedIds, row._id])} className="text-gray-400 hover:text-red-600 h-8 w-8 p-0" title="Remove from report">
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
    </div>
    </PrisonLayout>
  );
}
