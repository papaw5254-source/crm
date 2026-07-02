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
import { CreateMoneyIncomeDto } from './dto/create-money-income.dto';
import { UpdateMoneyIncomeDto } from './dto/update-money-income.dto';
import { MoneyIncomesService } from './money-incomes.service';

@ApiTags('money-incomes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('money-incomes')
export class MoneyIncomesController {
  constructor(private readonly moneyIncomesService: MoneyIncomesService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi pul kirimi yaratish (ta\'sischidan, bankdan va h.k.)' })
  create(@Body() dto: CreateMoneyIncomeDto, @CurrentUser('id') userId: string) {
    return this.moneyIncomesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha pul kirimlarini olish' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.moneyIncomesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pul kirimini id bo\'yicha olish' })
  findOne(@Param('id') id: string) {
    return this.moneyIncomesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pul kirimini yangilash' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMoneyIncomeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.moneyIncomesService.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Pul kirimini o\'chirish (Admin only)' })
  remove(@Param('id') id: string) {
    return this.moneyIncomesService.remove(id);
  }
}
