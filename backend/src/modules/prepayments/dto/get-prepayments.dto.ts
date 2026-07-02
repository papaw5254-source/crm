import { IsEnum, IsOptional } from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { PrepaymentStatus } from '../../../common/enums/prepayment-status.enum';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetPrepaymentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PrepaymentStatus)
  status?: PrepaymentStatus;

  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType;
}
