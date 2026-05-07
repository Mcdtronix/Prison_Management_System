
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const NotFoundState: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10">
        <p className="mb-4 text-muted-foreground">The requested inmate could not be found.</p>
        <Button onClick={() => navigate('/health')}>Return to Dashboard</Button>
      </CardContent>
    </Card>
  );
};
