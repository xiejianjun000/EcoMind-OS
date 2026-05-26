/**
 * Artifact, Task, and Notification type definitions
 */

/** Artifact file types */
export type ArtifactType = 'document' | 'chart' | 'map' | 'table' | 'image' | 'video' | 'report';

/** A generated artifact */
export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  sessionId: string;
  messageId: string;
  createdAt: string;
  size?: number; // bytes
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  thumbnail?: string;
}

/** Task status */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** A background task */
export interface TaskItem {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  progress: number; // 0-100
  expertId?: string;
  expertName?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  estimatedCompletion?: string;
  errorMessage?: string;
}

/** Notification type */
export type NotificationType = 'approval' | 'security' | 'system' | 'task' | 'workflow';

/** Notification severity */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

/** A notification item */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

/** Approval notification data */
export interface ApprovalNotificationData {
  approvalId: string;
  title: string;
  requester: string;
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: number;
  totalSteps: number;
}

/** Security alert notification data */
export interface SecurityNotificationData {
  eventId: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  description: string;
}

/** Panel tab types */
export type ArtifactPanelTab = 'artifacts' | 'tasks' | 'notifications';
