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
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isReserveSale?: boolean;
}
