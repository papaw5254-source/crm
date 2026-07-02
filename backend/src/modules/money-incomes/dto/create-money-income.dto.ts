import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MoneyIncomeSource } from '../../../common/enums/money-income-source.enum';

export class CreateMoneyIncomeDto {
  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: MoneyIncomeSource })
  @IsEnum(MoneyIncomeSource)
  source: MoneyIncomeSource;

  @ApiPropertyOptional({ example: 'Karimov Bobur' })
  @IsOptional()
  @IsString()
  fromWhom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;
}
