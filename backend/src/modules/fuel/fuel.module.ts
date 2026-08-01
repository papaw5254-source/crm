import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { FuelExpense } from './entities/fuel-expense.entity';
import { FuelIncome } from './entities/fuel-income.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FuelIncome, FuelExpense])],
  controllers: [FuelController],
  providers: [FuelService],
})
export class FuelModule {}
