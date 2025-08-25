import { Router, type Request, type Response } from 'express';
import { SquareLocationMapper, createSquareLocationMapper } from '../../../packages/pos-adapters/src/location/SquareLocationMapper';
import { logger } from '../utils/logger';

const router = Router();

// Store location mappers by business ID
const locationMappers = new Map<string, SquareLocationMapper>();

/**
 * Get or create location mapper for a business
 */
function getLocationMapper(businessId: string): SquareLocationMapper {
  let mapper = locationMappers.get(businessId);
  
  if (!mapper) {
    mapper = createSquareLocationMapper(
      {
        accessToken: process.env.SQUARE_ACCESS_TOKEN || 'sandbox-token',
        applicationId: process.env.SQUARE_APPLICATION_ID || 'sandbox-app-id',
        environment: (process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
      },
      businessId
    );
    
    locationMappers.set(businessId, mapper);
  }
  
  return mapper;
}

/**
 * Initialize location mapping for a business
 * POST /location-mapping/:businessId/initialize
 */
router.post('/:businessId/initialize', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    
    logger.info(`🏪 Initializing location mapping for business: ${businessId}`);
    
    const mapper = getLocationMapper(businessId);
    const result = await mapper.initializeMapping();
    
    logger.info(`✅ Location mapping initialized:`, {
      businessId,
      discovered: result.discovered,
      mapped: result.mapped,
      requiresVerification: result.requiresVerification
    });
    
    res.json({
      success: true,
      businessId,
      result: {
        ...result,
        message: `Discovered ${result.discovered} locations, automatically mapped ${result.mapped}, ${result.requiresVerification} require verification`
      }
    });
    
  } catch (error: any) {
    logger.error('Location mapping initialization failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize location mapping',
      code: error.code || 'INIT_FAILED'
    });
  }
});

/**
 * Get mapping candidates that require verification
 * GET /location-mapping/:businessId/candidates
 */
router.get('/:businessId/candidates', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    
    const mapper = getLocationMapper(businessId);
    const candidates = await mapper.getMappingCandidates();
    
    res.json({
      success: true,
      businessId,
      candidates: candidates.map(candidate => ({
        squareLocation: {
          id: candidate.squareLocation.id,
          name: candidate.squareLocation.name,
          address: candidate.squareLocation.address,
          status: candidate.squareLocation.status
        },
        businessLocation: {
          id: candidate.businessLocation.id,
          name: candidate.businessLocation.name,
          address: candidate.businessLocation.address,
          isActive: candidate.businessLocation.isActive
        },
        similarity: Math.round(candidate.similarity * 100),
        confidence: Math.round(candidate.confidence * 100),
        reasons: candidate.reasons
      })),
      count: candidates.length
    });
    
  } catch (error: any) {
    logger.error('Failed to get mapping candidates:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get mapping candidates',
      code: error.code || 'CANDIDATES_FAILED'
    });
  }
});

/**
 * Create manual location mapping
 * POST /location-mapping/:businessId/mapping
 */
router.post('/:businessId/mapping', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const { squareLocationId, businessLocationId, verifiedBy } = req.body;
    
    if (!squareLocationId || !businessLocationId) {
      return res.status(400).json({
        success: false,
        error: 'squareLocationId and businessLocationId are required'
      });
    }
    
    const mapper = getLocationMapper(businessId);
    const mapping = await mapper.createManualMapping(
      squareLocationId,
      businessLocationId,
      verifiedBy || 'api-user'
    );
    
    logger.info(`✅ Manual location mapping created:`, {
      businessId,
      squareLocationId,
      businessLocationId,
      mappingId: mapping.id
    });
    
    res.json({
      success: true,
      mapping: {
        id: mapping.id,
        squareLocationId: mapping.squareLocationId,
        businessLocationId: mapping.businessLocationId,
        mappingType: mapping.mappingType,
        confidence: Math.round(mapping.confidence * 100),
        verifiedAt: mapping.verifiedAt,
        verifiedBy: mapping.verifiedBy
      }
    });
    
  } catch (error: any) {
    logger.error('Manual mapping creation failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create manual mapping',
      code: error.code || 'MANUAL_MAPPING_FAILED'
    });
  }
});

/**
 * Get all location mappings for a business
 * GET /location-mapping/:businessId/mappings
 */
router.get('/:businessId/mappings', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    
    const mapper = getLocationMapper(businessId);
    const mappings = mapper.getAllMappings();
    
    res.json({
      success: true,
      businessId,
      mappings: mappings.map(mapping => ({
        id: mapping.id,
        squareLocationId: mapping.squareLocationId,
        businessLocationId: mapping.businessLocationId,
        mappingType: mapping.mappingType,
        confidence: Math.round(mapping.confidence * 100),
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt,
        verifiedAt: mapping.verifiedAt,
        verifiedBy: mapping.verifiedBy
      })),
      count: mappings.length,
      summary: {
        automatic: mappings.filter(m => m.mappingType === 'automatic').length,
        manual: mappings.filter(m => m.mappingType === 'manual').length,
        verified: mappings.filter(m => m.verifiedAt).length
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to get location mappings:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get location mappings'
    });
  }
});

/**
 * Update location mapping
 * PUT /location-mapping/:businessId/mapping/:mappingId
 */
router.put('/:businessId/mapping/:mappingId', async (req: Request, res: Response) => {
  try {
    const { businessId, mappingId } = req.params;
    const { businessLocationId, verifiedBy } = req.body;
    
    const mapper = getLocationMapper(businessId);
    const updatedMapping = await mapper.updateMapping(mappingId, {
      businessLocationId,
      verifiedBy
    });
    
    logger.info(`✅ Location mapping updated:`, {
      businessId,
      mappingId,
      businessLocationId
    });
    
    res.json({
      success: true,
      mapping: {
        id: updatedMapping.id,
        squareLocationId: updatedMapping.squareLocationId,
        businessLocationId: updatedMapping.businessLocationId,
        mappingType: updatedMapping.mappingType,
        confidence: Math.round(updatedMapping.confidence * 100),
        updatedAt: updatedMapping.updatedAt,
        verifiedAt: updatedMapping.verifiedAt,
        verifiedBy: updatedMapping.verifiedBy
      }
    });
    
  } catch (error: any) {
    logger.error('Mapping update failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update mapping',
      code: error.code || 'UPDATE_FAILED'
    });
  }
});

/**
 * Delete location mapping
 * DELETE /location-mapping/:businessId/mapping/:mappingId
 */
router.delete('/:businessId/mapping/:mappingId', async (req: Request, res: Response) => {
  try {
    const { businessId, mappingId } = req.params;
    
    const mapper = getLocationMapper(businessId);
    await mapper.deleteMapping(mappingId);
    
    logger.info(`✅ Location mapping deleted:`, {
      businessId,
      mappingId
    });
    
    res.json({
      success: true,
      message: 'Location mapping deleted successfully'
    });
    
  } catch (error: any) {
    logger.error('Mapping deletion failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete mapping',
      code: error.code || 'DELETE_FAILED'
    });
  }
});

/**
 * Synchronize locations with Square
 * POST /location-mapping/:businessId/sync
 */
router.post('/:businessId/sync', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    
    logger.info(`🔄 Synchronizing locations for business: ${businessId}`);
    
    const mapper = getLocationMapper(businessId);
    const result = await mapper.synchronizeLocations();
    
    logger.info(`✅ Location synchronization completed:`, {
      businessId,
      updated: result.updated,
      created: result.created,
      errors: result.errors.length
    });
    
    res.json({
      success: true,
      businessId,
      result: {
        ...result,
        message: `Updated ${result.updated} locations, created ${result.created} new mappings`
      }
    });
    
  } catch (error: any) {
    logger.error('Location synchronization failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to synchronize locations',
      code: error.code || 'SYNC_FAILED'
    });
  }
});

/**
 * Get location mapping for a specific Square location
 * GET /location-mapping/:businessId/square-location/:squareLocationId
 */
router.get('/:businessId/square-location/:squareLocationId', async (req: Request, res: Response) => {
  try {
    const { businessId, squareLocationId } = req.params;
    
    const mapper = getLocationMapper(businessId);
    const mapping = mapper.getLocationMapping(squareLocationId);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Location mapping not found',
        squareLocationId
      });
    }
    
    const businessLocation = mapper.getBusinessLocation(squareLocationId);
    
    res.json({
      success: true,
      squareLocationId,
      mapping: {
        id: mapping.id,
        squareLocationId: mapping.squareLocationId,
        businessLocationId: mapping.businessLocationId,
        mappingType: mapping.mappingType,
        confidence: Math.round(mapping.confidence * 100),
        createdAt: mapping.createdAt,
        verifiedAt: mapping.verifiedAt
      },
      businessLocation: businessLocation ? {
        id: businessLocation.id,
        name: businessLocation.name,
        address: businessLocation.address,
        isActive: businessLocation.isActive
      } : null
    });
    
  } catch (error: any) {
    logger.error('Failed to get location mapping:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get location mapping'
    });
  }
});

/**
 * Get location mapping status for a business
 * GET /location-mapping/:businessId/status
 */
router.get('/:businessId/status', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    
    const mapper = getLocationMapper(businessId);
    const mappings = mapper.getAllMappings();
    const candidates = await mapper.getMappingCandidates();
    
    const status = {
      businessId,
      mappings: {
        total: mappings.length,
        automatic: mappings.filter(m => m.mappingType === 'automatic').length,
        manual: mappings.filter(m => m.mappingType === 'manual').length,
        verified: mappings.filter(m => m.verifiedAt).length,
        unverified: mappings.filter(m => !m.verifiedAt).length
      },
      pendingVerification: candidates.length,
      lastUpdated: mappings.length > 0 ? 
        Math.max(...mappings.map(m => new Date(m.updatedAt).getTime())) : null,
      recommendations: candidates.slice(0, 5).map(c => ({
        squareLocationName: c.squareLocation.name,
        businessLocationName: c.businessLocation.name,
        confidence: Math.round(c.confidence * 100),
        reasons: c.reasons
      }))
    };
    
    res.json({
      success: true,
      status
    });
    
  } catch (error: any) {
    logger.error('Failed to get mapping status:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get mapping status'
    });
  }
});

export default router;