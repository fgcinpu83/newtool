import { Controller, Post, Body } from '@nestjs/common';
import { WorkerService } from './worker.service';

@Controller('capture')
export class WorkerController {
    constructor(private readonly workerService: WorkerService) { }

    @Post()
    async captureEndpoint(@Body() data: any) {
        // data expected: { account: 'A' | 'B', index: 1-5, providerName: string, headers: any, url: string }
        return this.workerService.handleEndpointCaptured(data);
    }
}
