import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { PaymentType } from '../../../common/enums/payment-type.enum';

export class SalesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @ApiPropertyOptional({ enum: BrickType })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ obj, key }) => {
    // Read the raw source value rather than `value`: with enableImplicitConversion
    // enabled globally, `value` may already have been coerced via Boolean(str),
    // which turns the string "false" into `true` before this transform even runs.
    const raw = obj[key];
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  isReserveSale?: boolean;
}
