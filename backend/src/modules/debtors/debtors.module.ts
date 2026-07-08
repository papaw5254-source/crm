import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesModule } from '../sales/sales.module';
import { Sale } from '../sales/entities/sale.entity';
import { DebtorsController } from './debtors.controller';
import { DebtorsService } from './debtors.service';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debtor } from './entities/debtor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debtor, DebtPayment, Sale]),
    forwardRef(() => SalesModule),
  ],
  controllers: [DebtorsController],
  providers: [DebtorsService],
  exports: [DebtorsService],
})
export class DebtorsModule {}
