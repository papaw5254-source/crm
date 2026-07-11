import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BrickType } from '../../common/enums/brick-type.enum';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { ReserveMovementType } from '../../common/enums/reserve-movement-type.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { WorkerPaymentCategory } from '../../common/enums/worker-payment-category.enum';
import { DebtorsService } from '../debtors/debtors.service';
import { ReserveService } from '../reserve/reserve.service';
import { StockService } from '../stock/stock.service';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(WorkerPayment)
    private readonly workerPaymentRepository: Repository<WorkerPayment>,
    private readonly stockService: StockService,
    private readonly reserveService: ReserveService,
    @Inject(forwardRef(() => DebtorsService))
    private readonly debtorsService: DebtorsService,
  ) {}

  async create(createDto: CreateSaleDto, userId: string): Promise<Sale> {
    const brickType = createDto.brickType || BrickType.BAKED_BRICK;
    const pricePerBrick = Number(createDto.pricePerBrick ?? createDto.pricePerUnit ?? 0);
    if (pricePerBrick <= 0) throw new BadRequestException('Price per brick is required');
    const totalAmount = Number((createDto.quantity * pricePerBrick).toFixed(2));
    const workerRate = Number(createDto.workerRatePerBrick || 0);
    const totalWorkerCost = workerRate > 0 ? createDto.quantity * workerRate : 0;
    const workerPaidAmount = Number(createDto.workerPaidAmount || 0);
    const workerOldDebt = brickType === BrickType.RAW_BRICK ? Number(createDto.workerOldDebt || 0) : 0;
    const workerDebt = brickType === BrickType.RAW_BRICK ? Math.max(0, workerOldDebt + totalWorkerCost - workerPaidAmount) : 0;

    if (createDto.isReserveSale) {
      await this.reserveService.createMovement(
        {
          brickType,
          movementType: ReserveMovementType.SALE,
          quantity: createDto.quantity,
          reason: `Sotuv: ${createDto.customerName || 'Noma\'lum xaridor'} - ${createDto.quantity} dona`,
          date: createDto.date,
        },
        userId,
      );
    } else {
      await this.stockService.decreaseStock(
        createDto.quantity,
        StockMovementType.SALE,
        `Sale: ${createDto.customerName || 'Unknown customer'} - ${createDto.quantity} bricks`,
        userId,
        brickType,
      );
    }

    const sale = this.saleRepository.create({
      ...createDto,
      brickType,
      pricePerBrick,
      totalAmount,
      totalWorkerCost: brickType === BrickType.RAW_BRICK ? totalWorkerCost : 0,
      workerPaidAmount: brickType === BrickType.RAW_BRICK ? workerPaidAmount : 0,
      workerOldDebt,
      workerDebt,
      createdById: userId,
    });
    const saved = await this.saleRepository.save(sale);

    if (brickType === BrickType.RAW_BRICK && (totalWorkerCost > 0 || workerOldDebt > 0)) {
      const wpCategory = createDto.isReserveSale
        ? WorkerPaymentCategory.RESERVE_SALE_LOADING
        : WorkerPaymentCategory.FIELD_RAW_LOADING;
      await this.workerPaymentRepository.save(
        this.workerPaymentRepository.create({
          workerName: createDto.isReserveSale ? "Ishchilar (zaxira sotuv)" : "Ishchilar (xom g'isht yuklash)",
          category: wpCategory,
          amount: totalWorkerCost,
          paidAmount: workerPaidAmount,
          debtFromPreviousMonth: workerOldDebt,
          remainingDebt: workerDebt,
          month: createDto.date.slice(0, 7),
          date: createDto.date,
          description: `Sotuv: ${createDto.quantity} dona (${workerRate} so'm/dona)`,
          sourceType: 'SALE',
          sourceId: saved.id,
          createdById: userId,
        }),
      );
    }

    if (saved.paymentType === PaymentType.DEBT) {
      await this.debtorsService.createOrUpdateDebt({
        fullName: saved.customerName || 'Unknown',
        phone: saved.customerPhone,
        amount: Number(saved.totalAmount),
        saleId: saved.id,
      });
    }

    return saved;
  }

  async findAll(paginationDto: PaginationDto & { paymentType?: PaymentType; brickType?: BrickType; isReserveSale?: boolean }) {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      paymentType,
      brickType,
      isReserveSale,
    } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.createdBy', 'user');

    if (search) {
      qb.where(
        'sale.customerName ILIKE :search OR sale.customerPhone ILIKE :search OR sale.description ILIKE :search',
        { search: `%${search}%` },
      );
    }
    if (dateFrom) qb.andWhere('sale.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('sale.date <= :dateTo', { dateTo });
    if (paymentType) qb.andWhere('sale.paymentType = :paymentType', { paymentType });
    if (brickType) qb.andWhere('sale.brickType = :brickType', { brickType });
    if (isReserveSale === true) {
      qb.andWhere('sale.isReserveSale = true');
    } else if (isReserveSale === false) {
      qb.andWhere('(sale.isReserveSale = false OR sale.isReserveSale IS NULL)');
    }

    const totals = await qb
      .clone()
      .select('COALESCE(SUM(sale.totalAmount), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(sale.quantity), 0)', 'totalQuantity')
      .getRawOne();

    qb.orderBy(`sale.${sortBy}`, sortOrder as 'ASC' | 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalAmount: Number(totals?.totalAmount ?? totals?.totalamount ?? 0),
        totalQuantity: Number(totals?.totalQuantity ?? totals?.totalquantity ?? 0),
      },
    };
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({ where: { id }, relations: ['createdBy'] });
    if (!sale) throw new NotFoundException(`Sale with id ${id} not found`);
    return sale;
  }

  async update(id: string, updateDto: UpdateSaleDto, userId: string): Promise<Sale> {
    const sale = await this.findOne(id);
    const oldQuantity = sale.quantity;
    const brickType = sale.brickType || BrickType.BAKED_BRICK;

    Object.assign(sale, updateDto);

    if (updateDto.quantity !== undefined || updateDto.pricePerBrick !== undefined) {
      const qty = updateDto.quantity ?? sale.quantity;
      const price = updateDto.pricePerBrick ?? sale.pricePerBrick;
      sale.totalAmount = Number((qty * price).toFixed(2));
    }

    if (
      updateDto.quantity !== undefined ||
      updateDto.workerRatePerBrick !== undefined ||
      updateDto.workerPaidAmount !== undefined ||
      updateDto.workerOldDebt !== undefined
    ) {
      const qty = updateDto.quantity ?? sale.quantity;
      const workerRate = Number(updateDto.workerRatePerBrick ?? sale.workerRatePerBrick ?? 0);
      const workerPaid = Number(updateDto.workerPaidAmount ?? sale.workerPaidAmount ?? 0);
      const workerOld = sale.brickType === BrickType.RAW_BRICK ? Number(updateDto.workerOldDebt ?? sale.workerOldDebt ?? 0) : 0;
      sale.totalWorkerCost = sale.brickType === BrickType.RAW_BRICK && workerRate > 0 ? qty * workerRate : 0;
      sale.workerPaidAmount = workerPaid;
      sale.workerOldDebt = workerOld;
      sale.workerDebt = sale.brickType === BrickType.RAW_BRICK ? Math.max(0, workerOld + Number(sale.totalWorkerCost) - workerPaid) : 0;
    }

    if (updateDto.quantity !== undefined && updateDto.quantity !== oldQuantity) {
      const diff = updateDto.quantity - oldQuantity;
      if (diff > 0) {
        await this.stockService.decreaseStock(diff, StockMovementType.SALE, `Sale updated (+${diff})`, userId, brickType);
      } else {
        await this.stockService.increaseStock(Math.abs(diff), StockMovementType.SALE_CANCEL, `Sale updated (${diff})`, userId, brickType);
      }
    }

      const saved = await this.saleRepository.save(sale);
      await this.syncWorkerPayment(saved, userId);
      return saved;
    }

  async remove(id: string, userId: string, skipDebtorUpdate = false): Promise<void> {
    const sale = await this.findOne(id);
    const brickType = sale.brickType || BrickType.BAKED_BRICK;
    if (sale.isReserveSale) {
      await this.reserveService.deleteSaleMovement(brickType, sale.quantity, sale.date);
    } else {
      await this.stockService.increaseStock(
        sale.quantity,
        StockMovementType.SALE_CANCEL,
        `Sale deleted (id: ${id})`,
        userId,
        brickType,
      );
    }
    await this.workerPaymentRepository.query(
      `DELETE FROM worker_payments WHERE source_id = $1`,
      [sale.id],
    );
    const wasDebt = !skipDebtorUpdate && sale.paymentType === PaymentType.DEBT;
    const debtorName = (sale.customerName || 'Unknown').trim();
    const debtorPhone = sale.customerPhone?.trim() || undefined;
    await this.saleRepository.remove(sale);
    if (wasDebt) {
      await this.debtorsService.removeSaleDebt(debtorName, debtorPhone);
    }
  }

  private async syncWorkerPayment(sale: Sale, userId: string): Promise<void> {
    await this.workerPaymentRepository.query(
      `DELETE FROM worker_payments WHERE source_id = $1 AND source_type = $2`,
      [sale.id, 'SALE'],
    );

    if (sale.brickType !== BrickType.RAW_BRICK) return;

    const workerRate = Number(sale.workerRatePerBrick || 0);
    const totalWorkerCost = workerRate > 0 ? sale.quantity * workerRate : 0;
    const workerPaidAmount = Number(sale.workerPaidAmount || 0);
    const workerOldDebt = Number(sale.workerOldDebt || 0);
    const workerDebt = Math.max(0, workerOldDebt + totalWorkerCost - workerPaidAmount);

    sale.totalWorkerCost = totalWorkerCost;
    sale.workerPaidAmount = workerPaidAmount;
    sale.workerOldDebt = workerOldDebt;
    sale.workerDebt = workerDebt;
    await this.saleRepository.save(sale);

    if (totalWorkerCost <= 0 && workerOldDebt <= 0) return;

    const wpCategory = sale.isReserveSale
      ? WorkerPaymentCategory.RESERVE_SALE_LOADING
      : WorkerPaymentCategory.FIELD_RAW_LOADING;
    await this.workerPaymentRepository.save(
      this.workerPaymentRepository.create({
        workerName: sale.isReserveSale ? "Ishchilar (zaxira sotuv)" : "Ishchilar (xom g'isht yuklash)",
        category: wpCategory,
        amount: totalWorkerCost,
        paidAmount: workerPaidAmount,
        debtFromPreviousMonth: workerOldDebt,
        remainingDebt: workerDebt,
        month: sale.date.slice(0, 7),
        date: sale.date,
        description: `Sotuv: ${sale.quantity} dona (${workerRate} so'm/dona)`,
        sourceType: 'SALE',
        sourceId: sale.id,
        createdById: userId,
      }),
    );
  }

  async getSalesByDateRange(dateFrom: string, dateTo: string): Promise<Sale[]> {
    return this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.date >= :dateFrom', { dateFrom })
      .andWhere('sale.date <= :dateTo', { dateTo })
      .getMany();
  }

  private async getGroupedFirms(paymentType: PaymentType) {
    const rows = await this.saleRepository
      .createQueryBuilder('sale')
      .select('sale.customerName', 'firmName')
      .addSelect('COUNT(*)', 'totalSales')
      .addSelect('COALESCE(SUM(sale.quantity), 0)', 'totalQuantity')
      .addSelect('COALESCE(SUM(sale.totalAmount), 0)', 'totalAmount')
      .where('sale.paymentType = :type', { type: paymentType })
      .groupBy('sale.customerName')
      .orderBy('SUM(sale.totalAmount)', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      firmName: (r.firmName as string) || "Noma'lum",
      totalSales: Number(r.totalSales),
      totalQuantity: Number(r.totalQuantity),
      totalAmount: Number(r.totalAmount),
      sales: [] as Sale[],
    }));
  }

  async getBankTransferFirms() {
    return this.getGroupedFirms(PaymentType.BANK_TRANSFER);
  }

  async getDebtFirms() {
    return this.getGroupedFirms(PaymentType.DEBT);
  }

  async getFirmSales(firmName: string, paymentType: PaymentType): Promise<Sale[]> {
    return this.saleRepository
      .createQueryBuilder('sale')
      .select([
        'sale.id', 'sale.customerName', 'sale.customerPhone',
        'sale.brickType', 'sale.quantity', 'sale.pricePerBrick',
        'sale.totalAmount', 'sale.paymentType', 'sale.date',
        'sale.description', 'sale.createdAt',
      ])
      .where('sale.customerName = :firmName', { firmName })
      .andWhere('sale.paymentType = :paymentType', { paymentType })
      .orderBy('sale.date', 'DESC')
      .getMany();
  }

  async getFirmNames(): Promise<string[]> {
    const results = await this.saleRepository
      .createQueryBuilder('sale')
      .select('DISTINCT sale.customerName', 'customerName')
      .where('sale.customerName IS NOT NULL')
      .andWhere("sale.customerName != ''")
      .andWhere('sale.paymentType IN (:...types)', { types: [PaymentType.BANK_TRANSFER, PaymentType.DEBT] })
      .orderBy('sale.customerName', 'ASC')
      .getRawMany();
    return results.map((r) => r.customerName).filter(Boolean);
  }
}
