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
import { WorkerPaymentsService } from '../worker-payments/worker-payments.service';
import { CreateKilnOperationDto } from './dto/create-kiln-operation.dto';
import { UpdateKilnOperationDto } from './dto/update-kiln-operation.dto';
import { KilnOperation } from './entities/kiln-operation.entity';

@Injectable()
export class KilnService {
  constructor(
    @InjectRepository(KilnOperation)
    private readonly kilnOperationRepository: Repository<KilnOperation>,
    private readonly dataSource: DataSource,
    private readonly workerPaymentsService: WorkerPaymentsService,
  ) {}

  async create(dto: CreateKilnOperationDto, userId: string): Promise<KilnOperation> {
    const rawEntered = dto.rawBricksEntered || 0;
    const bakedOutput = dto.bakedBricksOutput || 0;

    if (rawEntered === 0 && bakedOutput === 0) {
      throw new BadRequestException('At least one of rawBricksEntered or bakedBricksOutput must be > 0');
    }

    const legacyRate = dto.workerRatePerBrick || 0;
    const legacyPaid = dto.workerPaidAmount || 0;
    const rawRate = dto.rawWorkerRatePerBrick ?? legacyRate;
    const bakedRate = dto.bakedWorkerRatePerBrick ?? legacyRate;
    const qachigarRate = dto.qachigarRatePerBrick ?? 0;
    const qachigarPaid = dto.qachigarPaidAmount ?? 0;

    const rawWorkerCost = rawEntered > 0 && rawRate > 0 ? rawEntered * rawRate : 0;
    const bakedWorkerCost = bakedOutput > 0 && bakedRate > 0 ? bakedOutput * bakedRate : 0;
    const qachigarCost = bakedOutput > 0 && qachigarRate > 0 ? bakedOutput * qachigarRate : 0;

    let rawPaid: number;
    let bakedPaid: number;
    if (dto.rawWorkerPaidAmount !== undefined || dto.bakedWorkerPaidAmount !== undefined) {
      rawPaid = dto.rawWorkerPaidAmount ?? 0;
      bakedPaid = dto.bakedWorkerPaidAmount ?? 0;
    } else {
      rawPaid = Math.min(rawWorkerCost, legacyPaid);
      bakedPaid = Math.max(0, legacyPaid - rawPaid);
    }

    let rawWorkerDebt = Math.max(0, rawWorkerCost - rawPaid);
    let bakedWorkerDebt = Math.max(0, bakedWorkerCost - bakedPaid);
    let qachigarDebt = Math.max(0, qachigarCost - qachigarPaid);

    let saved = await this.dataSource.transaction(async (manager) => {
      const operation = manager.create(KilnOperation, { ...dto, rawBricksEntered: rawEntered, bakedBricksOutput: bakedOutput, createdById: userId });
      const saved = await manager.save(KilnOperation, operation);

        if (rawEntered > 0) {
          if (dto.rawBrickSource === RawBrickSource.FIELD) {
            const rawStock = await manager.findOne(Stock, { where: { brickType: BrickType.RAW_BRICK } });
            if (!rawStock) throw new NotFoundException('RAW_BRICK stock not found');
            const prev = rawStock.quantity;
            const decreaseBy = Math.min(rawEntered, prev);
            rawStock.quantity = prev - decreaseBy;
            await manager.save(Stock, rawStock);
            await manager.save(StockMovement, manager.create(StockMovement, {
              type: StockMovementType.KILN_IN_RAW,
              brickType: BrickType.RAW_BRICK,
              quantity: decreaseBy,
              previousQuantity: prev,
              newQuantity: rawStock.quantity,
              reason: `Humbuzga kirdi: ${dto.kilnName}`,
              createdById: userId,
            }));
          } else if (dto.rawBrickSource === RawBrickSource.RESERVE) {
            const lastReserve = await manager
              .createQueryBuilder(ReserveMovement, 'rm')
              .where('rm.brickType = :bt', { bt: BrickType.RAW_BRICK })
              .orderBy('rm.createdAt', 'DESC')
              .getOne();
            const currentBalance = lastReserve ? lastReserve.newQuantity : 0;
            if (currentBalance < rawEntered) {
              throw new BadRequestException(`Zaxirada yetarli xom g'isht yo'q. Mavjud: ${currentBalance} dona`);
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

    // Worker-payment rows go through WorkerPaymentsService, outside the core
    // transaction above (same split already used by update()/syncWorkerPayments), so
    // an overpayment here correctly redistributes across the whole group instead of
    // being written directly and silently skipping that machinery. Read the real
    // remainingDebt back from each created row (it may differ from the locally
    // computed value above if existing credit/debt in the group applied to it) so
    // the operation's own denormalized debt fields never drift from the truth.
    if (rawWorkerCost > 0 || rawPaid > 0) {
      const rawWp = await this.workerPaymentsService.create(
        {
          workerName: 'Ishchilar (humbuz kirdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: rawWorkerCost,
          paidAmount: rawPaid,
          month: dto.date.slice(0, 7),
          date: dto.date,
          description: `Humbuzga kirdi: ${rawEntered} dona xom g'isht (${rawRate} so'm/dona) - ${dto.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: saved.id,
        },
        userId,
      );
      rawWorkerDebt = Number(rawWp.remainingDebt);
    }

    if (bakedWorkerCost > 0 || bakedPaid > 0) {
      const bakedWp = await this.workerPaymentsService.create(
        {
          workerName: 'Ishchilar (humbuz chiqdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: bakedWorkerCost,
          paidAmount: bakedPaid,
          month: dto.date.slice(0, 7),
          date: dto.date,
          description: `Humbuzdan chiqdi: ${bakedOutput} dona pishgan g'isht (${bakedRate} so'm/dona) - ${dto.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: saved.id,
        },
        userId,
      );
      bakedWorkerDebt = Number(bakedWp.remainingDebt);
    }

    if (qachigarCost > 0 || qachigarPaid > 0) {
      const qachigarWp = await this.workerPaymentsService.create(
        {
          workerName: 'Qachigar',
          category: WorkerPaymentCategory.QACHIGAR,
          amount: qachigarCost,
          paidAmount: qachigarPaid,
          month: dto.date.slice(0, 7),
          date: dto.date,
          description: `Qachigar: ${bakedOutput} dona pishgan g'isht (${qachigarRate} so'm/dona) - ${dto.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: saved.id,
        },
        userId,
      );
      qachigarDebt = Number(qachigarWp.remainingDebt);
    }

    if (rawWorkerCost > 0 || bakedWorkerCost > 0 || qachigarCost > 0 || rawPaid > 0 || bakedPaid > 0 || qachigarPaid > 0) {
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
      saved = await this.kilnOperationRepository.save(saved);
    }

    return saved;
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
    const prevBakedOutput = Number(op.bakedBricksOutput || 0);
    const prevRawEntered = Number(op.rawBricksEntered || 0);
    const prevRawSource = op.rawBrickSource;

    Object.assign(op, dto);

    const saved = await this.dataSource.transaction(async (manager) => {
      const savedOp = await manager.save(KilnOperation, op);

      const newBakedOutput = Number(savedOp.bakedBricksOutput || 0);
      const bakedDelta = newBakedOutput - prevBakedOutput;
      if (bakedDelta !== 0) {
        const bakedStock = await manager.findOne(Stock, { where: { brickType: BrickType.BAKED_BRICK } });
        if (!bakedStock) throw new NotFoundException('BAKED_BRICK stock not found');
        const prev = bakedStock.quantity;
        bakedStock.quantity = Math.max(0, bakedStock.quantity + bakedDelta);
        await manager.save(Stock, bakedStock);
        await manager.save(StockMovement, manager.create(StockMovement, {
          type: StockMovementType.MANUAL_ADJUSTMENT,
          brickType: BrickType.BAKED_BRICK,
          quantity: Math.abs(bakedDelta),
          previousQuantity: prev,
          newQuantity: bakedStock.quantity,
          reason: `Humbuz operatsiyasi tahrirlandi: ${savedOp.kilnName}`,
          createdById: userId,
        }));
      }

      const newRawEntered = Number(savedOp.rawBricksEntered || 0);
      const newRawSource = savedOp.rawBrickSource;

      // Net how much should be drawn from RESERVE before vs. after this edit, and apply
      // a single adjustment - two separate inserts in the same transaction would tie on
      // createdAt (Postgres now() is transaction-start time), making "latest balance"
      // lookups ambiguous between them.
      const prevReserveDraw = prevRawEntered > 0 && prevRawSource === RawBrickSource.RESERVE ? prevRawEntered : 0;
      const newReserveDraw = newRawEntered > 0 && newRawSource === RawBrickSource.RESERVE ? newRawEntered : 0;
      const reserveDelta = newReserveDraw - prevReserveDraw;
      const prevFieldDraw = prevRawEntered > 0 && prevRawSource === RawBrickSource.FIELD ? prevRawEntered : 0;
      const newFieldDraw = newRawEntered > 0 && newRawSource === RawBrickSource.FIELD ? newRawEntered : 0;
      const fieldDelta = newFieldDraw - prevFieldDraw;

      if (fieldDelta !== 0) {
        const rawStock = await manager.findOne(Stock, { where: { brickType: BrickType.RAW_BRICK } });
        if (!rawStock) throw new NotFoundException('RAW_BRICK stock not found');
        const prev = rawStock.quantity;
        if (fieldDelta > 0) {
          rawStock.quantity = prev - Math.min(fieldDelta, prev);
        } else {
          rawStock.quantity = prev + Math.abs(fieldDelta);
        }
        await manager.save(Stock, rawStock);
        await manager.save(StockMovement, manager.create(StockMovement, {
          type: StockMovementType.MANUAL_ADJUSTMENT,
          brickType: BrickType.RAW_BRICK,
          quantity: Math.abs(fieldDelta),
          previousQuantity: prev,
          newQuantity: rawStock.quantity,
          reason: `Humbuz operatsiyasi tahrirlandi: ${savedOp.kilnName}`,
          createdById: userId,
        }));
      }

      if (reserveDelta !== 0) {
        const lastReserve = await manager
          .createQueryBuilder(ReserveMovement, 'rm')
          .where('rm.brickType = :bt', { bt: BrickType.RAW_BRICK })
          .orderBy('rm.createdAt', 'DESC')
          .getOne();
        const currentBalance = lastReserve ? lastReserve.newQuantity : 0;
        if (reserveDelta > 0 && currentBalance < reserveDelta) {
          throw new BadRequestException(`Zaxirada yetarli xom g'isht yo'q. Mavjud: ${currentBalance} dona`);
        }
        await manager.save(ReserveMovement, manager.create(ReserveMovement, {
          brickType: BrickType.RAW_BRICK,
          movementType: reserveDelta > 0 ? ReserveMovementType.TO_KILN : ReserveMovementType.ADD,
          quantity: Math.abs(reserveDelta),
          previousQuantity: currentBalance,
          newQuantity: currentBalance - reserveDelta,
          reason: `Humbuz operatsiyasi tahrirlandi: ${savedOp.kilnName}`,
          date: savedOp.date,
          createdById: userId,
        }));
      }

      return savedOp;
    });

    await this.syncWorkerPayments(saved, userId);

    return saved;
  }

  async remove(id: string): Promise<void> {
    const op = await this.findOne(id);
    const wpRepo = this.dataSource.getRepository(WorkerPayment);
    const stockRepo = this.dataSource.getRepository(Stock);
    const stockMovementRepo = this.dataSource.getRepository(StockMovement);
    const reserveRepo = this.dataSource.getRepository(ReserveMovement);

    // Reverse baked brick stock if operation had bakedBricksOutput
    const bakedOutput = Number(op.bakedBricksOutput || 0);
    if (bakedOutput > 0) {
      const bakedStock = await stockRepo.findOne({ where: { brickType: BrickType.BAKED_BRICK } });
      if (bakedStock) {
        const prev = bakedStock.quantity;
        bakedStock.quantity = Math.max(0, bakedStock.quantity - bakedOutput);
        await stockRepo.save(bakedStock);
        await stockMovementRepo.save(stockMovementRepo.create({
          type: StockMovementType.MANUAL_ADJUSTMENT,
          brickType: BrickType.BAKED_BRICK,
          quantity: bakedOutput,
          previousQuantity: prev,
          newQuantity: bakedStock.quantity,
          reason: `Humbuz operatsiyasi o'chirildi (teskari): ${op.kilnName}`,
        }));
      }
    }

    // Reverse raw brick reserve if rawBrickSource was RESERVE
    const rawEntered = Number(op.rawBricksEntered || 0);
    if (rawEntered > 0 && op.rawBrickSource === RawBrickSource.FIELD) {
      const rawStock = await stockRepo.findOne({ where: { brickType: BrickType.RAW_BRICK } });
      if (rawStock) {
        const prev = rawStock.quantity;
        rawStock.quantity = prev + rawEntered;
        await stockRepo.save(rawStock);
        await stockMovementRepo.save(stockMovementRepo.create({
          type: StockMovementType.MANUAL_ADJUSTMENT,
          brickType: BrickType.RAW_BRICK,
          quantity: rawEntered,
          previousQuantity: prev,
          newQuantity: rawStock.quantity,
          reason: `Humbuz operatsiyasi o'chirildi (teskari): ${op.kilnName}`,
        }));
      }
    }
    if (rawEntered > 0 && op.rawBrickSource === RawBrickSource.RESERVE) {
      const lastReserve = await reserveRepo
        .createQueryBuilder('rm')
        .where('rm.brickType = :bt', { bt: BrickType.RAW_BRICK })
        .orderBy('rm.createdAt', 'DESC')
        .getOne();
      const currentBalance = lastReserve ? lastReserve.newQuantity : 0;
      await reserveRepo.save(reserveRepo.create({
        brickType: BrickType.RAW_BRICK,
        movementType: ReserveMovementType.ADD,
        quantity: rawEntered,
        previousQuantity: currentBalance,
        newQuantity: currentBalance + rawEntered,
        reason: `Humbuz operatsiyasi o'chirildi (teskari): ${op.kilnName}`,
        date: op.date,
      }));
    }

    // Delete worker payments linked to this operation
    await wpRepo.query(
      `DELETE FROM worker_payments WHERE source_id = $1`,
      [op.id],
    );

    // Also delete standalone qachigar payments for the same date+kiln
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

    // The deletes above bypass WorkerPaymentsService and can touch all three groups
    // this operation could have contributed to — recompute them so whatever debt/
    // credit those rows had elsewhere doesn't stay frozen at its pre-delete value.
    await this.workerPaymentsService.recalculateGroup(WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI, 'Ishchilar (humbuz kirdi)');
    await this.workerPaymentsService.recalculateGroup(WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI, 'Ishchilar (humbuz chiqdi)');
    await this.workerPaymentsService.recalculateGroup(WorkerPaymentCategory.QACHIGAR, 'Qachigar');

    await this.kilnOperationRepository.remove(op);
  }

  private async syncWorkerPayments(operation: KilnOperation, userId: string): Promise<void> {
    const rawEntered = Number(operation.rawBricksEntered || 0);
    const bakedOutput = Number(operation.bakedBricksOutput || 0);
    const rawRate = Number(operation.rawWorkerRatePerBrick || operation.workerRatePerBrick || 0);
    const bakedRate = Number(operation.bakedWorkerRatePerBrick || operation.workerRatePerBrick || 0);
    const qachigarRate = Number(operation.qachigarRatePerBrick || 0);
    const qachigarPaid = Number(operation.qachigarPaidAmount || 0);
    const rawWorkerCost = rawEntered > 0 && rawRate > 0 ? rawEntered * rawRate : 0;
    const bakedWorkerCost = bakedOutput > 0 && bakedRate > 0 ? bakedOutput * bakedRate : 0;
    const qachigarCost = bakedOutput > 0 && qachigarRate > 0 ? bakedOutput * qachigarRate : 0;
    // Split combined workerPaidAmount: fill kirdi first, rest to chiqdi
    const combinedPaid = Number(operation.workerPaidAmount || 0);
    const rawPaid = Math.min(rawWorkerCost, combinedPaid);
    const bakedPaid = Math.max(0, combinedPaid - rawPaid);
    let rawWorkerDebt = Math.max(0, rawWorkerCost - rawPaid);
    let bakedWorkerDebt = Math.max(0, bakedWorkerCost - bakedPaid);
    let qachigarDebt = Math.max(0, qachigarCost - qachigarPaid);

    await this.dataSource.getRepository(WorkerPayment).delete({
      sourceType: 'KILN_OPERATION',
      sourceId: operation.id,
    });

    // Goes through WorkerPaymentsService (outside a manual transaction, same split
    // create() above uses) so an overpayment here correctly redistributes across the
    // whole group. Each branch that skips create() must still recompute the group —
    // the delete above may have removed a row other entries were counting on.
    if (rawWorkerCost > 0 || rawPaid > 0) {
      const rawWp = await this.workerPaymentsService.create(
        {
          workerName: 'Ishchilar (humbuz kirdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: rawWorkerCost,
          paidAmount: rawPaid,
          month: operation.date.slice(0, 7),
          date: operation.date,
          description: `Humbuzga kirdi: ${rawEntered} dona xom g'isht (${rawRate} so'm/dona) - ${operation.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
        },
        userId,
      );
      rawWorkerDebt = Number(rawWp.remainingDebt);
    } else {
      await this.workerPaymentsService.recalculateGroup(WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI, 'Ishchilar (humbuz kirdi)');
    }

    if (bakedWorkerCost > 0 || bakedPaid > 0) {
      const bakedWp = await this.workerPaymentsService.create(
        {
          workerName: 'Ishchilar (humbuz chiqdi)',
          category: WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI,
          amount: bakedWorkerCost,
          paidAmount: bakedPaid,
          month: operation.date.slice(0, 7),
          date: operation.date,
          description: `Humbuzdan chiqdi: ${bakedOutput} dona pishgan g'isht (${bakedRate} so'm/dona) - ${operation.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
        },
        userId,
      );
      bakedWorkerDebt = Number(bakedWp.remainingDebt);
    } else {
      await this.workerPaymentsService.recalculateGroup(WorkerPaymentCategory.HUMBUZ_KIRDI_CHIQDI, 'Ishchilar (humbuz chiqdi)');
    }

    if (qachigarCost > 0 || qachigarPaid > 0) {
      const qachigarWp = await this.workerPaymentsService.create(
        {
          workerName: 'Qachigar',
          category: WorkerPaymentCategory.QACHIGAR,
          amount: qachigarCost,
          paidAmount: qachigarPaid,
          month: operation.date.slice(0, 7),
          date: operation.date,
          description: `Qachigar: ${bakedOutput} dona pishgan g'isht (${qachigarRate} so'm/dona) - ${operation.kilnName}`,
          sourceType: 'KILN_OPERATION',
          sourceId: operation.id,
        },
        userId,
      );
      qachigarDebt = Number(qachigarWp.remainingDebt);
    } else {
      await this.workerPaymentsService.recalculateGroup(WorkerPaymentCategory.QACHIGAR, 'Qachigar');
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
    await this.kilnOperationRepository.save(operation);
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
