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
import { CreateInventoryIncomeDto } from './dto/create-inventory-income.dto';
import { UpdateInventoryIncomeDto } from './dto/update-inventory-income.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('income')
  @ApiOperation({ summary: 'Add brick production to warehouse (Kirim)' })
  create(
    @Body() createDto: CreateInventoryIncomeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventoryService.create(createDto, userId);
  }

  @Get('income')
  @ApiOperation({ summary: 'Get all inventory incomes' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.inventoryService.findAll(paginationDto);
  }

  @Get('income/:id')
  @ApiOperation({ summary: 'Get inventory income by id' })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch('income/:id')
  @ApiOperation({ summary: 'Update inventory income' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateInventoryIncomeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventoryService.update(id, updateDto, userId);
  }

  @Delete('income/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete inventory income (Admin only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.inventoryService.remove(id, userId);
  }
}
