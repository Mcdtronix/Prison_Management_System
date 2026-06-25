import { useNavigate } from 'react-router-dom';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Stethoscope, FileText, Home, Users, ThermometerIcon } from 'lucide-react';

const DischargeAssessments = () => {
  const navigate = useNavigate();

  return (
    <PrisonLayout
      title="Discharge Assessments"
      description="Inmates awaiting final health assessment before discharge"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-xl">Pending Discharge Assessments</CardTitle>
            <CardDescription>
              List of inmates scheduled for release that require a mandatory health assessment.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8 text-gray-500 flex-col items-center gap-4">
            <Stethoscope className="h-12 w-12 text-gray-300" />
            <p>No inmates currently pending discharge assessment.</p>
          </div>
        </CardContent>
      </Card>
    </PrisonLayout>
  );
};

export default DischargeAssessments;
