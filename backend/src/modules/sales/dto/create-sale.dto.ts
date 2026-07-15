import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { PaymentType } from '../../../common/enums/payment-type.enum';

export class CreateSaleDto {
  @ApiPropertyOptional({ enum: BrickType, default: BrickType.BAKED_BRICK })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType = BrickType.BAKED_BRICK;

  @ApiProperty({ example: 1000, description: '0 is allowed for a brick-less worker-payment-only entry' })
  @IsInt()
  @Min(0, { message: 'Quantity cannot be negative' })
  quantity: number;

  @ApiPropertyOptional({ example: 450.5 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Price per brick cannot be negative' })
  pricePerBrick?: number;

  @ApiPropertyOptional({ example: 450.5, description: 'Legacy frontend field' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  pricePerUnit?: number;

  @ApiPropertyOptional({ example: 450500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debtAmount?: number;

  @ApiProperty({ enum: PaymentType, example: PaymentType.CASH })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiPropertyOptional({ example: 'Ahmadjon Toshmatov' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isReserveSale?: boolean;

  @ApiPropertyOptional({ example: 20, description: 'Sotuv/yuklash uchun 1 dona ishchi narxi' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerRatePerBrick?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Sotuv ishchisiga berilgan pul' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerPaidAmount?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Oldingi oydan qolgan yuklagchi qarzi' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerOldDebt?: number;
}
