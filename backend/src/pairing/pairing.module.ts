import { Module } from '@nestjs/common';
import { PairingService } from './pairing.service';
import { GatewayModule } from '../gateway.module';
import { NormalizationModule } from '../normalization/normalization.module';

@Module({
    imports: [GatewayModule, NormalizationModule],
    providers: [PairingService],
    exports: [PairingService]
})
export class PairingModule { }
