import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { WorkerPaymentCategory } from '../../../common/enums/worker-payment-category.enum';

export class CreateWorkerPaymentDto {
  @ApiProperty({ example: 'Alisher Qodirov' })
  @IsString()
  workerName: string;

  @ApiProperty({ enum: WorkerPaymentCategory })
  @IsEnum(WorkerPaymentCategory)
  category: WorkerPaymentCategory;

  @ApiPropertyOptional({ example: 0, description: 'O\'tgan oydan qoldiq qarz' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debtFromPreviousMonth?: number = 0;

  @ApiProperty({ example: 500000, description: 'Bu oy uchun to\'lash kerak miqdor' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 400000, description: 'Haqiqatda to\'langan miqdor' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number = 0;

  @ApiPropertyOptional({ example: '2024-01', description: 'Oy (YYYY-MM format)' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
