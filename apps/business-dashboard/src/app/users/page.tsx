'use client';

import { UserManager } from '@/components/users/UserManager';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Användare</h1>
        <p className="text-gray-600">Hantera användare och behörigheter för din verksamhet</p>
      </div>

      {/* User management */}
      <UserManager />
    </div>
  );
}