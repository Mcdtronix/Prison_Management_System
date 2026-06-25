import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { OPDVisitFormValues } from '../components/OPDVisitForm';

export const useOPDVisit = (inmateId: string | undefined) => {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (data: OPDVisitFormValues & { attended_by: string }) => {
    if (!inmateId) return;
    
    setIsSaving(true);
    try {
      // Step 1: Ensure Patient object exists for this inmate
      let patientId = null;
      const patientRes = await healthApi.getPatientByInmateId(inmateId);
      
      if (patientRes.data && patientRes.data.results && patientRes.data.results.length > 0) {
        patientId = patientRes.data.results[0].id;
      } else {
        // Create the patient
        const createRes = await healthApi.createPatientForInmate(inmateId);
        if (createRes.error) {
          throw new Error('Failed to create patient record for inmate: ' + createRes.error);
        }
        patientId = createRes.data.id;
      }

      if (!patientId) throw new Error('Could not resolve patient ID.');

      // Step 2: Register the OPD Visit with the Patient ID
      const payload = {
        ...data,
        patient: patientId,
      };

      const response = await healthApi.registerOPDVisit(payload);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      toast({
        title: 'Success',
        description: 'OPD visit recorded successfully',
      });
      
      navigate(`/health/inmate/${inmateId}`);
      
    } catch (error: any) {
      console.error('Error saving OPD visit:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save OPD visit record',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/health/inmate/${inmateId}`);
  };

  return {
    isSaving,
    handleSubmit,
    handleCancel
  };
};
