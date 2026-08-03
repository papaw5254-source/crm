import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrickType } from '../../common/enums/brick-type.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ReserveMovementType } from '../../common/enums/reserve-movement-type.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { WorkerPaymentCategory } from '../../common/enums/worker-payment-category.enum';
import { StockService } from '../stock/stock.service';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { WorkerPaymentsService } from '../worker-payments/worker-payments.service';
import { CreateReserveMovementDto } from './dto/create-reserve-movement.dto';
import { ReserveMovement } from './entities/reserve-movement.entity';

@Injectable()
export class ReserveService {
  constructor(
    @InjectRepository(ReserveMovement)
    private readonly reserveMovementRepository: Repository<ReserveMovement>,
    @InjectRepository(WorkerPayment)
    private readonly workerPaymentRepository: Repository<WorkerPayment>,
    private readonly stockService: StockService,
    private readonly workerPaymentsService: WorkerPaymentsService,
  ) {}

  async getCurrentBalance(brickType: BrickType): Promise<number> {
    const latest = await this.reserveMovementRepository.findOne({
      where: { brickType },
      order: { createdAt: 'DESC' },
    });
    return latest ? latest.newQuantity : 0;
  }

  async getBalance() {
    const rawBalance = await this.getCurrentBalance(BrickType.RAW_BRICK);
    const bakedBalance = await this.getCurrentBalance(BrickType.BAKED_BRICK);
    return {
      [BrickType.RAW_BRICK]: rawBalance,
      [BrickType.BAKED_BRICK]: bakedBalance,
    };
  }

  async createMovement(dto: CreateReserveMovementDto, userId: string): Promise<ReserveMovement> {
    const currentBalance = await this.getCurrentBalance(dto.brickType);

    if (
      (dto.movementType === ReserveMovementType.REMOVE ||
        dto.movementType === ReserveMovementType.SALE ||
        dto.movementType === ReserveMovementType.TO_KILN) &&
      currentBalance < dto.quantity
    ) {
      throw new BadRequestException(
        `Insufficient reserve. Available: ${currentBalance}, Requested: ${dto.quantity}`,
      );
    }

      let newBalance: number;
      if (dto.movementType === ReserveMovementType.ADD) {
        // Zaxiraga qo'shish mustaqil kirim: asosiy ombor qoldig'i bilan cheklanmaydi.
        newBalance = currentBalance + dto.quantity;
      } else if (dto.movementType === ReserveMovementType.REMOVE) {
      // Moving from reserve back to main stock
      await this.stockService.increaseStock(
        dto.quantity,
        StockMovementType.FROM_RESERVE,
        `Zaxiradan qaytarildi: ${dto.reason || ''}`,
        userId,
        dto.brickType,
      );
      newBalance = currentBalance - dto.quantity;
    } else if (dto.movementType === ReserveMovementType.ADJUSTMENT) {
      // Manual adjustment — positive quantity means increase, we check sign via reason
      newBalance = currentBalance + dto.quantity;
      if (newBalance < 0) throw new BadRequestException('Reserve cannot be negative');
    } else {
      // SALE or TO_KILN — just remove from reserve, no main stock change
      newBalance = currentBalance - dto.quantity;
    }

    const movement = this.reserveMovementRepository.create({
      ...dto,
      previousQuantity: currentBalance,
      newQuantity: newBalance,
      createdById: userId,
    });
    const saved = await this.reserveMovementRepository.save(movement);

    const hasWorkerRate = !!dto.workerRatePerBrick && dto.workerRatePerBrick > 0;
    const hasWorkerPayment = !!dto.workerPaidAmount && dto.workerPaidAmount > 0;
    if (hasWorkerRate || hasWorkerPayment) {
      const totalWorkerCost = hasWorkerRate ? dto.quantity * dto.workerRatePerBrick : 0;
      const paid = dto.workerPaidAmount || 0;
      const oldDebt = dto.workerOldDebt || 0;
      const category = dto.brickType === BrickType.RAW_BRICK
        ? WorkerPaymentCategory.RESERVE_RAW_LOADING
        : WorkerPaymentCategory.RESERVE_BAKED_LOADING;

      // Goes through WorkerPaymentsService.create() (not a raw repository insert) so
      // an overpayment here correctly flows back to reduce older unpaid debts, the
      // same as every other worker-payment entry point.
      const workerPayment = await this.workerPaymentsService.create(
        {
          workerName: 'Ishchilar (zaxira)',
          category,
          amount: totalWorkerCost,
          paidAmount: paid,
          debtFromPreviousMonth: oldDebt,
          month: dto.date.slice(0, 7),
          date: dto.date,
          description: dto.quantity > 0
            ? `${dto.quantity} dona (${dto.workerRatePerBrick || 0} so'm/dona)`
            : "Ishchi puli (gishtsiz)",
          sourceType: 'RESERVE_MOVEMENT',
          sourceId: saved.id,
        },
        userId,
      );

      saved.totalWorkerCost = totalWorkerCost;
      saved.workerPaidAmount = paid;
      saved.workerOldDebt = oldDebt;
      saved.workerDebt = Number(workerPayment.remainingDebt);
      await this.reserveMovementRepository.save(saved);
    }

    return saved;
  }

  async findAll(paginationDto: PaginationDto & { brickType?: BrickType; movementType?: ReserveMovementType }) {
    const { page = 1, limit = 20, dateFrom, dateTo, brickType, movementType } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.reserveMovementRepository
      .createQueryBuilder('rm')
      .leftJoinAndSelect('rm.createdBy', 'user')
      .orderBy('rm.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (brickType) qb.andWhere('rm.brickType = :brickType', { brickType });
    if (movementType) qb.andWhere('rm.movementType = :movementType', { movementType });
    if (dateFrom) qb.andWhere('rm.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('rm.date <= :dateTo', { dateTo });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async deleteMovement(id: string): Promise<void> {
    const movement = await this.reserveMovementRepository.findOne({ where: { id } });
    if (!movement) throw new NotFoundException('Movement not found');

    const { brickType } = movement;
    const category = movement.brickType === BrickType.RAW_BRICK
      ? WorkerPaymentCategory.RESERVE_RAW_LOADING
      : WorkerPaymentCategory.RESERVE_BAKED_LOADING;
    const workerCost = Number(movement.totalWorkerCost || 0);
    if (workerCost > 0) {
      await this.workerPaymentRepository.delete({
        category,
        date: movement.date,
        amount: movement.totalWorkerCost,
      });
    }
    await this.workerPaymentRepository.delete({ sourceType: 'RESERVE_MOVEMENT', sourceId: movement.id });
    await this.reserveMovementRepository.remove(movement);

    // These deletes bypass WorkerPaymentsService, so nothing recomputed the rest of
    // this worker's group yet — without this, whatever debt/credit this movement's
    // payment had contributed to other entries stays frozen at its pre-delete value.
    await this.workerPaymentsService.recalculateGroup(category, 'Ishchilar (zaxira)');
    await this.recalculateBalance(brickType);
  }

  async deleteSaleMovement(brickType: BrickType, quantity: number, date: string): Promise<void> {
    const movement = await this.reserveMovementRepository.findOne({
      where: {
        brickType,
        quantity,
        date,
        movementType: ReserveMovementType.SALE,
      },
      order: { createdAt: 'DESC' },
    });

    if (!movement) return;

    await this.reserveMovementRepository.remove(movement);
    await this.recalculateBalance(brickType);
  }

  async updateMovement(id: string, dto: CreateReserveMovementDto, userId: string): Promise<ReserveMovement> {
    const movement = await this.reserveMovementRepository.findOne({ where: { id } });
    if (!movement) throw new NotFoundException('Movement not found');
    if (movement.movementType !== ReserveMovementType.ADD) {
      throw new BadRequestException("Faqat qo'lda qo'shilgan zaxira harakatini tahrirlash mumkin");
    }

    const oldBrickType = movement.brickType;
    const oldCategory = movement.brickType === BrickType.RAW_BRICK
      ? WorkerPaymentCategory.RESERVE_RAW_LOADING
      : WorkerPaymentCategory.RESERVE_BAKED_LOADING;
    await this.workerPaymentRepository.delete({ sourceType: 'RESERVE_MOVEMENT', sourceId: movement.id });
    if (Number(movement.totalWorkerCost || 0) > 0) {
      await this.workerPaymentRepository.delete({
        category: oldCategory,
        date: movement.date,
        amount: movement.totalWorkerCost,
      });
    }

    Object.assign(movement, {
      ...dto,
      movementType: ReserveMovementType.ADD,
      totalWorkerCost: 0,
      workerOldDebt: dto.workerOldDebt || 0,
      workerDebt: 0,
    });
    const saved = await this.reserveMovementRepository.save(movement);
    await this.syncWorkerPayment(saved, userId);
    // syncWorkerPayment only recomputes the movement's (possibly new) brickType
    // category — if brickType changed, the old category's group still needs to see
    // that this entry's contribution is gone.
    if (oldBrickType !== saved.brickType) {
      await this.workerPaymentsService.recalculateGroup(oldCategory, 'Ishchilar (zaxira)');
    }
    await this.recalculateBalance(oldBrickType);
    if (oldBrickType !== saved.brickType) await this.recalculateBalance(saved.brickType);
    return this.reserveMovementRepository.findOneOrFail({ where: { id } });
  }

  private getMovementDelta(movement: ReserveMovement): number {
    return movement.movementType === ReserveMovementType.ADD || movement.movementType === ReserveMovementType.ADJUSTMENT
      ? Number(movement.quantity)
      : -Number(movement.quantity);
  }

  private async recalculateBalance(brickType: BrickType): Promise<void> {
    const allMovements = await this.reserveMovementRepository.find({
      where: { brickType },
      order: { createdAt: 'ASC' },
    });

    let balance = 0;
    for (const m of allMovements) {
      m.previousQuantity = balance;
      m.newQuantity = balance + this.getMovementDelta(m);
      balance = m.newQuantity;
      await this.reserveMovementRepository.save(m);
    }
  }

  private async syncWorkerPayment(movement: ReserveMovement, userId: string): Promise<void> {
    await this.workerPaymentRepository.delete({ sourceType: 'RESERVE_MOVEMENT', sourceId: movement.id });

    const rate = Number(movement.workerRatePerBrick || 0);
    const totalWorkerCost = rate > 0 ? Number(movement.quantity) * rate : 0;
    const paid = Number(movement.workerPaidAmount || 0);
    const oldDebt = Number(movement.workerOldDebt || 0);
    const workerDebt = Math.max(0, oldDebt + totalWorkerCost - paid);

    movement.totalWorkerCost = totalWorkerCost;
    movement.workerPaidAmount = paid;
    movement.workerOldDebt = oldDebt;
    movement.workerDebt = workerDebt;
    await this.reserveMovementRepository.save(movement);

    const category = movement.brickType === BrickType.RAW_BRICK
      ? WorkerPaymentCategory.RESERVE_RAW_LOADING
      : WorkerPaymentCategory.RESERVE_BAKED_LOADING;

    if (totalWorkerCost <= 0 && paid <= 0) {
      // The delete above may have removed a row other entries in this group were
      // counting on (e.g. its overpayment had been covering someone else's debt) —
      // recompute now instead of leaving them stale until the next create() runs.
      await this.workerPaymentsService.recalculateGroup(category, 'Ishchilar (zaxira)');
      return;
    }

    // Goes through WorkerPaymentsService.create() so an overpayment here correctly
    // flows back to reduce older unpaid debts, same as every other entry point.
    await this.workerPaymentsService.create(
      {
        workerName: 'Ishchilar (zaxira)',
        category,
        amount: totalWorkerCost,
        paidAmount: paid,
        debtFromPreviousMonth: oldDebt,
        month: movement.date.slice(0, 7),
        date: movement.date,
        description: `${movement.quantity} dona (${rate} so'm/dona)`,
        sourceType: 'RESERVE_MOVEMENT',
        sourceId: movement.id,
      },
      userId,
    );
  }

  async getReport(dateFrom?: string, dateTo?: string) {
    const balance = await this.getBalance();

    const qb = this.reserveMovementRepository.createQueryBuilder('rm');
    if (dateFrom) qb.andWhere('rm.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('rm.date <= :dateTo', { dateTo });

    const movements = await qb.getMany();

    const summary = {
      [BrickType.RAW_BRICK]: { added: 0, sold: 0, toKiln: 0, removed: 0 },
      [BrickType.BAKED_BRICK]: { added: 0, sold: 0, toKiln: 0, removed: 0 },
    };

    for (const m of movements) {
      if (m.movementType === ReserveMovementType.ADD) summary[m.brickType].added += m.quantity;
      else if (m.movementType === ReserveMovementType.SALE) summary[m.brickType].sold += m.quantity;
      else if (m.movementType === ReserveMovementType.TO_KILN) summary[m.brickType].toKiln += m.quantity;
      else if (m.movementType === ReserveMovementType.REMOVE) summary[m.brickType].removed += m.quantity;
    }

    return { currentBalance: balance, summary };
  }
}
