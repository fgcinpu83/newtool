import { Injectable } from '@nestjs/common';

@Injectable()
export class ProviderGuardianService {
    isHealthy() { return true; }
    getAllStatus() { return []; }
}
