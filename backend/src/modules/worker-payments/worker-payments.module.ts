import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { WorkerPayment } from './entities/worker-payment.entity';
import { WorkerPaymentsController } from './worker-payments.controller';
import { WorkerPaymentsService } from './worker-payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerPayment, Sale])],
  controllers: [WorkerPaymentsController],
  providers: [WorkerPaymentsService],
  exports: [WorkerPaymentsService],
})
export class WorkerPaymentsModule {}
