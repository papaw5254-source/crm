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
      // Moving from main stock to reserve
      await this.stockService.decreaseStock(
        dto.quantity,
        StockMovementType.TO_RESERVE,
        `Zaxiraga ko'chirildi: ${dto.reason || ''}`,
        userId,
        dto.brickType,
      );
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

    if (dto.workerRatePerBrick && dto.workerRatePerBrick > 0) {
      const totalWorkerCost = dto.quantity * dto.workerRatePerBrick;
      const paid = dto.workerPaidAmount || 0;
      const workerDebt = totalWorkerCost - paid;
      const category = dto.brickType === BrickType.RAW_BRICK
        ? WorkerPaymentCategory.RESERVE_RAW_LOADING
        : WorkerPaymentCategory.RESERVE_BAKED_LOADING;

      await this.workerPaymentRepository.save(
        this.workerPaymentRepository.create({
          workerName: 'Ishchilar (zaxira)',
          category,
          amount: totalWorkerCost,
          paidAmount: paid,
          remainingDebt: workerDebt,
          month: dto.date.slice(0, 7),
          date: dto.date,
          description: `${dto.quantity} dona (${dto.workerRatePerBrick} so'm/dona)`,
          createdById: userId,
        }),
      );

      saved.totalWorkerCost = totalWorkerCost;
      saved.workerPaidAmount = paid;
      saved.workerDebt = workerDebt;
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
    await this.reserveMovementRepository.remove(movement);

    const allMovements = await this.reserveMovementRepository.find({
      where: { brickType },
      order: { createdAt: 'ASC' },
    });

    let balance = 0;
    for (const m of allMovements) {
      const delta = m.newQuantity - m.previousQuantity;
      m.previousQuantity = balance;
      m.newQuantity = balance + delta;
      balance = m.newQuantity;
      await this.reserveMovementRepository.save(m);
    }
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
