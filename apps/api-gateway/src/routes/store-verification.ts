import { Router, type Request, type Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '@ai-feedback/database';
import type { APIResponse } from '@ai-feedback/shared-types';
import { createObjectCsvWriter } from 'csv-writer';
import * as ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import multer from 'multer';
import csv from 'csv-parser';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

/**
 * @openapi
 * /api/store-verification/export:
 *   get:
 *     summary: Export verification data for store review
 *     tags: [Store Verification]
 *     security:
 *       - businessAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *           enum: [csv, excel]
 *           default: csv
 *       - in: query
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request parameters
 */
router.get('/export', [
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year required (2020-2030)'),
  query('month').isInt({ min: 1, max: 12 }).withMessage('Valid month required (1-12)'),
  query('format').optional().isIn(['csv', 'excel']).withMessage('Format must be csv or excel'),
  query('businessId').isUUID().withMessage('Valid business ID required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);
    const format = (req.query.format as string) || 'csv';
    const businessId = req.query.businessId as string;

    // Verify business exists
    const business = await db.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      } as APIResponse);
    }

    // Get verification data for the month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const verifications = await db.simpleVerification.findMany({
      where: {
        businessId,
        submittedAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        session: {
          include: {
            feedback: {
              select: {
                qualityScore: true,
                categories: true
              }
            }
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    });

    if (verifications.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No verifications found for the specified period'
      } as APIResponse);
    }

    // Prepare export data
    const exportData = verifications.map((verification, index) => ({
      'Row ID': index + 1,
      'Verification ID': verification.id,
      'Date': verification.purchaseTime.toISOString().split('T')[0],
      'Time': verification.purchaseTime.toTimeString().split(' ')[0],
      'Amount (SEK)': verification.purchaseAmount.toFixed(2),
      'Customer Phone': verification.customerPhone,
      'Store Code': verification.storeCode,
      'Quality Score': verification.session?.feedback?.qualityScore || 'N/A',
      'Payment Amount (SEK)': verification.paymentAmount?.toFixed(2) || '0.00',
      'Commission (SEK)': verification.commissionAmount?.toFixed(2) || '0.00',
      'Total Store Cost (SEK)': verification.storeCost?.toFixed(2) || '0.00',
      'Fraud Score': verification.fraudScore?.toFixed(2) || '0.00',
      'Review Status': verification.reviewStatus,
      'Submitted At': verification.submittedAt.toISOString(),
      // Verification columns for store
      'STORE VERIFICATION': '',
      'Transaction Found (Y/N)': '',
      'Verified Amount (SEK)': '',
      'Verified Time': '',
      'Notes': '',
      'Approve (Y/N)': ''
    }));

    const filename = `verifications_${businessId}_${year}-${month.toString().padStart(2, '0')}`;

    if (format === 'excel') {
      // Create Excel file
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Verifications');

      // Add headers
      const headers = Object.keys(exportData[0]);
      worksheet.addRow(headers);

      // Style headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      exportData.forEach(row => {
        worksheet.addRow(Object.values(row));
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = Math.max(12, (column.header?.toString().length || 0) + 2);
      });

      // Highlight verification columns
      const verificationStartCol = headers.indexOf('STORE VERIFICATION') + 1;
      for (let row = 1; row <= exportData.length + 1; row++) {
        for (let col = verificationStartCol; col <= headers.length; col++) {
          const cell = worksheet.getCell(row, col);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEAA7' }
          };
        }
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();

    } else {
      // Create CSV file
      const tempFilePath = `/tmp/${filename}.csv`;
      
      const csvWriter = createObjectCsvWriter({
        path: tempFilePath,
        header: Object.keys(exportData[0]).map(key => ({
          id: key,
          title: key
        }))
      });

      await csvWriter.writeRecords(exportData);

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

      // Stream file to response
      const fileStream = fs.createReadStream(tempFilePath);
      fileStream.pipe(res);
      
      // Clean up temp file after streaming
      fileStream.on('end', () => {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Error cleaning up temp file:', err);
        });
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export verification data'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/store-verification/import:
 *   post:
 *     summary: Import reviewed verification data from store
 *     tags: [Store Verification]
 *     security:
 *       - businessAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file with reviewed data
 *               businessId:
 *                 type: string
 *                 description: Business ID
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Import successful
 *       400:
 *         description: Invalid file format or data
 */
router.post('/import', upload.single('file'), [
  body('businessId').isUUID().withMessage('Valid business ID required'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      } as APIResponse);
    }

    const { businessId, year, month } = req.body;
    const filePath = req.file.path;

    try {
      let reviewedData: any[] = [];

      // Parse file based on type
      if (req.file.mimetype === 'text/csv') {
        reviewedData = await parseCsvFile(filePath);
      } else {
        reviewedData = await parseExcelFile(filePath);
      }

      // Validate and process the data
      const processResult = await processReviewedData(businessId, parseInt(year), parseInt(month), reviewedData);

      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error cleaning up uploaded file:', err);
      });

      res.json({
        success: true,
        data: {
          processed: processResult.processed,
          approved: processResult.approved,
          rejected: processResult.rejected,
          errors: processResult.errors
        }
      } as APIResponse);

    } catch (parseError) {
      // Clean up uploaded file on error
      fs.unlink(filePath, () => {});
      throw parseError;
    }

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import verification data',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as APIResponse);
  }
});

// Helper function to parse CSV file
async function parseCsvFile(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Helper function to parse Excel file
async function parseExcelFile(filePath: string): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(1);
  const results: any[] = [];
  
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  // Get headers from first row
  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, index) => {
    headers[index - 1] = cell.value?.toString() || '';
  });

  // Process data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    const rowData: any = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.value;
      }
    });
    results.push(rowData);
  });

  return results;
}

// Helper function to process reviewed data
async function processReviewedData(businessId: string, year: number, month: number, reviewedData: any[]) {
  let processed = 0;
  let approved = 0;
  let rejected = 0;
  const errors: string[] = [];

  for (const row of reviewedData) {
    try {
      const verificationId = row['Verification ID'];
      const approveStatus = row['Approve (Y/N)']?.toString().toUpperCase();
      const notes = row['Notes']?.toString() || '';
      const verifiedAmount = parseFloat(row['Verified Amount (SEK)']?.toString() || '0');
      const transactionFound = row['Transaction Found (Y/N)']?.toString().toUpperCase();

      if (!verificationId) {
        errors.push(`Row ${processed + 1}: Missing Verification ID`);
        continue;
      }

      // Find the verification
      const verification = await db.simpleVerification.findUnique({
        where: { id: verificationId },
        include: { session: true }
      });

      if (!verification) {
        errors.push(`Row ${processed + 1}: Verification ${verificationId} not found`);
        continue;
      }

      if (verification.businessId !== businessId) {
        errors.push(`Row ${processed + 1}: Verification belongs to different business`);
        continue;
      }

      // Check if verification is from the correct month
      const verificationMonth = verification.submittedAt.getMonth() + 1;
      const verificationYear = verification.submittedAt.getFullYear();
      if (verificationMonth !== month || verificationYear !== year) {
        errors.push(`Row ${processed + 1}: Verification is not from ${year}-${month}`);
        continue;
      }

      // Determine review status
      let reviewStatus: string;
      let rejectionReason: string | undefined;

      if (transactionFound === 'N') {
        reviewStatus = 'rejected';
        rejectionReason = 'Transaction not found in store records';
        rejected++;
      } else if (approveStatus === 'Y') {
        // Check amount tolerance if verification rules apply
        const amountDiff = Math.abs(verification.purchaseAmount - verifiedAmount);
        if (verifiedAmount > 0 && amountDiff > 0.5) {
          reviewStatus = 'rejected';
          rejectionReason = `Amount mismatch: Expected ${verification.purchaseAmount}, verified ${verifiedAmount} (diff: ${amountDiff} SEK)`;
          rejected++;
        } else {
          reviewStatus = 'approved';
          approved++;
        }
      } else if (approveStatus === 'N') {
        reviewStatus = 'rejected';
        rejectionReason = notes || 'Rejected by store review';
        rejected++;
      } else {
        errors.push(`Row ${processed + 1}: Invalid approval status '${approveStatus}'. Must be Y or N`);
        continue;
      }

      // Update verification
      await db.simpleVerification.update({
        where: { id: verificationId },
        data: {
          reviewStatus,
          rejectionReason,
          reviewedAt: new Date(),
          reviewedBy: `store_import_${Date.now()}`
        }
      });

      processed++;

    } catch (error) {
      errors.push(`Row ${processed + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { processed, approved, rejected, errors };
}

export default router;