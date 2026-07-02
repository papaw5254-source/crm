import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PrepaymentStatus } from '../../../common/enums/prepayment-status.enum';
import { CreatePrepaymentDto } from './create-prepayment.dto';

export class UpdatePrepaymentDto extends PartialType(CreatePrepaymentDto) {
  @IsOptional()
  @IsEnum(PrepaymentStatus)
  status?: PrepaymentStatus;
}
