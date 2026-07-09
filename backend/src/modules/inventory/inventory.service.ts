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

    const oldDebt = createDto.workerOldDebt || 0;
    if (createDto.workerRatePerBrick) {
      totalWorkerCost = createDto.quantity * createDto.workerRatePerBrick;
      const paid = createDto.workerPaidAmount || 0;
      workerDebt = Math.max(0, oldDebt + totalWorkerCost - paid);
    }

    let totalKretkachCost: number | null = null;
    let kretkachDebt: number | null = null;
    const kretkachOld = createDto.kretkachOldDebt || 0;
    if (createDto.kretkachRatePerBrick) {
      totalKretkachCost = createDto.quantity * createDto.kretkachRatePerBrick;
      const kPaid = createDto.kretkachPaidAmount || 0;
      kretkachDebt = Math.max(0, kretkachOld + totalKretkachCost - kPaid);
    }

    const eshkiOld = createDto.eshkiOldDebt || 0;
    const eshkiDaily = createDto.eshkiDailyAmount || 0;
    const eshkiPaid = createDto.eshkiPaidAmount || 0;
    const eshkiDebtVal = eshkiDaily > 0 || eshkiOld > 0 ? Math.max(0, eshkiOld + eshkiDaily - eshkiPaid) : 0;

    const income = this.inventoryIncomeRepository.create({
      ...createDto,
      brickType,
      totalWorkerCost,
      workerPaidAmount: createDto.workerPaidAmount || 0,
      workerOldDebt: oldDebt,
      workerDebt,
      totalKretkachCost,
      kretkachPaidAmount: createDto.kretkachPaidAmount || 0,
      kretkachOldDebt: kretkachOld,
      kretkachDebt,
      eshkiDailyAmount: eshkiDaily,
      eshkiPaidAmount: eshkiPaid,
      eshkiOldDebt: eshkiOld,
      eshkiDebt: eshkiDebtVal,
      createdById: userId,
    });
    const saved = await this.inventoryIncomeRepository.save(income);

    if (createDto.workerRatePerBrick && totalWorkerCost !== null) {
      const paid = createDto.workerPaidAmount || 0;
      await this.workerPaymentRepository.save(
        this.workerPaymentRepository.create({
          workerName: 'Ishchilar (press)',
          category: WorkerPaymentCategory.PRESS,
          amount: totalWorkerCost,
          paidAmount: paid,
          debtFromPreviousMonth: oldDebt,
          remainingDebt: workerDebt!,
          month: createDto.date.slice(0, 7),
          date: createDto.date,
          description: `${createDto.quantity} dona xom g'isht (${createDto.workerRatePerBrick} so'm/dona)`,
          sourceType: 'INVENTORY_INCOME',
          sourceId: saved.id,
          createdById: userId,
        }),
      );
    }

    if (createDto.kretkachRatePerBrick && totalKretkachCost !== null) {
      const kPaid = createDto.kretkachPaidAmount || 0;
      await this.workerPaymentRepository.save(
        this.workerPaymentRepository.create({
          workerName: 'Kretkachi',
          category: WorkerPaymentCategory.KRETKACHI,
          amount: totalKretkachCost,
          paidAmount: kPaid,
          debtFromPreviousMonth: kretkachOld,
          remainingDebt: kretkachDebt!,
          month: createDto.date.slice(0, 7),
          date: createDto.date,
          description: `${createDto.quantity} dona xom g'isht (${createDto.kretkachRatePerBrick} so'm/dona) — kretkachi`,
          sourceType: 'INVENTORY_INCOME_KRETKACH',
          sourceId: saved.id,
          createdById: userId,
        }),
      );
    }

    if (eshkiDaily > 0 || eshkiOld > 0) {
      await this.workerPaymentRepository.save(
        this.workerPaymentRepository.create({
          workerName: 'Eshki',
          category: WorkerPaymentCategory.ESHKI,
          amount: eshkiDaily,
          paidAmount: eshkiPaid,
          debtFromPreviousMonth: eshkiOld,
          remainingDebt: eshkiDebtVal,
          month: createDto.date.slice(0, 7),
          date: createDto.date,
          description: `Eshki kunlik to'lov — ${createDto.date}`,
          sourceType: 'INVENTORY_INCOME_ESHKI',
          sourceId: saved.id,
          createdById: userId,
        }),
      );
    }

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

    const totalQuantityRow = await qb
      .clone()
      .select('COALESCE(SUM(income.quantity), 0)', 'totalQuantity')
      .getRawOne<{ totalQuantity: string }>();
    const totalQuantity = Number(totalQuantityRow?.totalQuantity || 0);

    qb.orderBy(`income.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalQuantity } };
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
    if (updateDto.quantity !== undefined || updateDto.workerRatePerBrick !== undefined || updateDto.workerPaidAmount !== undefined || updateDto.workerOldDebt !== undefined) {
      const rate = Number(updateDto.workerRatePerBrick ?? income.workerRatePerBrick ?? 0);
      const paid = Number(updateDto.workerPaidAmount ?? income.workerPaidAmount ?? 0);
      const oldDebt = Number(updateDto.workerOldDebt ?? income.workerOldDebt ?? 0);
      income.totalWorkerCost = rate > 0 ? income.quantity * rate : null;
      income.workerPaidAmount = paid;
      income.workerOldDebt = oldDebt;
      income.workerDebt = income.totalWorkerCost !== null ? Math.max(0, oldDebt + Number(income.totalWorkerCost) - paid) : null;

      // Sync linked WorkerPayment record (new records with sourceType, and old orphan records)
      await this.workerPaymentRepository.delete({ sourceType: 'INVENTORY_INCOME', sourceId: id });
      await this.workerPaymentRepository.createQueryBuilder()
        .delete().from(WorkerPayment)
        .where('category = :cat', { cat: WorkerPaymentCategory.PRESS })
        .andWhere('date = :date', { date: income.date })
        .andWhere('source_type IS NULL')
        .execute();
      if (rate > 0 && income.totalWorkerCost !== null) {
        await this.workerPaymentRepository.save(
          this.workerPaymentRepository.create({
            workerName: 'Ishchilar (press)',
            category: WorkerPaymentCategory.PRESS,
            amount: income.totalWorkerCost,
            paidAmount: paid,
            debtFromPreviousMonth: oldDebt,
            remainingDebt: income.workerDebt!,
            month: income.date.slice(0, 7),
            date: income.date,
            description: `${income.quantity} dona xom g'isht (${rate} so'm/dona)`,
            sourceType: 'INVENTORY_INCOME',
            sourceId: id,
            createdById: userId,
          }),
        );
      }
    }

    if (updateDto.quantity !== undefined || updateDto.kretkachRatePerBrick !== undefined || updateDto.kretkachPaidAmount !== undefined || updateDto.kretkachOldDebt !== undefined) {
      const kRate = Number(income.kretkachRatePerBrick || 0);
      const kPaid = Number(income.kretkachPaidAmount || 0);
      const kOld = Number(income.kretkachOldDebt || 0);
      income.totalKretkachCost = kRate > 0 ? income.quantity * kRate : null;
      income.kretkachPaidAmount = kPaid;
      income.kretkachOldDebt = kOld;
      income.kretkachDebt = income.totalKretkachCost !== null ? Math.max(0, kOld + Number(income.totalKretkachCost) - kPaid) : null;

      await this.workerPaymentRepository.delete({ sourceType: 'INVENTORY_INCOME_KRETKACH', sourceId: id });
      if (kRate > 0 && income.totalKretkachCost !== null) {
        await this.workerPaymentRepository.save(
          this.workerPaymentRepository.create({
            workerName: 'Kretkachi',
            category: WorkerPaymentCategory.KRETKACHI,
            amount: income.totalKretkachCost,
            paidAmount: kPaid,
            debtFromPreviousMonth: kOld,
            remainingDebt: income.kretkachDebt!,
            month: income.date.slice(0, 7),
            date: income.date,
            description: `${income.quantity} dona xom g'isht (${kRate} so'm/dona) — kretkachi`,
            sourceType: 'INVENTORY_INCOME_KRETKACH',
            sourceId: id,
            createdById: userId,
          }),
        );
      }
    }

    if (updateDto.eshkiDailyAmount !== undefined || updateDto.eshkiPaidAmount !== undefined || updateDto.eshkiOldDebt !== undefined) {
      const eDaily = Number(income.eshkiDailyAmount || 0);
      const ePaid = Number(income.eshkiPaidAmount || 0);
      const eOld = Number(income.eshkiOldDebt || 0);
      income.eshkiDailyAmount = eDaily;
      income.eshkiPaidAmount = ePaid;
      income.eshkiOldDebt = eOld;
      income.eshkiDebt = Math.max(0, eOld + eDaily - ePaid);

      await this.workerPaymentRepository.delete({ sourceType: 'INVENTORY_INCOME_ESHKI', sourceId: id });
      if (eDaily > 0 || eOld > 0) {
        await this.workerPaymentRepository.save(
          this.workerPaymentRepository.create({
            workerName: 'Eshki',
            category: WorkerPaymentCategory.ESHKI,
            amount: eDaily,
            paidAmount: ePaid,
            debtFromPreviousMonth: eOld,
            remainingDebt: income.eshkiDebt,
            month: income.date.slice(0, 7),
            date: income.date,
            description: `Eshki kunlik to'lov — ${income.date}`,
            sourceType: 'INVENTORY_INCOME_ESHKI',
            sourceId: id,
            createdById: userId,
          }),
        );
      }
    }

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
    // Delete linked payments
    await this.workerPaymentRepository.delete({ sourceType: 'INVENTORY_INCOME', sourceId: id });
    await this.workerPaymentRepository.createQueryBuilder()
      .delete().from(WorkerPayment)
      .where('category = :cat', { cat: WorkerPaymentCategory.PRESS })
      .andWhere('date = :date', { date: income.date })
      .andWhere('source_type IS NULL')
      .execute();
    await this.workerPaymentRepository.delete({ sourceType: 'INVENTORY_INCOME_KRETKACH', sourceId: id });
    await this.workerPaymentRepository.delete({ sourceType: 'INVENTORY_INCOME_ESHKI', sourceId: id });
    await this.stockService.decreaseStockBestEffort(
      income.quantity,
      StockMovementType.INCOME_CANCEL,
      `Inventory income deleted (id: ${id})`,
      userId,
      brickType,
    );
    await this.inventoryIncomeRepository.remove(income);
  }
}
