import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
emitter.setMaxListeners(500);
export const publishRanking = (workspaceId: string) => emitter.emit(workspaceId);
export const onRankingChange = (workspaceId: string, listener: () => void) => {
  emitter.on(workspaceId, listener);
  return () => emitter.off(workspaceId, listener);
};
