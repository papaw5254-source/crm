import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesModule } from '../sales/sales.module';
import { DebtorsController } from './debtors.controller';
import { DebtorsService } from './debtors.service';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debtor } from './entities/debtor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debtor, DebtPayment]),
    forwardRef(() => SalesModule),
  ],
  controllers: [DebtorsController],
  providers: [DebtorsService],
  exports: [DebtorsService],
})
export class DebtorsModule {}
