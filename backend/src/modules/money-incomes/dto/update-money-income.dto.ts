import { PartialType } from '@nestjs/swagger';
import { CreateMoneyIncomeDto } from './create-money-income.dto';

export class UpdateMoneyIncomeDto extends PartialType(CreateMoneyIncomeDto) {}
