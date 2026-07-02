import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoneyIncome } from './entities/money-income.entity';
import { MoneyIncomesController } from './money-incomes.controller';
import { MoneyIncomesService } from './money-incomes.service';

@Module({
  imports: [TypeOrmModule.forFeature([MoneyIncome])],
  controllers: [MoneyIncomesController],
  providers: [MoneyIncomesService],
  exports: [MoneyIncomesService],
})
export class MoneyIncomesModule {}
