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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { CreateSalaryWorkerDto } from './dto/create-salary-worker.dto';
import { SalaryWorkerQueryDto } from './dto/salary-worker-query.dto';
import { UpdateSalaryWorkerDto } from './dto/update-salary-worker.dto';
import { SalaryWorkersService } from './salary-workers.service';

@ApiTags('salary-workers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary-workers')
export class SalaryWorkersController {
  constructor(private readonly salaryWorkersService: SalaryWorkersService) {}

  @Post()
  @ApiOperation({ summary: "Oylik ishchi uchun oylik belgilash" })
  create(@Body() dto: CreateSalaryWorkerDto, @CurrentUser('id') userId: string) {
    return this.salaryWorkersService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Oylik ishchilar ro\'yxati (oy bo\'yicha filtrlanadi)' })
  findAll(@Query() query: SalaryWorkerQueryDto) {
    return this.salaryWorkersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Oylik ishchini id bo\'yicha olish' })
  findOne(@Param('id') id: string) {
    return this.salaryWorkersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Oylik ishchi ma\'lumotlarini tahrirlash' })
  update(@Param('id') id: string, @Body() dto: UpdateSalaryWorkerDto) {
    return this.salaryWorkersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Oylik ishchini o'chirish" })
  remove(@Param('id') id: string) {
    return this.salaryWorkersService.remove(id);
  }

  @Post(':id/advances')
  @ApiOperation({ summary: 'Avans berish' })
  addAdvance(
    @Param('id') id: string,
    @Body() dto: CreateSalaryAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.salaryWorkersService.addAdvance(id, dto, userId);
  }

  @Delete(':id/advances/:advanceId')
  @ApiOperation({ summary: "Avans yozuvini o'chirish" })
  removeAdvance(@Param('id') id: string, @Param('advanceId') advanceId: string) {
    return this.salaryWorkersService.removeAdvance(id, advanceId);
  }
}
