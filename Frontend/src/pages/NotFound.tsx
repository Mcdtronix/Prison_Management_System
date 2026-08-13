import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gavel } from 'lucide-react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { useAuth } from '@/contexts/AuthContext';

const NotFound = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const content = (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
      <div className="p-4 rounded-full bg-green-50 mb-6">
        <Gavel className="h-12 w-12 text-[#0b4f2a]" />
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Page Not Found</h2>
      <p className="text-gray-500 text-center max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <div className="flex space-x-4">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
        <Button 
          className="bg-[#0b4f2a] hover:bg-[#063f20]"
          onClick={() => navigate('/')}
        >
          Return Home
        </Button>
      </div>
    </div>
  );

  if (user) {
    return (
      <PrisonLayout title="Page Not Found">
        {content}
      </PrisonLayout>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {content}
    </div>
  );
};

export default NotFound;
