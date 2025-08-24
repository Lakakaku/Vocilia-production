'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Mail, MapPin, Shield, Users as UsersIcon } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionContext';
import { RoleGuard, CanManageUsers } from '@/components/auth/RoleGuard';
import { 
  User, 
  UserRole, 
  getRoleDisplayName, 
  getAvailableRolesForUser,
  ROLE_DEFINITIONS 
} from '@/types/roles';

interface Location {
  id: string;
  name: string;
  city: string;
}

interface UserManagerProps {}

export function UserManager({}: UserManagerProps) {
  const { user: currentUser, canManageUser } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    // Mock data - in real implementation, this would fetch from API
    setTimeout(() => {
      setUsers([
        {
          id: 'user-1',
          email: 'emma.larsson@cafearura.se',
          name: 'Emma Larsson',
          role: UserRole.HQ_MANAGER,
          businessId: 'business-1',
          assignedLocationIds: [],
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
          lastLoginAt: '2024-08-24T08:30:00Z'
        },
        {
          id: 'user-2',
          email: 'alex.andersson@cafearura.se',
          name: 'Alex Andersson',
          role: UserRole.STORE_MANAGER,
          businessId: 'business-1',
          assignedLocationIds: ['1'],
          isActive: true,
          createdAt: '2024-02-01T10:00:00Z',
          lastLoginAt: '2024-08-23T14:15:00Z'
        },
        {
          id: 'user-3',
          email: 'sara.nilsson@cafearura.se',
          name: 'Sara Nilsson',
          role: UserRole.STAFF,
          businessId: 'business-1',
          assignedLocationIds: ['2'],
          isActive: true,
          createdAt: '2024-03-10T10:00:00Z',
          lastLoginAt: '2024-08-22T16:45:00Z'
        }
      ]);

      setLocations([
        { id: '1', name: 'Café Aurora - Stockholm', city: 'Stockholm' },
        { id: '2', name: 'Café Aurora - Malmö', city: 'Malmö' }
      ]);

      setIsLoading(false);
    }, 1000);
  }, []);

  const handleCreateUser = (userData: Partial<User>) => {
    const newUser: User = {
      id: Date.now().toString(),
      email: userData.email || '',
      name: userData.name || '',
      role: userData.role || UserRole.STAFF,
      businessId: currentUser?.businessId || '',
      assignedLocationIds: userData.assignedLocationIds || [],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    setUsers([...users, newUser]);
    setShowCreateForm(false);
  };

  const handleEditUser = (user: User) => {
    if (canManageUser(user)) {
      setEditingUser(user);
      setShowCreateForm(true);
    }
  };

  const handleUpdateUser = (userData: Partial<User>) => {
    if (!editingUser) return;
    
    const updatedUsers = users.map(user => 
      user.id === editingUser.id 
        ? { ...user, ...userData }
        : user
    );
    
    setUsers(updatedUsers);
    setEditingUser(null);
    setShowCreateForm(false);
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete || !canManageUser(userToDelete)) return;
    
    if (confirm('Är du säker på att du vill ta bort denna användare?')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  const toggleUserStatus = (userId: string) => {
    const userToToggle = users.find(u => u.id === userId);
    if (!userToToggle || !canManageUser(userToToggle)) return;
    
    const updatedUsers = users.map(user => 
      user.id === userId 
        ? { ...user, isActive: !user.isActive }
        : user
    );
    setUsers(updatedUsers);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <CanManageUsers fallback={
      <div className="text-center py-8">
        <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Du har inte behörighet att hantera användare.</p>
      </div>
    }>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Användare</h2>
            <p className="text-gray-600">Hantera användare och deras behörigheter</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Lägg till användare
          </button>
        </div>

        {/* Users table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Användare
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roll
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platser
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Senast inloggad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  locations={locations}
                  canManage={canManageUser(user)}
                  onEdit={() => handleEditUser(user)}
                  onDelete={() => handleDeleteUser(user.id)}
                  onToggleStatus={() => toggleUserStatus(user.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Create/Edit form modal */}
        {showCreateForm && (
          <UserForm
            user={editingUser}
            locations={locations}
            availableRoles={getAvailableRolesForUser(currentUser?.role || UserRole.STAFF)}
            onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingUser(null);
            }}
          />
        )}
      </div>
    </CanManageUsers>
  );
}

interface UserRowProps {
  user: User;
  locations: Location[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

function UserRow({ user, locations, canManage, onEdit, onDelete, onToggleStatus }: UserRowProps) {
  const assignedLocations = locations.filter(loc => 
    user.assignedLocationIds?.includes(loc.id)
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Aldrig';
    return new Date(dateString).toLocaleDateString('sv-SE');
  };

  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-900">{getRoleDisplayName(user.role)}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-1">
          {user.role === UserRole.HQ_MANAGER || user.role === UserRole.SUPER_ADMIN ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Alla platser
            </span>
          ) : assignedLocations.length > 0 ? (
            assignedLocations.map(location => (
              <span
                key={location.id}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                <MapPin className="w-3 h-3 mr-1" />
                {location.city}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">Inga platser tilldelade</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={canManage ? onToggleStatus : undefined}
          disabled={!canManage}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            user.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          } ${canManage ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
        >
          {user.isActive ? 'Aktiv' : 'Inaktiv'}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(user.lastLoginAt)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {canManage && (
          <div className="flex justify-end gap-2">
            <button
              onClick={onEdit}
              className="text-primary-600 hover:text-primary-900"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-900"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

interface UserFormProps {
  user?: User | null;
  locations: Location[];
  availableRoles: UserRole[];
  onSubmit: (data: Partial<User>) => void;
  onCancel: () => void;
}

function UserForm({ user, locations, availableRoles, onSubmit, onCancel }: UserFormProps) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    name: user?.name || '',
    role: user?.role || UserRole.STAFF,
    assignedLocationIds: user?.assignedLocationIds || [],
    isActive: user?.isActive ?? true
  });

  const selectedRole = ROLE_DEFINITIONS[formData.role];
  const canAssignLocations = selectedRole?.canAssignLocations === false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleLocationToggle = (locationId: string) => {
    const isSelected = formData.assignedLocationIds.includes(locationId);
    setFormData({
      ...formData,
      assignedLocationIds: isSelected
        ? formData.assignedLocationIds.filter(id => id !== locationId)
        : [...formData.assignedLocationIds, locationId]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {user ? 'Redigera användare' : 'Lägg till ny användare'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namn
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-post
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Roll
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({
                ...formData, 
                role: e.target.value as UserRole,
                assignedLocationIds: (e.target.value === UserRole.HQ_MANAGER || e.target.value === UserRole.SUPER_ADMIN) 
                  ? [] 
                  : formData.assignedLocationIds
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              {availableRoles.map(role => (
                <option key={role} value={role}>
                  {getRoleDisplayName(role)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {ROLE_DEFINITIONS[formData.role]?.description}
            </p>
          </div>

          {/* Location assignment (only for roles that need specific locations) */}
          {canAssignLocations && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tilldelade platser
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                {locations.map(location => (
                  <label key={location.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.assignedLocationIds.includes(location.id)}
                      onChange={() => handleLocationToggle(location.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{location.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Användare är aktiv
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-md"
            >
              {user ? 'Uppdatera' : 'Skapa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}