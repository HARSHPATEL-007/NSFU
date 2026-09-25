import express, { Request, Response } from 'express';
import {
  validateRpcSequence,
  forwardToDean,
  approveRpc,
  returnForCorrection,
  getRpcRecordById,
  validateForForwarding,
  logPendingEmailNotification,
  getEmailNotificationsForRecord,
  getPendingEmailNotifications,
  getAllEmailNotifications,
} from '../services/dataService';

export const apiRouter = express.Router();
apiRouter.use(express.json());

// System Health Check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    portal: 'National Forensic Sciences University – SDSR RPC Processing Portal',
    timestamp: new Date().toISOString(),
  });
});

// Validate RPC Sequencing strictly on the backend
apiRouter.post('/rpc/validate-sequence', async (req: Request, res: Response) => {
  try {
    const { scholarId, rpcNumber } = req.body;
    if (!scholarId || typeof rpcNumber !== 'number') {
      return res.status(400).json({ error: 'scholarId and rpcNumber are required.' });
    }

    const validation = await validateRpcSequence(scholarId, rpcNumber);
    return res.json(validation);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Validation error' });
  }
});

// Server-side validation and Forwarding to Dean
apiRouter.post('/rpc/forward', async (req: Request, res: Response) => {
  try {
    const { recordId, user } = req.body;
    if (!recordId || !user) {
      return res.status(400).json({ error: 'recordId and user are required.' });
    }

    if (user.role !== 'SDSR_OFFICE') {
      return res.status(403).json({ error: 'Unauthorized: Only SDSR Office users can forward requests to Dean.' });
    }

    const record = await getRpcRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'RPC record not found.' });
    }

    const val = validateForForwarding(record);
    if (!val.isValid) {
      return res.status(422).json({
        error: 'Mandatory fields missing for forwarding.',
        details: val.errors,
      });
    }

    const updated = await forwardToDean(recordId, user);
    return res.json({ success: true, record: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Server-side Dean Approval
apiRouter.post('/rpc/approve', async (req: Request, res: Response) => {
  try {
    const { recordId, user } = req.body;
    if (!recordId || !user) {
      return res.status(400).json({ error: 'recordId and user are required.' });
    }

    if (user.role !== 'DEAN_SDSR') {
      return res.status(403).json({ error: 'Unauthorized: Only Dean, SDSR is authorized to approve RPC requests.' });
    }

    const updated = await approveRpc(recordId, user);
    return res.json({ success: true, record: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Server-side Dean Return for Correction
apiRouter.post('/rpc/return', async (req: Request, res: Response) => {
  try {
    const { recordId, remarks, user } = req.body;
    if (!recordId || !user || !remarks) {
      return res.status(400).json({ error: 'recordId, user, and remarks are required.' });
    }

    if (user.role !== 'DEAN_SDSR') {
      return res.status(403).json({ error: 'Unauthorized: Only Dean, SDSR is authorized to return requests.' });
    }

    const updated = await returnForCorrection(recordId, remarks, user);
    return res.json({ success: true, record: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/notifications - List logged email notifications
apiRouter.get('/notifications', async (req: Request, res: Response) => {
  try {
    const { recordId, status } = req.query;
    if (recordId && typeof recordId === 'string') {
      const records = await getEmailNotificationsForRecord(recordId);
      return res.json({ success: true, count: records.length, notifications: records });
    }

    if (status === 'PENDING') {
      const pending = await getPendingEmailNotifications();
      return res.json({ success: true, count: pending.length, notifications: pending });
    }

    const all = await getAllEmailNotifications();
    return res.json({ success: true, count: all.length, notifications: all });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error fetching notifications' });
  }
});

// GET /api/notifications/pending - List pending email notifications
apiRouter.get('/notifications/pending', async (_req: Request, res: Response) => {
  try {
    const pending = await getPendingEmailNotifications();
    return res.json({ success: true, count: pending.length, notifications: pending });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error fetching pending notifications' });
  }
});

// POST /api/notifications/log - Direct helper endpoint to log pending email notification in Firestore
apiRouter.post('/notifications/log', async (req: Request, res: Response) => {
  try {
    const { recordId, eventType, user, remarks } = req.body;
    if (!recordId || !eventType) {
      return res.status(400).json({ error: 'recordId and eventType are required.' });
    }

    if (eventType !== 'RPC_PENDING_DEAN_APPROVAL' && eventType !== 'RPC_RETURNED_FOR_CORRECTION') {
      return res.status(400).json({
        error: "Invalid eventType. Allowed values: 'RPC_PENDING_DEAN_APPROVAL' or 'RPC_RETURNED_FOR_CORRECTION'",
      });
    }

    const record = await getRpcRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'RPC record not found' });
    }

    const events = await logPendingEmailNotification(record, eventType, user, remarks);
    return res.json({
      success: true,
      message: `Successfully logged ${events.length} email notification event(s) in Firestore`,
      events,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to log notification' });
  }
});

