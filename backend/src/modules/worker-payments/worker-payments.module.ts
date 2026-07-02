import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerPayment } from './entities/worker-payment.entity';
import { WorkerPaymentsController } from './worker-payments.controller';
import { WorkerPaymentsService } from './worker-payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerPayment])],
  controllers: [WorkerPaymentsController],
  providers: [WorkerPaymentsService],
  exports: [WorkerPaymentsService],
})
export class WorkerPaymentsModule {}
