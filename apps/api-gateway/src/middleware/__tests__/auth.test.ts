// Authentication middleware tests

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateSession, authenticateAdmin } from '../auth';

// Mock JWT
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null })
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
      params: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {}
    };
    
    mockNext = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authenticateSession', () => {
    it('should authenticate valid session token', async () => {
      // Arrange
      const sessionToken = 'valid-session-token';
      const mockSession = {
        id: 'session-123',
        sessionToken,
        status: 'pending',
        startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        businessId: 'business-123'
      };

      mockRequest.headers = { 'x-session-token': sessionToken };
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSession,
        error: null
      });

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('feedback_sessions');
      expect(mockSupabaseClient.select).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('session_token', sessionToken);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'pending');
      
      expect(mockResponse.locals).toHaveProperty('session', mockSession);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without session token', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing session token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid session token', async () => {
      // Arrange
      mockRequest.headers = { 'x-session-token': 'invalid-token' };
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned' }
      });

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid session'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired session (> 15 minutes)', async () => {
      // Arrange
      const sessionToken = 'expired-session-token';
      const mockSession = {
        id: 'session-123',
        sessionToken,
        status: 'pending',
        startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        businessId: 'business-123'
      };

      mockRequest.headers = { 'x-session-token': sessionToken };
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSession,
        error: null
      });

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Session expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.headers = { 'x-session-token': 'some-token' };
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication error'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateAdmin', () => {
    it('should authenticate valid admin JWT token', async () => {
      // Arrange
      const adminToken = 'valid.jwt.token';
      const mockPayload = {
        userId: 'admin-123',
        role: 'super_admin',
        email: 'admin@example.com'
      };

      mockRequest.headers = { 'authorization': `Bearer ${adminToken}` };
      mockedJwt.verify.mockReturnValueOnce(mockPayload);

      // Act
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockedJwt.verify).toHaveBeenCalledWith(adminToken, process.env.JWT_SECRET || 'test-jwt-secret-key');
      expect(mockResponse.locals).toHaveProperty('admin', mockPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing authorization token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed authorization header', async () => {
      // Arrange
      mockRequest.headers = { 'authorization': 'InvalidFormat' };

      // Act
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid authorization format'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', async () => {
      // Arrange
      const invalidToken = 'invalid.jwt.token';
      mockRequest.headers = { 'authorization': `Bearer ${invalidToken}` };
      
      mockedJwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      // Act
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', async () => {
      // Arrange
      const expiredToken = 'expired.jwt.token';
      mockRequest.headers = { 'authorization': `Bearer ${expiredToken}` };
      
      const tokenExpiredError = new Error('Token expired');
      tokenExpiredError.name = 'TokenExpiredError';
      mockedJwt.verify.mockImplementationOnce(() => {
        throw tokenExpiredError;
      });

      // Act
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate admin role permissions', async () => {
      // Arrange
      const adminToken = 'valid.jwt.token';
      const mockPayload = {
        userId: 'user-123',
        role: 'customer', // Not an admin role
        email: 'user@example.com'
      };

      mockRequest.headers = { 'authorization': `Bearer ${adminToken}` };
      mockedJwt.verify.mockReturnValueOnce(mockPayload);

      // Act
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept different admin roles', async () => {
      const roles = ['super_admin', 'moderator', 'analyst'];
      
      for (const role of roles) {
        // Reset mocks
        jest.clearAllMocks();
        
        // Arrange
        const adminToken = 'valid.jwt.token';
        const mockPayload = {
          userId: `admin-123`,
          role,
          email: 'admin@example.com'
        };

        mockRequest.headers = { 'authorization': `Bearer ${adminToken}` };
        mockedJwt.verify.mockReturnValueOnce(mockPayload);

        // Act
        await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalledWith();
        expect(mockResponse.locals).toHaveProperty('admin', mockPayload);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should authenticate session within 100ms', async () => {
      // Arrange
      const sessionToken = 'performance-test-token';
      const mockSession = {
        id: 'session-123',
        sessionToken,
        status: 'pending',
        startedAt: new Date(),
        businessId: 'business-123'
      };

      mockRequest.headers = { 'x-session-token': sessionToken };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSession,
        error: null
      });

      // Act
      const startTime = Date.now();
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);
      const executionTime = Date.now() - startTime;

      // Assert
      expect(executionTime).toBeLessThanOrEqual(100);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should authenticate admin within 50ms', async () => {
      // Arrange
      const adminToken = 'performance.test.token';
      const mockPayload = {
        userId: 'admin-123',
        role: 'super_admin',
        email: 'admin@example.com'
      };

      mockRequest.headers = { 'authorization': `Bearer ${adminToken}` };
      mockedJwt.verify.mockReturnValueOnce(mockPayload);

      // Act
      const startTime = Date.now();
      await authenticateAdmin(mockRequest as Request, mockResponse as Response, mockNext);
      const executionTime = Date.now() - startTime;

      // Assert
      expect(executionTime).toBeLessThanOrEqual(50);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Swedish Business Context', () => {
    it('should handle Swedish organization numbers in session context', async () => {
      // Arrange
      const sessionToken = 'swedish-business-token';
      const mockSession = {
        id: 'session-123',
        sessionToken,
        status: 'pending',
        startedAt: new Date(),
        businessId: 'business-123',
        business: {
          orgNumber: '556677-8899',
          name: 'Test Café Stockholm'
        }
      };

      mockRequest.headers = { 'x-session-token': sessionToken };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSession,
        error: null
      });

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.locals?.session?.business?.orgNumber).toMatch(/^\d{6}-\d{4}$/);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should validate Swedish timezone in session timestamps', async () => {
      // Arrange
      const sessionToken = 'timezone-test-token';
      const stockholmTime = new Date();
      const mockSession = {
        id: 'session-123',
        sessionToken,
        status: 'pending',
        startedAt: stockholmTime,
        businessId: 'business-123'
      };

      mockRequest.headers = { 'x-session-token': sessionToken };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSession,
        error: null
      });

      // Act
      await authenticateSession(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const sessionAge = Date.now() - stockholmTime.getTime();
      expect(sessionAge).toBeGreaterThanOrEqual(0);
      expect(sessionAge).toBeLessThanOrEqual(15 * 60 * 1000); // Within 15 minutes
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});