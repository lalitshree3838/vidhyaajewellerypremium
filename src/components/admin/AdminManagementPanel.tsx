import React, { useState } from 'react';
import { Users, UserPlus, Shield, KeyRound, Check, X, AlertTriangle, Lock } from 'lucide-react';
import { AdminUser, AdminRole } from '../../types';
import { logAuditEvent } from '../../lib/securityService';

const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'admin_1',
    name: 'Neeraj Chauhan (Owner)',
    email: 'anavneeraj2003@gmail.com',
    role: 'super_admin',
    twoFactorEnabled: true,
    twoFactorEnforced: true,
    status: 'active',
    lastLogin: new Date().toISOString(),
    lastPasswordChange: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'admin_2',
    name: 'Atelier Master Stylist & Operations',
    email: 'operations@vidhyaajewellery.com',
    role: 'admin',
    twoFactorEnabled: true,
    twoFactorEnforced: true,
    status: 'active',
    lastLogin: new Date(Date.now() - 3600 * 1000).toISOString(),
    lastPasswordChange: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    createdAt: '2026-02-15T00:00:00Z'
  },
  {
    id: 'admin_3',
    name: 'Inventory & Dispatch Manager',
    email: 'dispatch@vidhyaajewellery.com',
    role: 'manager',
    twoFactorEnabled: false,
    twoFactorEnforced: true,
    status: 'active',
    lastLogin: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdAt: '2026-03-01T00:00:00Z'
  }
];

export const AdminManagementPanel: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>(() => {
    try {
      const raw = localStorage.getItem('vidhyaa_admin_team');
      if (raw) {
        const parsed: AdminUser[] = JSON.parse(raw);
        return parsed.map((a) => (a.id === 'admin_1' ? { ...a, email: 'anavneeraj2003@gmail.com' } : a));
      }
      return INITIAL_ADMINS;
    } catch {
      return INITIAL_ADMINS;
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');

  const saveAdmins = (list: AdminUser[]) => {
    setAdmins(list);
    try {
      localStorage.setItem('vidhyaa_admin_team', JSON.stringify(list));
    } catch {}
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    const newAdmin: AdminUser = {
      id: `admin_${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      role: newRole,
      twoFactorEnabled: false,
      twoFactorEnforced: true,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const updated = [...admins, newAdmin];
    saveAdmins(updated);

    await logAuditEvent({
      adminId: 'super_admin',
      adminEmail: 'anavneeraj2003@gmail.com',
      action: 'ADMIN_INVITED',
      category: 'security',
      targetResource: newAdmin.email,
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'success',
      details: `Invited new administrator ${newAdmin.name} (${newAdmin.email}) with role ${newAdmin.role}`
    });

    setNewEmail('');
    setNewName('');
    setModalOpen(false);
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    if (admin.role === 'super_admin') {
      alert('Cannot disable the primary Super Administrator account.');
      return;
    }

    const nextStatus: 'active' | 'disabled' = admin.status === 'active' ? 'disabled' : 'active';
    const updated = admins.map((a) => (a.id === admin.id ? { ...a, status: nextStatus } : a));
    saveAdmins(updated);

    await logAuditEvent({
      adminId: 'super_admin',
      adminEmail: 'anavneeraj2003@gmail.com',
      action: nextStatus === 'disabled' ? 'ADMIN_DISABLED' : 'ADMIN_ENABLED',
      category: 'security',
      targetResource: admin.email,
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'success',
      details: `Administrator ${admin.email} status changed to ${nextStatus}`
    });
  };

  return (
    <div className="bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-white">
            Role-Based Administrator Management
          </h3>
          <p className="text-xs text-gray-400">
            Define granular permissions across Super Admin, Store Admin, Inventory Manager, and Floor Staff.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all"
        >
          <UserPlus className="w-4 h-4 text-[#DFB982]" />
          <span>Invite New Administrator</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#120B0D] text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-800">
            <tr>
              <th className="py-3 px-4">Administrator</th>
              <th className="py-3 px-4">Role & Scope</th>
              <th className="py-3 px-4">2FA Policy</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-gray-300">
            {admins.map((a) => (
              <tr key={a.id} className="hover:bg-white/2 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-white">{a.name}</div>
                  <div className="text-[11px] text-gray-400">{a.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      a.role === 'super_admin'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : a.role === 'admin'
                        ? 'bg-[#0F4C4A]/40 text-emerald-300 border border-[#0F4C4A]'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {a.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {a.twoFactorEnabled ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Enforced
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold">Pending Setup</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      a.status === 'active'
                        ? 'bg-emerald-950 text-emerald-400'
                        : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-400">
                  {a.lastLogin ? new Date(a.lastLogin).toLocaleDateString('en-IN') : 'Never'}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  {a.role !== 'super_admin' && (
                    <button
                      onClick={() => handleToggleStatus(a)}
                      className={`text-[11px] underline cursor-pointer ${
                        a.status === 'active' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      {a.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1215] border border-[#DFB982]/40 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-white pb-2 border-b border-gray-800">
              Provision Administrator Account
            </h3>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Priyanshi Sharma"
                  className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@vidhyaajewellery.com"
                  className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                  Assigned Role & Privilege
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white"
                >
                  <option value="admin">Admin (Catalog, Orders, Inventory, Reports)</option>
                  <option value="manager">Manager (Inventory, Orders & Tracking)</option>
                  <option value="staff">Staff (Customer Support & View Only)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-800 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Invite Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
