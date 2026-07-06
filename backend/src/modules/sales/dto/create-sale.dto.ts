import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { PaymentType } from '../../../common/enums/payment-type.enum';

export class CreateSaleDto {
  @ApiPropertyOptional({ enum: BrickType, default: BrickType.BAKED_BRICK })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType = BrickType.BAKED_BRICK;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1, { message: 'Quantity must be a positive number' })
  quantity: number;

  @ApiProperty({ example: 450.5 })
  @IsNumber()
  @Min(0.01, { message: 'Price per brick must be a positive number' })
  pricePerBrick: number;

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
  @ValidateIf((o) => o.customerPhone !== undefined && o.customerPhone !== '')
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Phone number is not valid' })
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
}
