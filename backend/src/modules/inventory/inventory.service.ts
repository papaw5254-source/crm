import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BrickType } from '../../common/enums/brick-type.enum';
import { WorkerPaymentCategory } from '../../common/enums/worker-payment-category.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { StockService } from '../stock/stock.service';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { CreateInventoryIncomeDto } from './dto/create-inventory-income.dto';
import { UpdateInventoryIncomeDto } from './dto/update-inventory-income.dto';
import { InventoryIncome } from './entities/inventory-income.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryIncome)
    private readonly inventoryIncomeRepository: Repository<InventoryIncome>,
    @InjectRepository(WorkerPayment)
    private readonly workerPaymentRepository: Repository<WorkerPayment>,
    private readonly stockService: StockService,
  ) {}

  async create(createDto: CreateInventoryIncomeDto, userId: string): Promise<InventoryIncome> {
    const brickType = createDto.brickType || BrickType.RAW_BRICK;

    let totalWorkerCost: number | null = null;
    let workerDebt: number | null = null;

    if (createDto.workerRatePerBrick) {
      totalWorkerCost = createDto.quantity * createDto.workerRatePerBrick;
      const paid = createDto.workerPaidAmount || 0;
      workerDebt = totalWorkerCost - paid;

      await this.workerPaymentRepository.save(
        this.workerPaymentRepository.create({
          workerName: 'Ishchilar (press)',
          category: WorkerPaymentCategory.PRESS,
          amount: totalWorkerCost,
          paidAmount: paid,
          remainingDebt: workerDebt,
          date: createDto.date,
          description: `${createDto.quantity} dona xom g'isht (${createDto.workerRatePerBrick} so'm/dona)`,
          createdById: userId,
        }),
      );
    }

    const income = this.inventoryIncomeRepository.create({
      ...createDto,
      brickType,
      totalWorkerCost,
      workerPaidAmount: createDto.workerPaidAmount || 0,
      workerDebt,
      createdById: userId,
    });
    const saved = await this.inventoryIncomeRepository.save(income);

    await this.stockService.increaseStock(
      createDto.quantity,
      StockMovementType.INCOME,
      `Inventory income: ${createDto.description || 'Production batch'}`,
      userId,
      brickType,
    );

    return saved;
  }

  async findAll(paginationDto: PaginationDto & { brickType?: BrickType }) {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      brickType,
    } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.inventoryIncomeRepository
      .createQueryBuilder('income')
      .leftJoinAndSelect('income.createdBy', 'user');

    if (brickType) qb.andWhere('income.brickType = :brickType', { brickType });
    if (search) qb.andWhere('income.description ILIKE :search', { search: `%${search}%` });
    if (dateFrom) qb.andWhere('income.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('income.date <= :dateTo', { dateTo });

    qb.orderBy(`income.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<InventoryIncome> {
    const income = await this.inventoryIncomeRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!income) throw new NotFoundException(`Inventory income with id ${id} not found`);
    return income;
  }

  async update(id: string, updateDto: UpdateInventoryIncomeDto, userId: string): Promise<InventoryIncome> {
    const income = await this.findOne(id);
    const oldQuantity = income.quantity;
    const brickType = income.brickType || BrickType.BAKED_BRICK;

    Object.assign(income, updateDto);
    const saved = await this.inventoryIncomeRepository.save(income);

    if (updateDto.quantity !== undefined && updateDto.quantity !== oldQuantity) {
      const diff = updateDto.quantity - oldQuantity;
      if (diff > 0) {
        await this.stockService.increaseStock(diff, StockMovementType.INCOME, `Inventory income updated (+${diff})`, userId, brickType);
      } else {
        await this.stockService.decreaseStock(Math.abs(diff), StockMovementType.INCOME_CANCEL, `Inventory income updated (${diff})`, userId, brickType);
      }
    }

    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const income = await this.findOne(id);
    const brickType = income.brickType || BrickType.BAKED_BRICK;
    await this.stockService.decreaseStock(
      income.quantity,
      StockMovementType.INCOME_CANCEL,
      `Inventory income deleted (id: ${id})`,
      userId,
      brickType,
    );
    await this.inventoryIncomeRepository.remove(income);
  }
}
