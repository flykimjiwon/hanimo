export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messageCount: number;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}
