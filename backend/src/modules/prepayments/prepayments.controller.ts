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
import { GetPrepaymentsDto } from './dto/get-prepayments.dto';
import { CreatePrepaymentDeliveryDto } from './dto/create-prepayment-delivery.dto';
import { CreatePrepaymentDto } from './dto/create-prepayment.dto';
import { UpdatePrepaymentDto } from './dto/update-prepayment.dto';
import { PrepaymentsService } from './prepayments.service';

@ApiTags('prepayments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prepayments')
export class PrepaymentsController {
  constructor(private readonly prepaymentsService: PrepaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi zalog (oldindan to\'lov) yaratish' })
  create(@Body() dto: CreatePrepaymentDto, @CurrentUser('id') userId: string) {
    return this.prepaymentsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha zaloglarni olish' })
  findAll(@Query() paginationDto: GetPrepaymentsDto) {
    return this.prepaymentsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Zalogni id bo\'yicha olish' })
  findOne(@Param('id') id: string) {
    return this.prepaymentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Zalogni yangilash' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrepaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.prepaymentsService.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Zalogni o\'chirish (Admin only)' })
  remove(@Param('id') id: string) {
    return this.prepaymentsService.remove(id);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'Zalog bo\'yicha g\'isht yetkazish' })
  deliver(
    @Param('id') id: string,
    @Body() dto: CreatePrepaymentDeliveryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.prepaymentsService.deliver(id, dto, userId);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Zalog yetkazmalar tarixini olish' })
  getDeliveries(@Param('id') id: string, @Query() paginationDto: PaginationDto) {
    return this.prepaymentsService.getDeliveries(id, paginationDto);
  }

  @Delete(':id/deliveries/:deliveryId')
  @ApiOperation({ summary: 'Bitta yetkazma yozuvini o\'chirish (masalan, dublikat)' })
  removeDelivery(
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.prepaymentsService.removeDelivery(id, deliveryId, userId);
  }
}
