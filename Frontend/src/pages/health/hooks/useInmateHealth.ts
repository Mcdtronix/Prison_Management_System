
import { useState, useEffect } from 'react';
import { inmateApi, healthApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { HealthFormValues } from '../components/HealthRecordForm';

export const useInmateHealth = (id: string | undefined) => {
  const [inmate, setInmate] = useState<any>(null);
  const [healthRecord, setHealthRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch inmate data and health record if it exists
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        // Fetch inmate basic info
        const inmateResponse = await inmateApi.getInmateDetails(id);
        if (inmateResponse.data) {
          setInmate(inmateResponse.data);
        }
        
        // Fetch health record if it exists
        const healthResponse = await healthApi.getInmateHealthRecord(id);
        if (healthResponse.data) {
          setHealthRecord(healthResponse.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch inmate information',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [id, toast]);

  // Handle form submission
  const handleSubmit = async (data: HealthFormValues) => {
    if (!id) return;
    
    setIsSaving(true);
    try {
      let response;
      
      if (healthRecord) {
        // Update existing record
        response = await healthApi.updateHealthRecord(healthRecord.id, data);
      } else {
        // Create new record
        const payload = { ...data, inmate: id };
        response = await healthApi.createHealthRecord(payload);
      }
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      toast({
        title: 'Success',
        description: healthRecord
          ? 'Health record updated successfully'
          : 'Health record created successfully',
      });
      
      // Set or update the health record state
      setHealthRecord(response.data);
      
    } catch (error) {
      console.error('Error saving health record:', error);
      toast({
        title: 'Error',
        description: 'Failed to save health record',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    inmate,
    healthRecord,
    isLoading,
    isSaving,
    handleSubmit,
  };
};
