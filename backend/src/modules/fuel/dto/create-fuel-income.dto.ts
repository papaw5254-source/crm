import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentType } from '../../../common/enums/payment-type.enum';

export class CreateFuelIncomeDto {
  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0.01, { message: 'Liters must be a positive number' })
  liters: number;

  @ApiProperty({ example: 8500 })
  @IsNumber()
  @Min(0.01, { message: 'Price per liter must be a positive number' })
  pricePerLiter: number;

  @ApiProperty({ enum: PaymentType, example: PaymentType.CASH })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
