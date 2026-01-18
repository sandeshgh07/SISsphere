import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const PasswordReset = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [strength, setStrength] = useState(0);

    // Calculate strength
    useEffect(() => {
        let s = 0;
        if (newPassword.length > 7) s += 1;
        if (/[A-Z]/.test(newPassword)) s += 1;
        if (/[0-9]/.test(newPassword)) s += 1;
        if (/[^A-Za-z0-9]/.test(newPassword)) s += 1;
        setStrength(s);
    }, [newPassword]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (strength < 2) {
             setError("Password is too weak");
             return;
        }

        try {
            await api.post('/auth/reset-first-password', {
                old_password: oldPassword,
                new_password: newPassword
            });
            setSuccess("Password reset successfully! Please login with your new password.");
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to reset password");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border-t-4 border-[#003333]">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-[#003333]">Secure Your Account</h2>
                    <p className="text-gray-600 text-sm mt-2">Please set a new permanent password.</p>
                </div>

                {error && <div className="bg-red-100 text-[#5C2438] p-3 rounded mb-4 text-sm">{error}</div>}
                {success && <div className="bg-green-100 text-green-800 p-3 rounded mb-4 text-sm">{success}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Current Password (PIN)</label>
                        <input
                            type="password"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#003333] focus:ring-[#003333] p-2 border"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <input
                            type="password"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#003333] focus:ring-[#003333] p-2 border"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                         {/* Strength Indicator */}
                         <div className="mt-2 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                             <div
                                className={`h-full transition-all duration-300 ${
                                    strength === 0 ? 'w-0' :
                                    strength === 1 ? 'w-1/4 bg-red-500' :
                                    strength === 2 ? 'w-1/2 bg-yellow-500' :
                                    strength === 3 ? 'w-3/4 bg-blue-500' :
                                    'w-full bg-green-500'
                                }`}
                             ></div>
                         </div>
                         <p className="text-xs text-gray-500 mt-1">
                            Strength: {['Weak', 'Fair', 'Good', 'Strong'][Math.min(strength, 3)] || 'Too Short'}
                         </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                        <input
                            type="password"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#003333] focus:ring-[#003333] p-2 border"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#003333] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003333]"
                    >
                        Set New Password
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordReset;
