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
import { CreateKilnOperationDto } from './dto/create-kiln-operation.dto';
import { UpdateKilnOperationDto } from './dto/update-kiln-operation.dto';
import { KilnService } from './kiln.service';

@ApiTags('kilns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kilns')
export class KilnController {
  constructor(private readonly kilnService: KilnService) {}

  @Post('operations')
  @ApiOperation({ summary: 'Humbuz operatsiyasi yaratish (kirdi/chiqdi)' })
  create(
    @Body() dto: CreateKilnOperationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.kilnService.create(dto, userId);
  }

  @Get('operations')
  @ApiOperation({ summary: 'Barcha humbuz operatsiyalarini olish' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.kilnService.findAll(paginationDto);
  }

  @Get('report')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Humbuz hisoboti (Admin only)' })
  getReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.kilnService.getReport(dateFrom, dateTo);
  }

  @Get('operations/:id')
  @ApiOperation({ summary: 'Humbuz operatsiyasini id bo\'yicha olish' })
  findOne(@Param('id') id: string) {
    return this.kilnService.findOne(id);
  }

  @Patch('operations/:id')
  @ApiOperation({ summary: 'Humbuz operatsiyasini yangilash' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKilnOperationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.kilnService.update(id, dto, userId);
  }

  @Delete('operations/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Humbuz operatsiyasini o\'chirish (Admin only)' })
  remove(@Param('id') id: string) {
    return this.kilnService.remove(id);
  }
}
