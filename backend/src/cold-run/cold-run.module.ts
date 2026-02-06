/**
 * Cold Run Module v6.0
 * Registers ColdRunService for dependency injection
 */

import { Module, forwardRef } from '@nestjs/common';
import { ColdRunService } from './cold-run.service';
import { GatewayModule } from '../gateway.module';
import { NormalizationModule } from '../normalization/normalization.module';
import { SabaExecutionService } from '../execution/saba-execution.service';
import { ContractRegistry } from '../workers/contract-registry.service';

@Module({
    imports: [
        forwardRef(() => GatewayModule),
        NormalizationModule
    ],
    providers: [
        ColdRunService,
        SabaExecutionService,
        ContractRegistry
    ],
    exports: [ColdRunService]
})
export class ColdRunModule { }
