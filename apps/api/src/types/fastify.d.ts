import 'fastify';
import type { GlobalRole, WorkspaceRole } from '@tadscore/contracts';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      username: string;
      fullName: string;
      globalRole: GlobalRole;
      status: string;
    };
    workspaceRole?: WorkspaceRole;
  }
}
