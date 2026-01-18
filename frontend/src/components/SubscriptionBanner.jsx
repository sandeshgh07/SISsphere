import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SubscriptionBanner = () => {
  const { user } = useAuth();
  const [showWarningModal, setShowWarningModal] = useState(false);

  if (!user || !user.subscription_expiry) return null;

  const expiry = new Date(user.subscription_expiry);
  const now = new Date();

  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  useEffect(() => {
     if (diffDays <= 30 && diffDays > 0) {
        const lastShown = localStorage.getItem('last_subscription_warning');
        const today = new Date().toDateString();
        if (lastShown !== today) {
            setShowWarningModal(true);
            localStorage.setItem('last_subscription_warning', today);
        }
     }
  }, [diffDays]);

  if (diffDays > 30) return null;

  const isExpired = diffDays <= 0;

  if (!isExpired) {
      return (
        <AnimatePresence>
            {showWarningModal && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                >
                    <motion.div
                        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border-t-8 border-yellow-500"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-2xl font-bold text-nepsis-primary">Action Required</h2>
                            <button onClick={() => setShowWarningModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <p className="text-lg text-gray-700 mb-6">
                            Your school's subscription will expire in <span className="font-bold text-nepsis-alert">{diffDays} days</span>.
                        </p>
                        <div className="bg-yellow-50 p-4 rounded-lg mb-6 border border-yellow-100">
                             Please renew your plan to avoid service interruption.
                        </div>
                         <button
                            onClick={() => setShowWarningModal(false)}
                            className="w-full py-3 bg-nepsis-primary text-white rounded-lg font-bold hover:bg-opacity-90"
                        >
                            Acknowledge
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
      );
  }

  const daysPast = Math.abs(diffDays);
  const graceRemaining = 33 - daysPast;

  if (graceRemaining < 0) return null;

  const isPhase3 = daysPast >= 31;
  const bannerClass = isPhase3 ? "bg-nepsis-alert text-white" : "bg-orange-500 text-white";

  return (
    <div className={`${bannerClass} px-4 py-3 text-center font-medium shadow-md flex items-center justify-center gap-2 z-50 relative animate-in slide-in-from-top-full duration-300`}>
        <AlertTriangle className="w-5 h-5" />
        <span>
            Subscription Expired: School will be automatically set to Inactive in <span className="font-bold underline">{graceRemaining} days</span>.
        </span>
    </div>
  );
};

export default SubscriptionBanner;
