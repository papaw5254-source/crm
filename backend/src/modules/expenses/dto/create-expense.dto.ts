import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseCategory } from '../../../common/enums/expense-category.enum';

export class CreateExpenseDto {
  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be a positive number' })
  amount: number;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.GAS })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiPropertyOptional({ example: 'Monthly gas payment' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;
}
