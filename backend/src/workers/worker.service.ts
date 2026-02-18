import { Injectable } from '@nestjs/common';

export type ProviderState = any;

@Injectable()
export class WorkerService {
    ping() { return 'pong'; }
    getContract(...args: any[]) { return null; }
    getAllProviderStatuses() { return []; }
}
