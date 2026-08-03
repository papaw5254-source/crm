import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { WorkerPaymentsModule } from '../worker-payments/worker-payments.module';
import { InventoryIncome } from './entities/inventory-income.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryIncome, WorkerPayment]), StockModule, WorkerPaymentsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
