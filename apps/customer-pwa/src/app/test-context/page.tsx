'use client';

import { useState } from 'react';

export default function TestContextPage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const testContextSave = async () => {
    setLoading(true);
    setStatus('Testing context save...');

    try {
      // Test data
      const testData = {
        contextData: {
          layout: {
            departments: ['Grocery', 'Bakery', 'Deli'],
            checkouts: 3,
            selfCheckout: true,
            specialAreas: ['Customer Service', 'Pharmacy']
          },
          staff: {
            employees: [
              { name: 'John Doe', role: 'Manager', department: 'General' },
              { name: 'Jane Smith', role: 'Cashier', department: 'Checkout' }
            ]
          },
          products: {
            categories: ['Food', 'Beverages', 'Household'],
            seasonal: ['Christmas items', 'Summer BBQ'],
            notOffered: ['Tobacco', 'Alcohol'],
            popularItems: ['Milk', 'Bread', 'Eggs']
          },
          operations: {
            hours: {
              monday: { open: '07:00', close: '22:00', closed: false },
              tuesday: { open: '07:00', close: '22:00', closed: false },
              wednesday: { open: '07:00', close: '22:00', closed: false },
              thursday: { open: '07:00', close: '22:00', closed: false },
              friday: { open: '07:00', close: '23:00', closed: false },
              saturday: { open: '08:00', close: '23:00', closed: false },
              sunday: { open: '09:00', close: '21:00', closed: false }
            },
            peakTimes: ['12:00-14:00', '17:00-19:00'],
            challenges: ['Long queues during peak hours'],
            improvements: ['Self-checkout installed recently'],
            commonProcedures: ['Customer loyalty program', 'Price match guarantee']
          },
          customerPatterns: {
            commonQuestions: ['Where is product X?', 'Do you have Y in stock?'],
            frequentComplaints: ['Long wait times', 'Out of stock items'],
            seasonalPatterns: ['Increased traffic during holidays'],
            positivePatterns: ['Friendly staff', 'Clean store'],
            customerDemographics: ['Families', 'Students', 'Seniors']
          }
        },
        incrementalUpdate: false
      };

      // Save to API
      const response = await fetch('/api/business/context?business_id=bus_1757623745176_hv6t2vn9x', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();

      if (response.ok) {
        setStatus(`✅ Success! Context saved. Completion score: ${result.validationResult?.completionScore || 0}%`);
      } else {
        setStatus(`❌ Error: ${result.error || 'Failed to save context'}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testContextLoad = async () => {
    setLoading(true);
    setStatus('Testing context load...');

    try {
      const response = await fetch('/api/business/context?business_id=bus_1757623745176_hv6t2vn9x');
      const result = await response.json();

      if (response.ok) {
        setStatus(`✅ Success! Context loaded: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
      } else {
        setStatus(`❌ Error: ${result.error || 'Failed to load context'}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Business Context API Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
          
          <div className="space-x-4">
            <button
              onClick={testContextSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Test Save Context
            </button>
            
            <button
              onClick={testContextLoad}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Test Load Context
            </button>
          </div>
        </div>

        {status && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Status</h2>
            <pre className="whitespace-pre-wrap font-mono text-sm">{status}</pre>
          </div>
        )}
      </div>
    </div>
  );
}