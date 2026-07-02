import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtPayment } from '../debtors/entities/debt-payment.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { InventoryIncome } from '../inventory/entities/inventory-income.entity';
import { KilnOperation } from '../kiln/entities/kiln-operation.entity';
import { MoneyIncome } from '../money-incomes/entities/money-income.entity';
import { PrepaymentDelivery } from '../prepayments/entities/prepayment-delivery.entity';
import { Prepayment } from '../prepayments/entities/prepayment.entity';
import { ReserveMovement } from '../reserve/entities/reserve-movement.entity';
import { Sale } from '../sales/entities/sale.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Stock } from '../stock/entities/stock.entity';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      Expense,
      InventoryIncome,
      Debtor,
      DebtPayment,
      Stock,
      StockMovement,
      KilnOperation,
      ReserveMovement,
      Prepayment,
      PrepaymentDelivery,
      MoneyIncome,
      WorkerPayment,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
