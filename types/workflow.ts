type Status = { type: 'status', message: string };
type Error = { type: 'error', message: string };
type Done = { type: 'done', downloadUrl: string, filename: string };
type Pong = { type: 'pong' };

export type WorkflowMessage = Status | Error | Done | Pong;