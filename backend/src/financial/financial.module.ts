import { Module } from '@nestjs/common';
import { AccountAService } from './account-a.service';

@Module({
    providers: [AccountAService],
    exports: [AccountAService],
})
export class FinancialModule { }
