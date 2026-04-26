'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { motion } from 'framer-motion';
import { User, EnvelopeSimple, Phone, MapPin, Camera, PencilSimple, FloppyDisk, X, Trash } from '@phosphor-icons/react';
import { useLanguage } from '../components/LanguageContext';
import { ToastContainer } from '../components/Toast';

interface UserProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    dateOfBirth: string | null;
    age: number | null;
    occupation: string | null;
    location: string | null;
    bio: string | null;
    image: string | null;
    provider: string | null;
    createdAt: string;
}

export default function ProfilePage() {
    const { t } = useLanguage();
    const { data: session, update: updateSession } = useSession();
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [formData, setFormData] = useState<Partial<UserProfile>>({});
    const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Calculate age from date of birth
    const calculateAge = (dateOfBirth: string | null): number | null => {
        if (!dateOfBirth) return null;
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Fetch profile from API
    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/profile');
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                    setFormData(data);
                }
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            } finally {
                setLoading(false);
            }
        }
        if (session?.user) fetchProfile();
    }, [session]);

    const handleSave = async () => {
        // Validation
        if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
            addToast('First name and last name are required', 'error');
            return;
        }

        if (formData.age && (formData.age < 0 || formData.age > 150)) {
            addToast('Please enter a valid age (0-150)', 'error');
            return;
        }

        if (formData.phone && !/^[0-9+\-\s()]*$/.test(formData.phone)) {
            addToast('Please enter a valid phone number', 'error');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: formData.firstName?.trim() || '',
                    lastName: formData.lastName?.trim() || '',
                    phone: formData.phone?.trim() || null,
                    dateOfBirth: formData.dateOfBirth || null,
                    age: calculateAge(formData.dateOfBirth || null),
                    occupation: formData.occupation?.trim() || null,
                    location: formData.location?.trim() || null,
                    bio: formData.bio?.trim() || null,
                }),
            });

            if (res.ok) {
                const updated = await res.json();
                setProfile({ ...profile!, ...updated });
                setFormData({ ...formData, ...updated });
                setIsEditing(false);
                addToast('Profile updated successfully!', 'success');
                // Update the session so DashboardLayout shows new name
                await updateSession({
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    image: updated.image,
                });
            } else {
                const error = await res.json();
                addToast(error.error || 'Failed to update profile', 'error');
            }
        } catch (err) {
            console.error('Failed to update profile:', err);
            addToast('Network error. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData(profile || {});
        setIsEditing(false);
    };

    const handleDelete = async () => {
        try {
            const res = await fetch('/api/profile', { method: 'DELETE' });
            if (res.ok) {
                window.location.href = '/';
            }
        } catch (err) {
            console.error('Failed to delete account:', err);
        }
        setShowDeleteConfirm(false);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const inputClasses = "w-full px-4 py-3 rounded-xl bg-zinc-900/50 border border-white/10 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-white placeholder-zinc-500";

    if (loading) {
        return (
            <DashboardLayout>
                <div className="max-w-4xl mx-auto space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse rounded-2xl bg-zinc-900/50 h-40" />
                    ))}
                </div>
            </DashboardLayout>
        );
    }

    if (!profile) {
        return (
            <DashboardLayout>
                <div className="max-w-4xl mx-auto text-center py-20">
                    <p className="text-zinc-400">{t('profile.not_found') || 'Profile not found. Please log in again.'}</p>
                </div>
            </DashboardLayout>
        );
    }

    const displayName = `${profile.firstName} ${profile.lastName}`;
    const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`;

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold tracking-tight mb-2">{t('profile.title')}</h1>
                    <p className="text-zinc-400">{t('profile.subtitle')}</p>
                </motion.div>

                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
                    className="liquid-glass rounded-2xl p-8 mb-6"
                >
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-3xl font-bold overflow-hidden">
                                    {(formData.image || profile.image) ? (
                                        <img src={formData.image || profile.image || ''} alt={displayName} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                {isEditing && (
                                    <label className="absolute -bottom-2 -right-2 p-2 rounded-full bg-emerald-500 hover:bg-emerald-600 cursor-pointer transition-colors">
                                        <Camera size={16} />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold mb-1">{displayName}</h2>
                                <p className="text-zinc-400 mb-2">{profile.email}</p>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                                        {t('dash.premium')}
                                    </span>
                                    {profile.provider === 'google' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold tracking-wider uppercase">
                                            Google
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 transition-colors"
                                >
                                    <PencilSimple size={18} />
                                    {t('profile.edit')}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                    >
                                        <FloppyDisk size={18} />
                                        {saving ? '...' : t('profile.save')}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 font-medium hover:bg-white/5 transition-colors"
                                    >
                                        <X size={18} />
                                        {t('profile.cancel')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Profile Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.first_name')}</label>
                            <div className="relative">
                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={formData.firstName || ''}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    disabled={!isEditing}
                                    className={`${inputClasses} pl-12`}
                                    placeholder={t('profile.placeholder.first_name')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.last_name')}</label>
                            <div className="relative">
                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={formData.lastName || ''}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    disabled={!isEditing}
                                    className={`${inputClasses} pl-12`}
                                    placeholder={t('profile.placeholder.last_name')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.email')}</label>
                            <div className="relative">
                                <EnvelopeSimple size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className={`${inputClasses} pl-12 opacity-50`}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.phone')}</label>
                            <div className="relative">
                                <Phone size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="tel"
                                    value={formData.phone || ''}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    disabled={!isEditing}
                                    className={`${inputClasses} pl-12`}
                                    placeholder={t('profile.placeholder.phone')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.location')}</label>
                            <div className="relative">
                                <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={formData.location || ''}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    disabled={!isEditing}
                                    className={`${inputClasses} pl-12`}
                                    placeholder={t('profile.placeholder.location')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.dob')}</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    disabled={!isEditing}
                                    className={inputClasses}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.age')}</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.dateOfBirth ? `${calculateAge(formData.dateOfBirth)} years old` : 'Not set'}
                                    disabled
                                    className={`${inputClasses} opacity-50`}
                                    placeholder="Auto-calculated from date of birth"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">{t('profile.occupation')}</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.occupation || ''}
                                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                                    disabled={!isEditing}
                                    className={inputClasses}
                                    placeholder={t('profile.placeholder.occupation')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <label className="block text-sm font-medium mb-2">{t('profile.bio')}</label>
                        <textarea
                            value={formData.bio || ''}
                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                            disabled={!isEditing}
                            rows={4}
                            className={inputClasses}
                            placeholder={t('profile.placeholder.bio')}
                        />
                    </div>
                </motion.div>

                {/* Account Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
                    className="liquid-glass rounded-2xl p-8 mb-6"
                >
                    <h3 className="text-lg font-semibold mb-4">{t('profile.acc_info')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="text-sm text-zinc-400">{t('profile.user_id')}</span>
                            <div className="font-mono text-sm">{profile.id}</div>
                        </div>
                        <div>
                            <span className="text-sm text-zinc-400">{t('profile.member_since')}</span>
                            <div>{new Date(profile.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                </motion.div>

                {/* Danger Zone */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 100, damping: 20 }}
                    className="liquid-glass rounded-2xl p-8 border border-red-500/20"
                >
                    <h3 className="text-lg font-semibold mb-2 text-red-400">{t('profile.danger')}</h3>
                    <p className="text-zinc-400 text-sm mb-4">{t('profile.danger.desc')}</p>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <Trash size={18} />
                        {t('profile.delete')}
                    </button>
                </motion.div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="liquid-glass rounded-2xl p-6 max-w-md w-full"
                        >
                            <h3 className="text-xl font-semibold mb-4">{t('profile.delete.modal.title')}</h3>
                            <p className="text-zinc-400 mb-6">{t('profile.delete.modal.desc')}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/20 font-medium hover:bg-white/5 transition-colors"
                                >
                                    {t('profile.cancel')}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                                >
                                    {t('profile.delete')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}\n                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </div>
        </DashboardLayout>
    );
}
