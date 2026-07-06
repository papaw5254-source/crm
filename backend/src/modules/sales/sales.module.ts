import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtorsModule } from '../debtors/debtors.module';
import { ReserveModule } from '../reserve/reserve.module';
import { StockModule } from '../stock/stock.module';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { Sale } from './entities/sale.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, WorkerPayment]),
    StockModule,
    ReserveModule,
    forwardRef(() => DebtorsModule),
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
