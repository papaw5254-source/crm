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
import { DebtorsService } from './debtors.service';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { CreateDebtorDto } from './dto/create-debtor.dto';
import { UpdateDebtorDto } from './dto/update-debtor.dto';

@ApiTags('debtors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('debtors')
export class DebtorsController {
  constructor(private readonly debtorsService: DebtorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a debtor manually' })
  create(@Body() createDebtorDto: CreateDebtorDto) {
    return this.debtorsService.create(createDebtorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all debtors (Qarzdorlar)' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.debtorsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get debtor by id' })
  findOne(@Param('id') id: string) {
    return this.debtorsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update debtor info' })
  update(@Param('id') id: string, @Body() updateDebtorDto: UpdateDebtorDto) {
    return this.debtorsService.update(id, updateDebtorDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete debtor (Admin only)' })
  remove(@Param('id') id: string) {
    return this.debtorsService.remove(id);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Record a debt payment' })
  addPayment(
    @Param('id') id: string,
    @Body() createPaymentDto: CreateDebtPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.debtorsService.addPayment(id, createPaymentDto, userId);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Get payment history for debtor' })
  getPayments(@Param('id') id: string, @Query() paginationDto: PaginationDto) {
    return this.debtorsService.getPayments(id, paginationDto);
  }
}
