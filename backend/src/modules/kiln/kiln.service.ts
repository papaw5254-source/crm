import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BrickType } from '../../common/enums/brick-type.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RawBrickSource } from '../../common/enums/raw-brick-source.enum';
import { ReserveMovementType } from '../../common/enums/reserve-movement-type.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Stock } from '../stock/entities/stock.entity';
import { ReserveMovement } from '../reserve/entities/reserve-movement.entity';
import { WorkerPaymentCategory } from '../../common/enums/worker-payment-category.enum';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { CreateKilnOperationDto } from './dto/create-kiln-operation.dto';
import { UpdateKilnOperationDto } from './dto/update-kiln-operation.dto';
import { KilnOperation } from './entities/kiln-operation.entity';

@Injectable()
export class KilnService {
  constructor(
    @InjectRepository(KilnOperation)
    private readonly kilnOperationRepository: Repository<KilnOperation>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateKilnOperationDto, userId: string): Promise<KilnOperation> {
    const rawEntered = dto.rawBricksEntered || 0;
    const bakedOutput = dto.bakedBricksOutput || 0;

    if (rawEntered === 0 && bakedOutput === 0) {
      throw new BadRequestException('At least one of rawBricksEntered or bakedBricksOutput must be > 0');
    }

    return await this.dataSource.transaction(async (manager) => {
      const operation = manager.create(KilnOperation, { ...dto, rawBricksEntered: rawEntered, bakedBricksOutput: bakedOutput, createdById: userId });
      const saved = await manager.save(KilnOperation, operation);

      const legacyRate = dto.workerRatePerBrick || 0;
      const legacyPaid = dto.workerPaidAmount || 0;
      const rawRate = dto.rawWorkerRatePerBrick ?? legacyRate;
      const bakedRate = dto.bakedWorkerRatePerBrick ?? legacyRate;
      const rawPaid = dto.rawWorkerPaidAmount ?? (dto.rawWorkerRatePerBrick === undefined ? legacyPaid : 0);
      const bakedPaid = dto.bakedWorkerPaidAmount ?? 0;
      const qachigarRate = dto.qachigarRatePerBrick ?? 0;
      const qachigarPaid = dto.qachigarPaidAmount ?? 0;

      const rawWorkerCost = rawEntered > 0 && rawRate > 0 ? rawEntered * rawRate : 0;
      const bakedWorkerCost = bakedOutput > 0 && bakedRate > 0 ? bakedOutput * bakedRate : 0;
      const qachigarCost = bakedOutput > 0 && qachigarRate > 0 ? bakedOutput * qachigarRate : 0;
      const rawWorkerDebt = Math.max(0, rawWorkerCost - rawPaid);
      const bakedWorkerDebt = Math.max(0, bakedWorkerCost - bakedPaid);
      const qachigarDebt = Math.max(0, qachigarCost - qachigarPaid);

      if (rawWorkerCost > 0) {
        await manager.save(WorkerPayment, manager.create(WorkerPayment, {
          workerName: 'Ishchilar (humbuz kirdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: rawWorkerCost,
          paidAmount: rawPaid,
          remainingDebt: rawWorkerDebt,
            month: dto.date.slice(0, 7),
            date: dto.date,
            description: `Humbuzga kirdi: ${rawEntered} dona xom g'isht (${rawRate} so'm/dona) - ${dto.kilnName}`,
            sourceType: 'KILN_OPERATION',
            sourceId: saved.id,
            createdById: userId,
          }));
        }

      if (bakedWorkerCost > 0) {
        await manager.save(WorkerPayment, manager.create(WorkerPayment, {
          workerName: 'Ishchilar (humbuz chiqdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: bakedWorkerCost,
          paidAmount: bakedPaid,
          remainingDebt: bakedWorkerDebt,
            month: dto.date.slice(0, 7),
            date: dto.date,
            description: `Humbuzdan chiqdi: ${bakedOutput} dona pishgan g'isht (${bakedRate} so'm/dona) - ${dto.kilnName}`,
            sourceType: 'KILN_OPERATION',
            sourceId: saved.id,
            createdById: userId,
          }));
        }

      if (qachigarCost > 0) {
        await manager.save(WorkerPayment, manager.create(WorkerPayment, {
          workerName: 'Qachigar',
          category: WorkerPaymentCategory.QACHIGAR,
          amount: qachigarCost,
          paidAmount: qachigarPaid,
          remainingDebt: qachigarDebt,
          month: dto.date.slice(0, 7),
          date: dto.date,
          description: `Qachigar: ${bakedOutput} dona pishgan g'isht (${qachigarRate} so'm/dona) - ${dto.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: saved.id,
          createdById: userId,
        }));
      }

      if (rawWorkerCost > 0 || bakedWorkerCost > 0 || qachigarCost > 0) {
        saved.rawWorkerRatePerBrick = rawRate || null;
        saved.rawWorkerTotalCost = rawWorkerCost;
        saved.rawWorkerPaidAmount = rawPaid;
        saved.rawWorkerDebt = rawWorkerDebt;
        saved.bakedWorkerRatePerBrick = bakedRate || null;
        saved.bakedWorkerTotalCost = bakedWorkerCost;
        saved.bakedWorkerPaidAmount = bakedPaid;
        saved.bakedWorkerDebt = bakedWorkerDebt;
        saved.totalWorkerCost = rawWorkerCost + bakedWorkerCost;
        saved.workerPaidAmount = rawPaid + bakedPaid;
        saved.workerDebt = rawWorkerDebt + bakedWorkerDebt;
        saved.qachigarRatePerBrick = qachigarRate || null;
        saved.qachigarTotalCost = qachigarCost;
        saved.qachigarPaidAmount = qachigarPaid;
        saved.qachigarDebt = qachigarDebt;
        await manager.save(KilnOperation, saved);
      }

        if (rawEntered > 0) {
          if (dto.rawBrickSource === RawBrickSource.FIELD) {
            // Daladan kelgan xom g'isht ombor qoldig'idan tekshirilmaydi.
          } else if (dto.rawBrickSource === RawBrickSource.RESERVE) {
            const rawStock = await manager.findOne(Stock, { where: { brickType: BrickType.RAW_BRICK } });
            if (!rawStock || rawStock.quantity < rawEntered) {
              throw new BadRequestException(`Insufficient RAW_BRICK stock. Available: ${rawStock?.quantity || 0}`);
            }
          const prev = rawStock.quantity;
          rawStock.quantity -= rawEntered;
          await manager.save(Stock, rawStock);
          await manager.save(StockMovement, manager.create(StockMovement, {
            type: StockMovementType.KILN_IN_RAW,
            brickType: BrickType.RAW_BRICK,
            quantity: rawEntered,
            previousQuantity: prev,
            newQuantity: rawStock.quantity,
            reason: `Humbuz kirdi (dala): ${dto.kilnName}`,
            createdById: userId,
          }));
        } else if (dto.rawBrickSource === RawBrickSource.RESERVE) {
          // Get current reserve balance
          const lastReserve = await manager
            .createQueryBuilder(ReserveMovement, 'rm')
            .where('rm.brickType = :bt', { bt: BrickType.RAW_BRICK })
            .orderBy('rm.createdAt', 'DESC')
            .getOne();
          const currentBalance = lastReserve ? lastReserve.newQuantity : 0;
          if (currentBalance < rawEntered) {
            throw new BadRequestException(`Insufficient RAW_BRICK reserve. Available: ${currentBalance}`);
          }
          await manager.save(ReserveMovement, manager.create(ReserveMovement, {
            brickType: BrickType.RAW_BRICK,
            movementType: ReserveMovementType.TO_KILN,
            quantity: rawEntered,
            previousQuantity: currentBalance,
            newQuantity: currentBalance - rawEntered,
            reason: `Humbuzga yuborildi: ${dto.kilnName}`,
            date: dto.date,
            createdById: userId,
          }));
        }
      }

      if (bakedOutput > 0) {
        const bakedStock = await manager.findOne(Stock, { where: { brickType: BrickType.BAKED_BRICK } });
        if (!bakedStock) throw new NotFoundException('BAKED_BRICK stock not found');
        const prev = bakedStock.quantity;
        bakedStock.quantity += bakedOutput;
        await manager.save(Stock, bakedStock);
        await manager.save(StockMovement, manager.create(StockMovement, {
          type: StockMovementType.KILN_OUT_BAKED,
          brickType: BrickType.BAKED_BRICK,
          quantity: bakedOutput,
          previousQuantity: prev,
          newQuantity: bakedStock.quantity,
          reason: `Humbuz chiqdi: ${dto.kilnName}`,
          createdById: userId,
        }));
      }

      return saved;
    });
  }

  async findAll(paginationDto: PaginationDto & { kilnName?: string; dateFrom?: string; dateTo?: string }) {
    const { page = 1, limit = 20, dateFrom, dateTo, kilnName } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.kilnOperationRepository
      .createQueryBuilder('op')
      .leftJoinAndSelect('op.createdBy', 'user')
      .orderBy('op.date', 'DESC')
      .addOrderBy('op.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (kilnName) qb.andWhere('op.kilnName = :kilnName', { kilnName });
    if (dateFrom) qb.andWhere('op.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('op.date <= :dateTo', { dateTo });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<KilnOperation> {
    const op = await this.kilnOperationRepository.findOne({ where: { id }, relations: ['createdBy'] });
    if (!op) throw new NotFoundException(`Kiln operation ${id} not found`);
    return op;
  }

  async update(id: string, dto: UpdateKilnOperationDto, userId: string): Promise<KilnOperation> {
    const op = await this.findOne(id);
    Object.assign(op, dto);
    const saved = await this.kilnOperationRepository.save(op);

    await this.syncWorkerPayments(saved, userId);

    return saved;
  }

  async remove(id: string): Promise<void> {
    const op = await this.findOne(id);
    const wpRepo = this.dataSource.getRepository(WorkerPayment);

    // Delete worker payments linked to this operation via sourceId
    await wpRepo
      .createQueryBuilder().delete().from(WorkerPayment)
      .where('source_id = :sourceId', { sourceId: op.id })
      .execute();

    // Also delete standalone qachigar payments for the same date+kiln
    // (created via the Qachigar page — they have no sourceId)
    const kilnLabels: Record<string, string> = {
      HUMBUZ_1: '1-Humbuz',
      HUMBUZ_2: '2-Humbuz',
      HUMBUZ_3: '3-Humbuz',
    };
    const kilnLabel = kilnLabels[op.kilnName] ?? op.kilnName;
    await wpRepo.createQueryBuilder()
      .delete()
      .from(WorkerPayment)
      .where('category = :cat', { cat: WorkerPaymentCategory.QACHIGAR })
      .andWhere('date = :date', { date: op.date })
      .andWhere('description LIKE :desc', { desc: `%${kilnLabel}%` })
      .andWhere('(source_type IS NULL OR source_type != :st)', { st: 'KILN_OPERATION' })
      .execute();

    await this.kilnOperationRepository.remove(op);
  }

  private async syncWorkerPayments(operation: KilnOperation, userId: string): Promise<void> {
    const rawEntered = Number(operation.rawBricksEntered || 0);
    const bakedOutput = Number(operation.bakedBricksOutput || 0);
    const rawRate = Number(operation.rawWorkerRatePerBrick || operation.workerRatePerBrick || 0);
    const bakedRate = Number(operation.bakedWorkerRatePerBrick || operation.workerRatePerBrick || 0);
    const rawPaid = Number(operation.rawWorkerPaidAmount || operation.workerPaidAmount || 0);
    const bakedPaid = Number(operation.bakedWorkerPaidAmount || 0);
    const qachigarRate = Number(operation.qachigarRatePerBrick || 0);
    const qachigarPaid = Number(operation.qachigarPaidAmount || 0);
    const rawWorkerCost = rawEntered > 0 && rawRate > 0 ? rawEntered * rawRate : 0;
    const bakedWorkerCost = bakedOutput > 0 && bakedRate > 0 ? bakedOutput * bakedRate : 0;
    const qachigarCost = bakedOutput > 0 && qachigarRate > 0 ? bakedOutput * qachigarRate : 0;
    const rawWorkerDebt = Math.max(0, rawWorkerCost - rawPaid);
    const bakedWorkerDebt = Math.max(0, bakedWorkerCost - bakedPaid);
    const qachigarDebt = Math.max(0, qachigarCost - qachigarPaid);

      await this.dataSource.transaction(async (manager) => {
        await manager.delete(WorkerPayment, {
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
        });

      if (rawWorkerCost > 0) {
        await manager.save(WorkerPayment, manager.create(WorkerPayment, {
          workerName: 'Ishchilar (humbuz kirdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: rawWorkerCost,
          paidAmount: rawPaid,
          debtFromPreviousMonth: 0,
          remainingDebt: rawWorkerDebt,
          month: operation.date.slice(0, 7),
          date: operation.date,
          description: `Humbuzga kirdi: ${rawEntered} dona xom g'isht (${rawRate} so'm/dona) - ${operation.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
          createdById: userId,
        }));
      }

      if (bakedWorkerCost > 0) {
        await manager.save(WorkerPayment, manager.create(WorkerPayment, {
          workerName: 'Ishchilar (humbuz chiqdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: bakedWorkerCost,
          paidAmount: bakedPaid,
          debtFromPreviousMonth: 0,
          remainingDebt: bakedWorkerDebt,
          month: operation.date.slice(0, 7),
          date: operation.date,
          description: `Humbuzdan chiqdi: ${bakedOutput} dona pishgan g'isht (${bakedRate} so'm/dona) - ${operation.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
          createdById: userId,
        }));
      }

      if (qachigarCost > 0) {
        await manager.save(WorkerPayment, manager.create(WorkerPayment, {
          workerName: 'Qachigar',
          category: WorkerPaymentCategory.QACHIGAR,
          amount: qachigarCost,
          paidAmount: qachigarPaid,
          remainingDebt: qachigarDebt,
          month: operation.date.slice(0, 7),
          date: operation.date,
          description: `Qachigar: ${bakedOutput} dona pishgan g'isht (${qachigarRate} so'm/dona) - ${operation.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
          createdById: userId,
        }));
      }

      operation.rawWorkerTotalCost = rawWorkerCost;
      operation.rawWorkerPaidAmount = rawPaid;
      operation.rawWorkerDebt = rawWorkerDebt;
      operation.bakedWorkerTotalCost = bakedWorkerCost;
      operation.bakedWorkerPaidAmount = bakedPaid;
      operation.bakedWorkerDebt = bakedWorkerDebt;
      operation.totalWorkerCost = rawWorkerCost + bakedWorkerCost;
      operation.workerPaidAmount = rawPaid + bakedPaid;
      operation.workerDebt = rawWorkerDebt + bakedWorkerDebt;
      operation.qachigarRatePerBrick = qachigarRate || null;
      operation.qachigarTotalCost = qachigarCost;
      operation.qachigarPaidAmount = qachigarPaid;
      operation.qachigarDebt = qachigarDebt;
      await manager.save(KilnOperation, operation);
    });
  }

  async getReport(dateFrom?: string, dateTo?: string) {
    const qb = this.kilnOperationRepository.createQueryBuilder('op');
    if (dateFrom) qb.andWhere('op.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('op.date <= :dateTo', { dateTo });

    const operations = await qb.getMany();

    const byKiln: Record<string, { rawBricksEntered: number; bakedBricksOutput: number }> = {};
    let totalRawEntered = 0;
    let totalBakedOutput = 0;

    for (const op of operations) {
      if (!byKiln[op.kilnName]) byKiln[op.kilnName] = { rawBricksEntered: 0, bakedBricksOutput: 0 };
      byKiln[op.kilnName].rawBricksEntered += op.rawBricksEntered;
      byKiln[op.kilnName].bakedBricksOutput += op.bakedBricksOutput;
      totalRawEntered += op.rawBricksEntered;
      totalBakedOutput += op.bakedBricksOutput;
    }

    return { totalRawEntered, totalBakedOutput, byKiln, operationCount: operations.length };
  }
}
