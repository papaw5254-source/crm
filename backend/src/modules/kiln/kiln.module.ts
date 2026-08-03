import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module';
import { WorkerPaymentsModule } from '../worker-payments/worker-payments.module';
import { KilnOperation } from './entities/kiln-operation.entity';
import { KilnController } from './kiln.controller';
import { KilnService } from './kiln.service';
import { ReserveMovement } from '../reserve/entities/reserve-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KilnOperation, ReserveMovement]),
    StockModule,
    WorkerPaymentsModule,
  ],
  controllers: [KilnController],
  providers: [KilnService],
  exports: [KilnService],
})
export class KilnModule {}
