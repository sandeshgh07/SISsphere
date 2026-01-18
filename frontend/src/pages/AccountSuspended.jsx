import React from 'react';
import { Lock } from 'lucide-react';

const AccountSuspended = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border-t-8 border-nepsis-alert">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-4 rounded-full">
            <Lock className="w-12 h-12 text-nepsis-alert" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-nepsis-primary mb-4">Account Suspended</h1>
        <p className="text-gray-600 mb-8 text-lg">
          Your school's subscription has expired and the grace period has ended.
          Access to the system has been restricted.
        </p>
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-lg text-sm text-gray-700">
             To restore access, please contact the finance department or renew your subscription immediately.
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="text-nepsis-primary font-medium hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSuspended;
