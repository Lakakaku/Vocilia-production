import { Request, Response, NextFunction } from 'express';

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers['x-admin-token'];
    if (!token || token !== process.env.ADMIN_DASHBOARD_TOKEN) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Admin token missing or invalid'
      });
    }
    // Minimal context for audit
    (req as any).admin = { tokenLast4: String(token).slice(-4) };
    next();
  } catch (error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Admin authentication failed'
    });
  }
}

export function adminAudit(req: Request, res: Response, next: NextFunction) {
  // Simple audit record on response finish
  const startedAt = Date.now();
  const path = req.path;
  const method = req.method;
  const admin = (req as any).admin;
  res.on('finish', () => {
    try {
      const status = res.statusCode;
      const durationMs = Date.now() - startedAt;
      const record = {
        ts: new Date().toISOString(),
        method,
        path,
        status,
        durationMs,
        admin
      };
      adminAuditBuffer.push(record);
      if (adminAuditBuffer.length > 500) adminAuditBuffer.shift();
    } catch {
      // ignore
    }
  });
  next();
}

type AuditRecord = {
  ts: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  admin?: any;
};

const adminAuditBuffer: AuditRecord[] = [];

export function getAdminAuditRecords(): AuditRecord[] {
  return [...adminAuditBuffer].reverse();
}

