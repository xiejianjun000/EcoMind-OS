/**
 * Expert (Agent) type definitions for the conversational UI
 */

/** Expert agent online status */
export type ExpertStatus = 'online' | 'busy' | 'offline' | 'error';

/** Expert agent category */
export type ExpertCategory =
  | 'general'
  | 'monitoring'
  | 'enforcement'
  | 'eia'
  | 'approval'
  | 'biodiversity'
  | 'emission'
  | 'emergency'
  | 'restoration'
  | 'inspection'
  | 'public'
  | 'water';

/** Expert agent definition */
export interface Expert {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ExpertCategory;
  avatar?: string;
  icon: string; // Ant Design icon name
  color: string; // Theme color
  status: ExpertStatus;
  capabilities: string[];
  modelTier: 'opus' | 'sonnet' | 'haiku';
  safetyLevel: 'L1' | 'L2' | 'L3';
  isBuiltin: boolean;
  /** Claude Code pattern: natural language description of when this agent should be triggered */
  whenToUse?: string;
}

/** Expert capability / skill */
export interface ExpertSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  expertIds: string[];
}

/** Expert connector / data source */
export interface ExpertConnector {
  id: string;
  name: string;
  type: 'monitoring_station' | 'iot' | 'satellite' | 'government' | 'enterprise' | 'weather';
  status: 'connected' | 'disconnected' | 'error';
  description: string;
  icon: string;
}

/** Expert knowledge base category */
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  icon: string;
}

/** Team member (user or agent) */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  isHuman: boolean;
}

/** Workspace / project */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sessionIds: string[];
  color?: string;
}
