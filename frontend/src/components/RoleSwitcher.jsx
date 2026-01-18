import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, Check } from 'lucide-react';

const RoleSwitcher = () => {
  const { user, activeRole, availableRoles, switchRole } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  // If only 1 role or no user, show just static text or fallback
  if (!user || !availableRoles || availableRoles.length <= 1) {
    return (
        <div className="overflow-hidden text-white">
            <p className="text-sm font-medium truncate">{user?.sub || 'User'}</p>
            <p className="text-xs text-gray-400 capitalize">{(activeRole || user?.role || '').replace('_', ' ')}</p>
        </div>
    );
  }

  return (
    <div className="relative">
       <button
         onClick={() => setIsOpen(!isOpen)}
         className="flex flex-col items-start overflow-hidden text-white w-full focus:outline-none group"
       >
            <div className="flex items-center gap-1 w-full">
                <p className="text-sm font-medium truncate flex-1 text-left">{user.sub}</p>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''} group-hover:text-white`} />
            </div>
            <p className="text-xs text-nepsis-accent capitalize font-medium">{(activeRole || '').replace('_', ' ')}</p>
       </button>

       {isOpen && (
         <>
           <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
           <div className="absolute bottom-full left-0 w-64 mb-2 -ml-2 bg-white rounded-lg shadow-xl overflow-hidden z-20 text-gray-800 border border-gray-200">
              <div className="p-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Switch Access Level
              </div>
              <div className="max-h-60 overflow-y-auto">
                {availableRoles.map((role) => (
                    <button
                        key={role}
                        onClick={() => {
                            switchRole(role);
                            setIsOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors
                            ${role === activeRole ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-gray-600'}
                        `}
                    >
                        <span className="capitalize">{role.replace('_', ' ')}</span>
                        {role === activeRole && <Check size={16} className="text-blue-600" />}
                    </button>
                ))}
              </div>
           </div>
         </>
       )}
    </div>
  );
};

export default RoleSwitcher;
