import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { MoneyIncomeSource } from '../../../common/enums/money-income-source.enum';

export class MoneyIncomeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MoneyIncomeSource })
  @IsOptional()
  @IsEnum(MoneyIncomeSource)
  source?: MoneyIncomeSource;
}
