import { doc, setDoc, getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RpcRecord, UserProfile, EmailNotificationEvent, EmailNotificationEventType } from '../types';

// In-memory cache for fast local access and resilience
const memoryEmailNotifications: EmailNotificationEvent[] = [];

/**
 * Backend helper function to log pending email notification events in the Firestore database
 * whenever an RPC request changes status to 'Pending Dean Approval' or 'Returned for Correction'.
 *
 * @param record - The target RPC record with updated status
 * @param eventType - 'RPC_PENDING_DEAN_APPROVAL' | 'RPC_RETURNED_FOR_CORRECTION'
 * @param triggeringUser - The user initiating the workflow state change
 * @param remarks - Mandatory reason/remarks if returned for correction
 * @returns Promise<EmailNotificationEvent[]> The created notification event(s) logged in Firestore
 */
export async function logPendingEmailNotification(
  record: RpcRecord,
  eventType: EmailNotificationEventType,
  triggeringUser?: UserProfile,
  remarks?: string
): Promise<EmailNotificationEvent[]> {
  const timestamp = new Date().toISOString();
  const createdEvents: EmailNotificationEvent[] = [];

  if (eventType === 'RPC_PENDING_DEAN_APPROVAL') {
    // Event: Forwarded to Dean for Approval -> Notify Dean, SDSR
    const notificationId = `notif-dean-${record.id}-${Date.now()}`;
    const subject = `[NFSU SDSR Urgent] Ph.D. RPC ${record.rpcNumber} Application Pending Approval – ${record.scholarName} (${record.enrollmentNo})`;
    const body = [
      `Respected Dean, SDSR,`,
      ``,
      `A Ph.D. Research Progress Committee (RPC) meeting request has been verified by the SDSR Office and is pending your official review and approval.`,
      ``,
      `--- SCHOLAR & MEETING DETAILS ---`,
      `• Scholar Name: ${record.scholarName}`,
      `• Enrollment / Registration No.: ${record.enrollmentNo}`,
      `• School / Institute: ${record.school}`,
      `• RPC Stage: RPC ${record.rpcNumber}`,
      `• Proposed Meeting Date & Time: ${record.rpcDate} at ${record.meetingTime}`,
      `• Meeting Mode & Venue: ${record.meetingMode} (${record.venue || 'SDSR Board Room / Online Link'})`,
      `• Research Supervisor (Guide): ${record.rpcMembers?.guide?.name || 'N/A'}`,
      `• Draft Letter Reference: ${record.letterData?.refNo || record.draftDocumentReference || 'Pending Generation'}`,
      `• Forwarded By: ${triggeringUser ? triggeringUser.displayName : record.forwardedBy || 'SDSR Office'}`,
      `• Forwarded At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      ``,
      `Please log in to the NFSU SDSR RPC Portal to review the meeting documents and grant digital approval or return with instructions.`,
      ``,
      `Portal Document Link: /workspace?recordId=${record.id}`,
      ``,
      `With institutional regards,`,
      `Office of the School of Doctoral Studies and Research (SDSR)`,
      `National Forensic Sciences University, Gandhinagar Campus`,
    ].join('\n');

    const event: EmailNotificationEvent = {
      id: notificationId,
      recipientEmail: 'dean.sdsr@nfsu.ac.in',
      recipientName: 'Dean, SDSR',
      recipientRole: 'DEAN_SDSR',
      eventType: 'RPC_PENDING_DEAN_APPROVAL',
      rpcRecordId: record.id,
      scholarId: record.scholarId,
      scholarName: record.scholarName,
      enrollmentNo: record.enrollmentNo,
      rpcNumber: record.rpcNumber,
      subject,
      emailBody: body,
      status: 'PENDING',
      createdAt: timestamp,
      metadata: {
        refNo: record.letterData?.refNo || record.draftDocumentReference,
        meetingDate: record.rpcDate,
        meetingTime: record.meetingTime,
        mode: record.meetingMode,
        venue: record.venue,
        initiatedBy: triggeringUser?.displayName || record.forwardedBy || 'SDSR Office',
      },
    };

    createdEvents.push(event);
  } else if (eventType === 'RPC_RETURNED_FOR_CORRECTION') {
    // Event: Returned for Correction by Dean -> Notify SDSR Office & Research Supervisor
    const reasonText = remarks || record.returnRemarks || 'Corrections required by Dean, SDSR.';

    // 1. Notification to SDSR Office Dealing Hand
    const officeNotifId = `notif-office-${record.id}-${Date.now()}`;
    const officeSubject = `[NFSU SDSR Action Required] RPC ${record.rpcNumber} Returned for Correction – ${record.scholarName} (${record.enrollmentNo})`;
    const officeBody = [
      `Dear SDSR Office Dealing Hand,`,
      ``,
      `The Ph.D. Research Progress Committee (RPC) ${record.rpcNumber} application for scholar ${record.scholarName} has been RETURNED FOR CORRECTION by Dean, SDSR.`,
      ``,
      `--- REASON / DEAN REMARKS ---`,
      `"${reasonText}"`,
      ``,
      `--- SUMMARY DETAILS ---`,
      `• Scholar Name: ${record.scholarName}`,
      `• Enrollment No.: ${record.enrollmentNo}`,
      `• School: ${record.school}`,
      `• RPC Stage: RPC ${record.rpcNumber}`,
      `• Returned By: ${triggeringUser ? triggeringUser.displayName : record.returnedBy || 'Dean, SDSR'}`,
      `• Returned At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      ``,
      `Action Required:`,
      `Please open the Scholar Workspace in the SDSR Portal, review the Dean's specific feedback, update the required details or draft letter, and resubmit.`,
      ``,
      `With institutional regards,`,
      `Office of the Dean, SDSR`,
      `National Forensic Sciences University, Gandhinagar Campus`,
    ].join('\n');

    const officeEvent: EmailNotificationEvent = {
      id: officeNotifId,
      recipientEmail: 'office@nfsu.ac.in',
      recipientName: 'SDSR Office Dealing Assistant',
      recipientRole: 'SDSR_OFFICE',
      eventType: 'RPC_RETURNED_FOR_CORRECTION',
      rpcRecordId: record.id,
      scholarId: record.scholarId,
      scholarName: record.scholarName,
      enrollmentNo: record.enrollmentNo,
      rpcNumber: record.rpcNumber,
      subject: officeSubject,
      emailBody: officeBody,
      status: 'PENDING',
      createdAt: timestamp,
      metadata: {
        remarks: reasonText,
        refNo: record.letterData?.refNo,
        returnedBy: triggeringUser?.displayName || record.returnedBy || 'Dean, SDSR',
      },
    };
    createdEvents.push(officeEvent);

    // 2. Notification to Research Supervisor / Guide (if guide email is present)
    const guideEmail = record.rpcMembers?.guide?.email || 'supervisor@nfsu.ac.in';
    const guideName = record.rpcMembers?.guide?.name || 'Research Supervisor';
    const guideNotifId = `notif-guide-${record.id}-${Date.now()}`;
    const guideSubject = `[NFSU SDSR Notice] RPC ${record.rpcNumber} Application Update for Scholar ${record.scholarName}`;
    const guideBody = [
      `Dear ${guideName},`,
      ``,
      `This is to inform you that the RPC ${record.rpcNumber} meeting file for your research scholar, ${record.scholarName} (${record.enrollmentNo}), has been returned with observation notes by the Dean, SDSR:`,
      ``,
      `Dean's Observations: "${reasonText}"`,
      ``,
      `The SDSR Office is coordinating the necessary revisions before resubmission.`,
      ``,
      `With regards,`,
      `Office of the School of Doctoral Studies and Research (SDSR)`,
      `National Forensic Sciences University`,
    ].join('\n');

    const guideEvent: EmailNotificationEvent = {
      id: guideNotifId,
      recipientEmail: guideEmail,
      recipientName: guideName,
      recipientRole: 'GUIDE',
      eventType: 'RPC_RETURNED_FOR_CORRECTION',
      rpcRecordId: record.id,
      scholarId: record.scholarId,
      scholarName: record.scholarName,
      enrollmentNo: record.enrollmentNo,
      rpcNumber: record.rpcNumber,
      subject: guideSubject,
      emailBody: guideBody,
      status: 'PENDING',
      createdAt: timestamp,
      metadata: {
        remarks: reasonText,
        guideName,
      },
    };
    createdEvents.push(guideEvent);
  }

  // Persist all generated events into Firestore and memory cache
  for (const event of createdEvents) {
    memoryEmailNotifications.unshift(event);

    try {
      await setDoc(doc(db, 'emailNotifications', event.id), event);
      console.log(`[Backend Email Notification Logged] Event ${event.id} stored in Firestore for ${event.recipientEmail} (${event.status})`);
    } catch (err) {
      console.warn(`[Firestore Notification Warning] Could not persist notification ${event.id} directly to Firestore:`, err);
    }
  }

  return createdEvents;
}

/**
 * Fetch logged email notifications for a specific RPC record
 */
export async function getEmailNotificationsForRecord(
  rpcRecordId: string
): Promise<EmailNotificationEvent[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'emailNotifications'), where('rpcRecordId', '==', rpcRecordId))
    );
    if (!snap.empty) {
      const results: EmailNotificationEvent[] = [];
      snap.forEach((d) => results.push(d.data() as EmailNotificationEvent));
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch (err) {
    console.warn('[Firestore] Using memory cache for email notifications:', err);
  }

  return memoryEmailNotifications
    .filter((n) => n.rpcRecordId === rpcRecordId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Fetch all pending email notifications currently queued
 */
export async function getPendingEmailNotifications(): Promise<EmailNotificationEvent[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'emailNotifications'), where('status', '==', 'PENDING'))
    );
    if (!snap.empty) {
      const results: EmailNotificationEvent[] = [];
      snap.forEach((d) => results.push(d.data() as EmailNotificationEvent));
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch (err) {
    console.warn('[Firestore] Using memory cache for pending notifications:', err);
  }

  return memoryEmailNotifications
    .filter((n) => n.status === 'PENDING')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Fetch all email notifications (all statuses)
 */
export async function getAllEmailNotifications(): Promise<EmailNotificationEvent[]> {
  try {
    const snap = await getDocs(collection(db, 'emailNotifications'));
    if (!snap.empty) {
      const results: EmailNotificationEvent[] = [];
      snap.forEach((d) => results.push(d.data() as EmailNotificationEvent));
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch (err) {
    console.warn('[Firestore] Using memory cache for all notifications:', err);
  }

  return [...memoryEmailNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
