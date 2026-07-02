import { PartialType } from '@nestjs/swagger';
import { CreateKilnOperationDto } from './create-kiln-operation.dto';

export class UpdateKilnOperationDto extends PartialType(CreateKilnOperationDto) {}
