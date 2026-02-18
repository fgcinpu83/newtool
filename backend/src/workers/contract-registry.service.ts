import { Injectable } from '@nestjs/common';

@Injectable()
export class ContractRegistry {
    getContracts() { return []; }
    hasFreshMatchList(...args: any[]) { return true; }
    getContract(...args: any[]) { return null; }
}

// backward-compatible export name used across the codebase
export { ContractRegistry as ContractRegistryService };
