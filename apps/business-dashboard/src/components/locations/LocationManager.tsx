'use client';

import { useState, useEffect } from 'react';
import { Plus, MapPin, QrCode, Edit3, Trash2, Building2, Phone, Mail } from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { usePermissions } from '@/contexts/PermissionContext';
import { CanManageLocations, RoleGuard } from '@/components/auth/RoleGuard';
import { Permission } from '@/types/roles';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isActive: boolean;
  qrCodeUrl?: string;
  createdAt: string;
}

interface LocationManagerProps {}

export function LocationManager({}: LocationManagerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showQRCode, setShowQRCode] = useState<Location | null>(null);
  const { hasPermission, isHQLevel, canAccessLocation } = usePermissions();

  // Mock data - in real implementation, this would fetch from API
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setLocations([
        {
          id: '1',
          name: 'Café Aurora - Huvudkontor',
          address: 'Storgatan 15',
          city: 'Stockholm',
          postalCode: '111 29',
          phone: '+46 8 123 456',
          email: 'stockholm@aurora.se',
          managerId: 'user-1',
          isActive: true,
          qrCodeUrl: '/api/qr-codes/location-1.png',
          createdAt: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          name: 'Café Aurora - Malmö',
          address: 'Södergatan 23',
          city: 'Malmö',
          postalCode: '211 34',
          phone: '+46 40 987 654',
          email: 'malmo@aurora.se',
          isActive: true,
          qrCodeUrl: '/api/qr-codes/location-2.png',
          createdAt: '2024-02-01T10:00:00Z'
        }
      ]);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleCreateLocation = (locationData: Partial<Location>) => {
    const newLocation: Location = {
      id: Date.now().toString(),
      name: locationData.name || '',
      address: locationData.address || '',
      city: locationData.city || '',
      postalCode: locationData.postalCode || '',
      phone: locationData.phone,
      email: locationData.email,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    setLocations([...locations, newLocation]);
    setShowCreateForm(false);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setShowCreateForm(true);
  };

  const handleUpdateLocation = (locationData: Partial<Location>) => {
    if (!editingLocation) return;
    
    const updatedLocations = locations.map(loc => 
      loc.id === editingLocation.id 
        ? { ...loc, ...locationData }
        : loc
    );
    
    setLocations(updatedLocations);
    setEditingLocation(null);
    setShowCreateForm(false);
  };

  const handleDeleteLocation = (locationId: string) => {
    if (confirm('Är du säker på att du vill ta bort denna plats?')) {
      setLocations(locations.filter(loc => loc.id !== locationId));
    }
  };

  const generateQRCode = async (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId);
    if (!location) return;

    // Generate QR code if it doesn't exist
    if (!location.qrCodeUrl) {
      // In real implementation, this would call the API to generate QR code
      const updatedLocations = locations.map(loc => 
        loc.id === locationId 
          ? { ...loc, qrCodeUrl: `/api/qr-codes/location-${locationId}.png` }
          : loc
      );
      setLocations(updatedLocations);
    }

    // Show QR code display
    setShowQRCode(locations.find(loc => loc.id === locationId) || location);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Filter locations based on user permissions
  const visibleLocations = isHQLevel ? locations : locations.filter(loc => canAccessLocation(loc.id));
  const canManageAllLocations = hasPermission(Permission.MANAGE_ALL_LOCATIONS);
  const canManageAssignedLocations = hasPermission(Permission.MANAGE_ASSIGNED_LOCATIONS);

  return (
    <div className="space-y-6">
      {/* Header with add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          {isHQLevel ? 'Alla platser' : 'Dina platser'}
        </h2>
        <RoleGuard 
          permissions={[Permission.MANAGE_ALL_LOCATIONS, Permission.MANAGE_ASSIGNED_LOCATIONS]}
          hideOnNoAccess
        >
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Lägg till plats
          </button>
        </RoleGuard>
      </div>

      {/* Locations grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            canEdit={canManageAllLocations || (canManageAssignedLocations && canAccessLocation(location.id))}
            canDelete={canManageAllLocations || (canManageAssignedLocations && canAccessLocation(location.id))}
            onEdit={handleEditLocation}
            onDelete={handleDeleteLocation}
            onGenerateQR={generateQRCode}
          />
        ))}
      </div>

      {visibleLocations.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {hasPermission(Permission.VIEW_ALL_LOCATIONS) || hasPermission(Permission.VIEW_ASSIGNED_LOCATIONS)
              ? 'Inga platser att visa'
              : 'Du har inte behörighet att se några platser'
            }
          </p>
        </div>
      )}

      {/* Create/Edit form modal */}
      {showCreateForm && (
        <LocationForm
          location={editingLocation}
          onSubmit={editingLocation ? handleUpdateLocation : handleCreateLocation}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingLocation(null);
          }}
        />
      )}

      {/* QR Code display modal */}
      {showQRCode && (
        <QRCodeDisplay
          locationId={showQRCode.id}
          locationName={showQRCode.name}
          qrCodeUrl={showQRCode.qrCodeUrl}
          onClose={() => setShowQRCode(null)}
        />
      )}
    </div>
  );
}

interface LocationCardProps {
  location: Location;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (location: Location) => void;
  onDelete: (locationId: string) => void;
  onGenerateQR: (locationId: string) => void;
}

function LocationCard({ location, canEdit, canDelete, onEdit, onDelete, onGenerateQR }: LocationCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">{location.name}</h3>
        </div>
        <div className="flex gap-1">
          {canEdit && (
            <button
              onClick={() => onEdit(location)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Edit3 className="w-4 h-4 text-gray-500" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(location.id)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{location.address}, {location.city} {location.postalCode}</span>
        </div>
        
        {location.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{location.phone}</span>
          </div>
        )}
        
        {location.email && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <span>{location.email}</span>
          </div>
        )}
      </div>

      {/* QR Code section */}
      <div className="border-t pt-4">
        {location.qrCodeUrl ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-600">QR-kod genererad</span>
            <button
              onClick={() => onGenerateQR(location.id)}
              className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
            >
              <QrCode className="w-4 h-4" />
              Visa QR
            </button>
          </div>
        ) : (
          <button
            onClick={() => onGenerateQR(location.id)}
            className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-3 rounded-md text-sm flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Generera QR-kod
          </button>
        )}
      </div>

      {/* Status indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${location.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-sm text-gray-500">
          {location.isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>
    </div>
  );
}

interface LocationFormProps {
  location?: Location | null;
  onSubmit: (data: Partial<Location>) => void;
  onCancel: () => void;
}

function LocationForm({ location, onSubmit, onCancel }: LocationFormProps) {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    address: location?.address || '',
    city: location?.city || '',
    postalCode: location?.postalCode || '',
    phone: location?.phone || '',
    email: location?.email || '',
    isActive: location?.isActive ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">
          {location ? 'Redigera plats' : 'Lägg till ny plats'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Platsnamn
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
              Adress
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stad
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postnummer
              </label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefon (valfritt)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-post (valfritt)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Plats är aktiv
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
              {location ? 'Uppdatera' : 'Skapa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}