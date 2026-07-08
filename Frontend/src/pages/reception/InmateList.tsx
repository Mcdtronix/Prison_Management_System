import React, { useState, useEffect } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { receptionApi } from '@/lib/api';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// Define the type for an inmate in the list
interface Inmate {
  id: number;
  prison_number: string;
  name: string;
  age: number;
  gender: string;
  admission_date: string;
  offense: string;
  status: string;
  classification: string;
  admission_status: string;
}

const InmateList = () => {
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<keyof Inmate | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchInmates = async () => {
      try {
        setLoading(true);
        // Build filters object
        const filters: Record<string, string> = {};
        if (statusFilter && statusFilter !== 'all') {
          filters.status = statusFilter;
        }
        if (classFilter && classFilter !== 'all') {
          filters.classification = classFilter;
        }

        const response = await receptionApi.getInmateList(searchTerm, filters);
        if (response.error) {
          throw new Error(response.error);
        }
        setInmates(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Simple debounce to prevent too many requests while typing
    const timeoutId = setTimeout(() => {
      fetchInmates();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, classFilter]);

  const handleSort = (field: keyof Inmate) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedInmates = [...inmates].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = String(a[sortField] || '').toLowerCase();
    const bVal = String(b[sortField] || '').toLowerCase();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <PrisonLayout
      title="Inmate Records"
      description="Search, filter, and view inmate details."
    >
      <Card className="shadow-sm border-t-4 border-t-blue-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl text-gray-800 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-blue-600" />
            Inmate Registry & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <Input
                placeholder="Search by name or prison number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="remand">Remand (Unconvicted)</SelectItem>
                  <SelectItem value="convicted">Convicted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-48">
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="A">Class A</SelectItem>
                  <SelectItem value="B">Class B</SelectItem>
                  <SelectItem value="C">Class C</SelectItem>
                  <SelectItem value="D">Class D</SelectItem>
                  <SelectItem value="PUSOD">PUSOD</SelectItem>
                  <SelectItem value="COND">Condemned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setClassFilter('all');
              }}
              className="w-full md:w-auto"
            >
              Clear
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p>Fetching records...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
              <p className="font-semibold">Failed to load inmates</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : inmates.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p>No inmates found matching your criteria.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead 
                      className="font-semibold cursor-pointer select-none hover:bg-gray-100" 
                      onClick={() => handleSort('prison_number')}
                    >
                      <div className="flex items-center">
                        Prison No.
                        {sortField === 'prison_number' ? (sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />) : <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold cursor-pointer select-none hover:bg-gray-100" 
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {sortField === 'name' ? (sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />) : <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold cursor-pointer select-none hover:bg-gray-100" 
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        {sortField === 'status' ? (sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />) : <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold cursor-pointer select-none hover:bg-gray-100" 
                      onClick={() => handleSort('classification')}
                    >
                      <div className="flex items-center">
                        Classification
                        {sortField === 'classification' ? (sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />) : <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">Offences</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInmates.map((inmate) => (
                    <TableRow key={inmate.id} className="hover:bg-blue-50/50 transition-colors">
                      <TableCell>
                        <Link to={`/inmates/${inmate.id}`} className="font-semibold text-blue-700 hover:text-blue-900 hover:underline">
                          {inmate.prison_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{inmate.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          inmate.status?.toLowerCase() === 'convicted' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {inmate.status || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                          {inmate.classification || 'Unclassified'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {inmate.offense || 'None'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PrisonLayout>
  );
};

export default InmateList;
