import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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

export class CreatePrepaymentDto {
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

  @ApiPropertyOptional({ enum: BrickType, default: BrickType.BAKED_BRICK })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType = BrickType.BAKED_BRICK;

  @ApiProperty({ example: 10000, description: 'Umumiy buyurtma miqdori (dona)' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 450, description: 'Har bir g\'isht narxi' })
  @IsNumber()
  @Min(0.01)
  pricePerBrick: number;

  @ApiProperty({ example: 2000000, description: 'To\'langan oldindan to\'lov summasi' })
  @IsNumber()
  @Min(0)
  paidAmount: number;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;
}
