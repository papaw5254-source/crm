import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateReserveMovementDto } from './dto/create-reserve-movement.dto';
import { ReserveService } from './reserve.service';

@ApiTags('reserve')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reserve')
export class ReserveController {
  constructor(private readonly reserveService: ReserveService) {}

  @Post('movements')
  @ApiOperation({ summary: 'Zaxira harakatini yaratish (kirdi/chiqdi/humbuzga)' })
  createMovement(
    @Body() dto: CreateReserveMovementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reserveService.createMovement(dto, userId);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Zaxira harakatlar tarixini olish' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.reserveService.findAll(paginationDto);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Joriy zaxira balansini olish' })
  getBalance() {
    return this.reserveService.getBalance();
  }

  @Get('report')
  @ApiOperation({ summary: 'Zaxira hisoboti' })
  getReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reserveService.getReport(dateFrom, dateTo);
  }
}
