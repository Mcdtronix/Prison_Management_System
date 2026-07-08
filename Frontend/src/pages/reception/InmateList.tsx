import React, { useState, useEffect } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { receptionApi } from '@/lib/api';
import { Link } from 'react-router-dom';

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
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchInmates = async () => {
      try {
        setLoading(true);
        const response = await receptionApi.getInmateList(searchTerm);
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

    fetchInmates();
  }, [searchTerm]);

  return (
    <PrisonLayout
      title="Inmate Records"
      description="Search, filter, and view inmate details."
    >
      <Card>
        <CardHeader>
          <CardTitle>Inmate List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-4">
            <Input
              placeholder="Search by name or prison number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prison No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Offences</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inmates.map((inmate) => (
                  <TableRow key={inmate.id}>
                    <TableCell>
                      <Link to={`/inmates/${inmate.id}`} className="text-[#0b4f2a] hover:underline">
                        {inmate.prison_number}
                      </Link>
                    </TableCell>
                    <TableCell>{inmate.name}</TableCell>
                    <TableCell>{inmate.status}</TableCell>
                    <TableCell>{inmate.classification}</TableCell>
                    <TableCell>{inmate.offense}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PrisonLayout>
  );
};

export default InmateList;
