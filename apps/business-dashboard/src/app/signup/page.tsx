'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Building2, Phone, MapPin } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';

interface SignupFormData {
  businessName: string;
  organizationNumber: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
  };
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

const initialFormData: SignupFormData = {
  businessName: '',
  organizationNumber: '',
  email: '',
  phone: '',
  address: {
    street: '',
    city: '',
    postalCode: ''
  },
  password: '',
  confirmPassword: '',
  acceptTerms: false
};

export default function SignupPage() {
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.businessName.trim()) errors.push('Företagsnamn krävs');
    if (!formData.email.trim()) errors.push('E-post krävs');
    if (!formData.password.trim()) errors.push('Lösenord krävs');
    if (formData.password !== formData.confirmPassword) errors.push('Lösenorden matchar inte');
    if (formData.password.length < 6) errors.push('Lösenord måste vara minst 6 tecken');
    if (!formData.acceptTerms) errors.push('Du måste acceptera villkoren');
    
    // Swedish organization number format (optional)
    if (formData.organizationNumber && !formData.organizationNumber.match(/^\d{6}-\d{4}$/)) {
      errors.push('Organisationsnummer ska ha formatet XXXXXX-XXXX');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setIsLoading(true);

    try {
      await signup({
        name: formData.businessName,
        email: formData.email,
        orgNumber: formData.organizationNumber,
        phone: formData.phone,
        address: {
          street: formData.address.street,
          city: formData.address.city,
          postal_code: formData.address.postalCode
        },
        password: formData.password
      });
      
      // Redirect to onboarding after successful signup
      router.push('/onboarding');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ett fel uppstod vid registrering');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Skapa företagskonto
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Börja samla feedback från dina kunder idag
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                Företagsnamn *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  required
                  className="pl-10 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Ditt företags namn"
                  value={formData.businessName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Organization Number */}
            <div>
              <label htmlFor="organizationNumber" className="block text-sm font-medium text-gray-700">
                Organisationsnummer (valfritt)
              </label>
              <input
                id="organizationNumber"
                name="organizationNumber"
                type="text"
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="123456-7890"
                value={formData.organizationNumber}
                onChange={handleInputChange}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                E-post *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="pl-10 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="din@epost.se"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Telefon (valfritt)
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="pl-10 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="+46 70 123 45 67"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Adress (valfritt)</h3>
              
              <div>
                <input
                  name="address.street"
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Gatuadress"
                  value={formData.address.street}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="address.city"
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Stad"
                  value={formData.address.city}
                  onChange={handleInputChange}
                />
                <input
                  name="address.postalCode"
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="12345"
                  value={formData.address.postalCode}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Lösenord *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="pl-10 pr-10 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Minst 6 tecken"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Bekräfta lösenord *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="pl-10 pr-10 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Upprepa lösenordet"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                required
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                checked={formData.acceptTerms}
                onChange={handleInputChange}
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                Jag accepterar{' '}
                <a href="#" className="text-primary-600 hover:text-primary-500">
                  användarvillkoren
                </a>{' '}
                och{' '}
                <a href="#" className="text-primary-600 hover:text-primary-500">
                  integritetspolicyn
                </a>
              </label>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Skapar konto...' : 'Skapa företagskonto'}
              </button>
            </div>
          </form>

          {/* Login link */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Har du redan ett konto?</span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <Link
                href="/login"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Logga in här
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}