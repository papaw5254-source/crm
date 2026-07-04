import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateWorkerPaymentDto } from './dto/create-worker-payment.dto';
import { UpdateWorkerPaymentDto } from './dto/update-worker-payment.dto';
import { WorkerPaymentsService } from './worker-payments.service';

@ApiTags('worker-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('worker-payments')
export class WorkerPaymentsController {
  constructor(private readonly workerPaymentsService: WorkerPaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Ishchi to\'lovini yaratish' })
  create(@Body() dto: CreateWorkerPaymentDto, @CurrentUser('id') userId: string) {
    return this.workerPaymentsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha ishchi to\'lovlarini olish' })
  findAll(@Query() paginationDto: PaginationDto & { debtOnly?: string }) {
    return this.workerPaymentsService.findAll({
      ...paginationDto,
      debtOnly: paginationDto.debtOnly === 'true',
    });
  }

  @Get('report')
  @ApiOperation({ summary: 'Ishchi to\'lovlar hisoboti' })
  getReport(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.workerPaymentsService.getReport(
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
      dateFrom,
      dateTo,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ishchi to\'lovini id bo\'yicha olish' })
  findOne(@Param('id') id: string) {
    return this.workerPaymentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ishchi to\'lovini yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerPaymentDto) {
    return this.workerPaymentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Ishchi to\'lovini o\'chirish (Admin only)' })
  remove(@Param('id') id: string) {
    return this.workerPaymentsService.remove(id);
  }
}
