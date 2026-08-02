import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module';
import { WorkerPaymentsModule } from '../worker-payments/worker-payments.module';
import { ReserveMovement } from './entities/reserve-movement.entity';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { ReserveController } from './reserve.controller';
import { ReserveService } from './reserve.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReserveMovement, WorkerPayment]), StockModule, WorkerPaymentsModule],
  controllers: [ReserveController],
  providers: [ReserveService],
  exports: [ReserveService],
})
export class ReserveModule {}
