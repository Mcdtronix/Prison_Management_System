
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface InmateBasicInfoProps {
  inmate: {
    id: string;
    name?: string;
    first_name?: string;
    surname?: string;
    date_of_birth?: string;
    prison_number: string;
    photo_url?: string;
    age?: number;
    gender: string;
    admission_date: string;
  };
}

export const InmateBasicInfo: React.FC<InmateBasicInfoProps> = ({ inmate }) => {
  const navigate = useNavigate();

  const calculateAge = (dob?: string) => {
    if (!dob) return 'Unknown';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  const displayAge = inmate.age || calculateAge(inmate.date_of_birth);
  const fullName = inmate.first_name && inmate.surname 
    ? `${inmate.first_name} ${inmate.surname}` 
    : inmate.name || 'Unknown Inmate';

  return (
    <Card>
      <CardHeader className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden">
          {inmate.photo_url ? (
            <img 
              src={inmate.photo_url} 
              alt={fullName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#F1F0FB]">
              <User className="h-12 w-12 text-[#7E69AB]" />
            </div>
          )}
        </div>
        <CardTitle className="text-xl">{fullName}</CardTitle>
        <CardDescription>
          Prison Number: {inmate.prison_number || 'N/A'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Age:</span>
            <span className="text-sm">{displayAge} {displayAge !== 'Unknown' && 'years'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Gender:</span>
            <span className="text-sm">{inmate.gender}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between">
            <span className="text-sm font-medium">Admission Date:</span>
            <span className="text-sm">{new Date(inmate.admission_date).toLocaleDateString()}</span>
          </div>
          
          <div className="mt-4">
            <Button 
              className="w-full"
              variant="outline"
              onClick={() => navigate(`/health/inmate/${inmate.id}/opd/new`)}
            >
              Record OPD Visit
            </Button>
            
            <Button 
              className="w-full mt-2"
              variant="outline"
              onClick={() => navigate(`/health/inmate/${inmate.id}/opd`)}
            >
              View OPD History
            </Button>
            
            <Button 
              className="w-full mt-2"
              variant="outline"
              onClick={() => navigate(`/inmates/${inmate.id}`)}
            >
              View Full Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
