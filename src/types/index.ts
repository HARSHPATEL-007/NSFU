export type UserRole = 'SDSR_OFFICE' | 'DEAN_SDSR';

export type RpcStatus =
  | 'NEW'
  | 'IN_VERIFICATION'
  | 'DRAFTED'
  | 'PENDING_DEAN_APPROVAL'
  | 'RETURNED_FOR_CORRECTION'
  | 'RESUBMITTED'
  | 'APPROVED';

export type MemberType = 'GUIDE' | 'CO_GUIDE' | 'INTERNAL' | 'EXTERNAL_1' | 'EXTERNAL_2';

export type MeetingMode = 'ONLINE' | 'OFFLINE' | 'HYBRID';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  designation: string;
  department: string;
  avatarInitials?: string;
}

export interface RpcMember {
  id: string;
  name: string;
  designation: string;
  department: string;
  schoolOrInstitution: string;
  location: string;
  email: string;
  phone?: string;
  memberType: MemberType;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  isActive?: boolean;
}

export interface Scholar {
  id: string;
  name: string;
  enrollmentNo: string;
  school: string;
  department: string;
  guideName: string;
  guideDesignation: string;
  guideEmail: string;
  guideSchool: string;
  coGuideName?: string;
  registrationDate: string;
  researchTopic: string;
  contactDetails: {
    email: string;
    phone: string;
    address?: string;
  };
  currentRpcNo: number;
  status: 'ACTIVE' | 'SUBMITTED' | 'AWARDED';
  academicDetails: {
    qualifyingDegree: string;
    university: string;
    yearOfPassing: string;
    category: string;
    fellowship?: string;
  };
}

export interface OfficialLetterData {
  refNo: string;
  date: string;
  schoolName: string;
  schoolCampus: string;
  guideName: string;
  guideDesignation: string;
  guideSchool: string;
  internalExpertName: string;
  internalExpertDesignation: string;
  internalExpertDept: string;
  internalExpertCampus: string;
  externalExpert1Name: string;
  externalExpert1Designation: string;
  externalExpert1Dept: string;
  externalExpert1Inst: string;
  externalExpert1City: string;
  externalExpert2Name: string;
  externalExpert2Designation: string;
  externalExpert2Dept: string;
  externalExpert2Inst: string;
  externalExpert2City: string;
  subject: string;
  meetingDateText: string;
  meetingTimeText: string;
  meetingModeText: string;
  meetingVenue?: string;
  meetingLink?: string;
  scholarName: string;
  rpcOrdinal: string;
  copyTo?: string[];
}

export interface RpcRecord {
  id: string;
  scholarId: string;
  scholarName: string;
  enrollmentNo: string;
  school: string;
  rpcNumber: number;
  rpcDate: string;
  meetingTime: string;
  meetingMode: MeetingMode;
  venue?: string;
  meetingLink?: string;
  status: RpcStatus;
  requestDetails: string;
  rpcMembers: {
    guide: RpcMember;
    coGuide?: RpcMember;
    internalExpert: RpcMember;
    externalExpert1: RpcMember;
    externalExpert2: RpcMember;
  };
  letterData?: OfficialLetterData;
  draftDocumentReference?: string;
  approvedDocumentReference?: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  forwardedBy?: string;
  forwardedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  returnedBy?: string;
  returnedAt?: string;
  returnRemarks?: string;
  version: number;
}

export interface AuditLog {
  id: string;
  rpcRecordId: string;
  scholarId?: string;
  action: string;
  performedBy: string;
  userRole: UserRole;
  details: string;
  timestamp: string;
}

export interface DocumentSnapshot {
  id: string;
  rpcRecordId: string;
  documentType: 'DRAFT' | 'APPROVED';
  version: number;
  refNo: string;
  dynamicData: OfficialLetterData;
  generatedAt: string;
  signedBy?: string;
  signedAt?: string;
  isImmutable: boolean;
}

export type EmailNotificationEventType =
  | 'RPC_PENDING_DEAN_APPROVAL'
  | 'RPC_RETURNED_FOR_CORRECTION';

export interface EmailNotificationEvent {
  id: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'DEAN_SDSR' | 'SDSR_OFFICE' | 'GUIDE' | 'SCHOLAR';
  eventType: EmailNotificationEventType;
  rpcRecordId: string;
  scholarId: string;
  scholarName: string;
  enrollmentNo: string;
  rpcNumber: number;
  subject: string;
  emailBody: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  metadata?: {
    remarks?: string;
    refNo?: string;
    meetingDate?: string;
    meetingTime?: string;
    mode?: string;
    venue?: string;
    initiatedBy?: string;
    [key: string]: any;
  };
}
