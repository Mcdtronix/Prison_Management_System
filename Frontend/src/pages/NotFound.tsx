
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gavel } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="p-4 rounded-full bg-[#F1F0FB] mb-6">
        <Gavel className="h-12 w-12 text-[#9b87f5]" />
      </div>
      <h1 className="text-4xl font-bold text-[#1A1F2C] mb-2">404</h1>
      <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
      <p className="text-gray-600 text-center max-w-md mb-8">
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
          className="bg-[#9b87f5] hover:bg-[#7E69AB]"
          onClick={() => navigate('/')}
        >
          Return Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
