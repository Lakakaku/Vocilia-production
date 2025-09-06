// QRScanner component tests

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import QRScanner from '../QRScanner';

// Mock @zxing/library
const mockCodeReader = {
  decodeFromVideoDevice: jest.fn(),
  reset: jest.fn(),
  getVideoInputDevices: jest.fn()
};

jest.mock('@zxing/library', () => ({
  BrowserQRCodeReader: jest.fn(() => mockCodeReader)
}));

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  configurable: true
});

describe('QRScanner Component', () => {
  const mockProps = {
    onScanSuccess: jest.fn(),
    onScanError: jest.fn(),
    isActive: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
      getVideoTracks: () => [{ stop: jest.fn() }]
    });

    // Mock available cameras
    mockCodeReader.getVideoInputDevices.mockResolvedValue([
      { deviceId: 'camera1', label: 'Back Camera' },
      { deviceId: 'camera2', label: 'Front Camera' }
    ]);
  });

  describe('Initial Rendering', () => {
    it('renders scanner interface correctly', () => {
      render(<QRScanner {...mockProps} />);
      
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
      expect(screen.getByText(/scanna qr-kod/i)).toBeInTheDocument();
    });

    it('shows camera permission request', async () => {
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/kamera tillåtelse/i)).toBeInTheDocument();
      });
    });

    it('displays scanning viewfinder', async () => {
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('scanning-viewfinder')).toBeInTheDocument();
      });
    });
  });

  describe('Camera Permission Handling', () => {
    it('requests camera permission on mount', async () => {
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: { facingMode: 'environment' } // Back camera for QR scanning
        });
      });
    });

    it('handles camera permission denied', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanError).toHaveBeenCalledWith(
          expect.stringContaining('kamera')
        );
      });
    });

    it('shows permission denied message', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/kamera tillåtelse nekad/i)).toBeInTheDocument();
      });
    });
  });

  describe('QR Code Detection', () => {
    it('detects valid QR code successfully', async () => {
      const mockQRData = {
        v: 1,
        b: 'business-123',
        l: 'location-456',
        t: Date.now()
      };
      
      const qrCodeText = btoa(JSON.stringify(mockQRData));
      
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => qrCodeText,
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanSuccess).toHaveBeenCalledWith(mockQRData);
      });
    });

    it('handles invalid QR code format', async () => {
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => 'invalid-qr-data',
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanError).toHaveBeenCalledWith(
          expect.stringContaining('ogiltig qr-kod')
        );
      });
    });

    it('validates QR code version', async () => {
      const invalidVersionData = {
        v: 99, // Invalid version
        b: 'business-123',
        l: 'location-456',
        t: Date.now()
      };
      
      const qrCodeText = btoa(JSON.stringify(invalidVersionData));
      
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => qrCodeText,
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanError).toHaveBeenCalledWith(
          expect.stringContaining('version')
        );
      });
    });

    it('checks QR code timestamp validity', async () => {
      const expiredData = {
        v: 1,
        b: 'business-123',
        l: 'location-456',
        t: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago (expired)
      };
      
      const qrCodeText = btoa(JSON.stringify(expiredData));
      
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => qrCodeText,
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanError).toHaveBeenCalledWith(
          expect.stringContaining('utgången')
        );
      });
    });
  });

  describe('Camera Controls', () => {
    it('allows switching between front and back cameras', async () => {
      const user = userEvent.setup();
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('camera-switch')).toBeInTheDocument();
      });

      const switchButton = screen.getByTestId('camera-switch');
      await user.click(switchButton);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: { facingMode: 'user' } // Front camera
        });
      });
    });

    it('handles camera switching errors', async () => {
      const user = userEvent.setup();
      mockGetUserMedia
        .mockResolvedValueOnce({ getTracks: () => [{ stop: jest.fn() }] })
        .mockRejectedValueOnce(new Error('Camera not available'));
      
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('camera-switch')).toBeInTheDocument();
      });

      const switchButton = screen.getByTestId('camera-switch');
      await user.click(switchButton);

      await waitFor(() => {
        expect(screen.getByText(/kunde inte byta kamera/i)).toBeInTheDocument();
      });
    });

    it('shows torch control on supported devices', async () => {
      // Mock torch capability
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: {
          getUserMedia: mockGetUserMedia,
          getSupportedConstraints: () => ({ torch: true })
        },
        configurable: true
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('torch-toggle')).toBeInTheDocument();
      });
    });
  });

  describe('Scanning States', () => {
    it('shows scanning animation', async () => {
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        const scanningLine = screen.getByTestId('scanning-line');
        expect(scanningLine).toBeInTheDocument();
        expect(scanningLine).toHaveClass('animate-pulse');
      });
    });

    it('pauses scanning when not active', () => {
      const { rerender } = render(<QRScanner {...mockProps} />);
      
      rerender(<QRScanner {...mockProps} isActive={false} />);
      
      expect(mockCodeReader.reset).toHaveBeenCalled();
    });

    it('resumes scanning when activated', () => {
      const { rerender } = render(<QRScanner {...mockProps} isActive={false} />);
      
      rerender(<QRScanner {...mockProps} isActive={true} />);
      
      expect(mockCodeReader.decodeFromVideoDevice).toHaveBeenCalled();
    });

    it('shows success feedback on valid scan', async () => {
      const mockQRData = {
        v: 1,
        b: 'business-123',
        l: 'location-456',
        t: Date.now()
      };
      
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => btoa(JSON.stringify(mockQRData)),
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('scan-success-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles camera initialization errors', async () => {
      mockCodeReader.decodeFromVideoDevice.mockRejectedValue(new Error('Camera error'));
      
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanError).toHaveBeenCalledWith(
          expect.stringContaining('kamera')
        );
      });
    });

    it('shows retry option on errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Camera not available'));
      
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/försök igen/i)).toBeInTheDocument();
      });
    });

    it('retries camera initialization', async () => {
      const user = userEvent.setup();
      mockGetUserMedia
        .mockRejectedValueOnce(new Error('Camera not available'))
        .mockResolvedValueOnce({ getTracks: () => [{ stop: jest.fn() }] });
      
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/försök igen/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/försök igen/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance Optimization', () => {
    it('initializes scanner within 300ms', async () => {
      const startTime = Date.now();
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
      });

      const initTime = Date.now() - startTime;
      expect(initTime).toBeLessThanOrEqual(300);
    });

    it('detects QR codes within 100ms', async () => {
      const mockQRData = {
        v: 1,
        b: 'business-123',
        l: 'location-456',
        t: Date.now()
      };
      
      const startTime = Date.now();
      
      mockCodeReader.decodeFromVideoDevice.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              getText: () => btoa(JSON.stringify(mockQRData)),
              getBarcodeFormat: () => 'QR_CODE'
            });
          }, 50);
        });
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanSuccess).toHaveBeenCalled();
      });

      const detectionTime = Date.now() - startTime;
      expect(detectionTime).toBeLessThanOrEqual(100);
    });

    it('cleans up resources on unmount', () => {
      const { unmount } = render(<QRScanner {...mockProps} />);
      
      unmount();
      
      expect(mockCodeReader.reset).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<QRScanner {...mockProps} />);
      
      const video = screen.getByRole('img'); // Video element has img role for accessibility
      expect(video).toHaveAttribute('aria-label');
    });

    it('provides screen reader feedback', async () => {
      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent(/söker efter qr-kod/i);
      });
    });

    it('announces scan results to screen readers', async () => {
      const mockQRData = {
        v: 1,
        b: 'business-123',
        l: 'location-456',
        t: Date.now()
      };
      
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => btoa(JSON.stringify(mockQRData)),
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        const announcement = screen.getByRole('alert');
        expect(announcement).toHaveTextContent(/qr-kod hittad/i);
      });
    });
  });

  describe('iOS Safari Compatibility', () => {
    it('handles iOS camera constraints correctly', async () => {
      // Mock iOS Safari user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      });
    });

    it('uses correct video formats for iOS', async () => {
      // Mock iOS device
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'iPhone',
        configurable: true
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        const video = screen.getByTestId('camera-preview');
        expect(video).toHaveAttribute('playsInline', 'true');
        expect(video).toHaveAttribute('webkit-playsinline', 'true');
      });
    });
  });

  describe('Swedish Business Context', () => {
    it('validates Swedish business QR codes', async () => {
      const swedishQRData = {
        v: 1,
        b: 'swedish-business-123',
        l: 'stockholm-location-456',
        t: Date.now(),
        country: 'SE',
        orgNumber: '556677-8899'
      };
      
      const qrCodeText = btoa(JSON.stringify(swedishQRData));
      
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => qrCodeText,
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            country: 'SE',
            orgNumber: '556677-8899'
          })
        );
      });
    });

    it('shows Swedish UI text', () => {
      render(<QRScanner {...mockProps} />);
      
      expect(screen.getByText(/scanna qr-kod/i)).toBeInTheDocument();
      expect(screen.getByText(/rikta kameran/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles corrupted QR codes gracefully', async () => {
      mockCodeReader.decodeFromVideoDevice.mockResolvedValue({
        getText: () => 'corrupted-base64-data-!!!',
        getBarcodeFormat: () => 'QR_CODE'
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(mockProps.onScanError).toHaveBeenCalledWith(
          expect.stringContaining('skadad')
        );
      });
    });

    it('handles multiple QR codes in view', async () => {
      let callCount = 0;
      mockCodeReader.decodeFromVideoDevice.mockImplementation(() => {
        callCount++;
        const data = {
          v: 1,
          b: `business-${callCount}`,
          l: `location-${callCount}`,
          t: Date.now()
        };
        
        return Promise.resolve({
          getText: () => btoa(JSON.stringify(data)),
          getBarcodeFormat: () => 'QR_CODE'
        });
      });

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        // Should only process the first valid QR code
        expect(mockProps.onScanSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('handles low light conditions', async () => {
      // Simulate low light detection
      mockCodeReader.decodeFromVideoDevice.mockRejectedValue(
        new Error('No QR code found - insufficient light')
      );

      render(<QRScanner {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/ljus/i)).toBeInTheDocument();
      });
    });
  });
});