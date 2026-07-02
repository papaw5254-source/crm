import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module';
import { PrepaymentDelivery } from './entities/prepayment-delivery.entity';
import { Prepayment } from './entities/prepayment.entity';
import { PrepaymentsController } from './prepayments.controller';
import { PrepaymentsService } from './prepayments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Prepayment, PrepaymentDelivery]), StockModule],
  controllers: [PrepaymentsController],
  providers: [PrepaymentsService],
  exports: [PrepaymentsService],
})
export class PrepaymentsModule {}
