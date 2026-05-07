
import React from 'react';

export const LoadingState: React.FC = () => {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9b87f5] mx-auto mb-4"></div>
        <p>Loading inmate information...</p>
      </div>
    </div>
  );
};
