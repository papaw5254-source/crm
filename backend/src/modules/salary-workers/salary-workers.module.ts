import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryWorkersController } from './salary-workers.controller';
import { SalaryWorkersService } from './salary-workers.service';
import { SalaryAdvance } from './entities/salary-advance.entity';
import { SalaryWorker } from './entities/salary-worker.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalaryWorker, SalaryAdvance])],
  controllers: [SalaryWorkersController],
  providers: [SalaryWorkersService],
})
export class SalaryWorkersModule {}
