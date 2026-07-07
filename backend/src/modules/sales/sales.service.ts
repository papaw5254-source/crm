import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
    const totalAmount = Number((createDto.quantity * createDto.pricePerBrick).toFixed(2));
    const workerRate = Number(createDto.workerRatePerBrick || 0);
    const totalWorkerCost = workerRate > 0 ? createDto.quantity * workerRate : 0;
    const workerPaidAmount = Number(createDto.workerPaidAmount || 0);
    const workerDebt = Math.max(0, totalWorkerCost - workerPaidAmount);

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
      totalAmount,
      totalWorkerCost,
      workerPaidAmount,
      workerDebt,
      createdById: userId,
    });
    const saved = await this.saleRepository.save(sale);

      if (totalWorkerCost > 0) {
        await this.workerPaymentRepository.save(
          this.workerPaymentRepository.create({
            workerName: 'Ishchilar (sotuv)',
            category: WorkerPaymentCategory.ROAD_PAYMENT,
            amount: totalWorkerCost,
            paidAmount: workerPaidAmount,
            remainingDebt: workerDebt,
            month: createDto.date.slice(0, 7),
            date: createDto.date,
            description: `Sotuv: ${createDto.quantity} dona (${workerRate} so'm/dona)`,
            sourceType: 'SALE',
            sourceId: saved.id,
            sourceType: 'SALE',
            sourceId: saved.id,
            createdById: userId,
          }),
        );
      }

    if (createDto.paymentType === PaymentType.DEBT) {
      await this.debtorsService.createOrUpdateDebt({
        fullName: createDto.customerName || 'Unknown',
        phone: createDto.customerPhone,
        amount: totalAmount,
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
    if (isReserveSale !== undefined) qb.andWhere('sale.isReserveSale = :isReserveSale', { isReserveSale });

    qb.orderBy(`sale.${sortBy}`, sortOrder as 'ASC' | 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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
      updateDto.workerPaidAmount !== undefined
    ) {
      const qty = updateDto.quantity ?? sale.quantity;
      const workerRate = Number(updateDto.workerRatePerBrick ?? sale.workerRatePerBrick ?? 0);
      const workerPaid = Number(updateDto.workerPaidAmount ?? sale.workerPaidAmount ?? 0);
      sale.totalWorkerCost = workerRate > 0 ? qty * workerRate : 0;
      sale.workerPaidAmount = workerPaid;
      sale.workerDebt = Math.max(0, Number(sale.totalWorkerCost) - workerPaid);
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

  async remove(id: string, userId: string): Promise<void> {
    const sale = await this.findOne(id);
    const brickType = sale.brickType || BrickType.BAKED_BRICK;
    if (sale.isReserveSale) {
      await this.reserveService.createMovement(
        {
          brickType,
          movementType: ReserveMovementType.ADD,
          quantity: sale.quantity,
          reason: `Sotuv bekor qilindi (id: ${id})`,
          date: new Date().toISOString().split('T')[0],
        },
        userId,
      );
    } else {
      await this.stockService.increaseStock(
        sale.quantity,
        StockMovementType.SALE_CANCEL,
        `Sale deleted (id: ${id})`,
        userId,
        brickType,
      );
      }
    await this.workerPaymentRepository.delete({ sourceType: 'SALE', sourceId: sale.id });
    await this.workerPaymentRepository.delete({ sourceType: 'SALE', sourceId: sale.id });
    await this.saleRepository.remove(sale);
  }

  private async syncWorkerPayment(sale: Sale, userId: string): Promise<void> {
    await this.workerPaymentRepository.delete({ sourceType: 'SALE', sourceId: sale.id });

    const workerRate = Number(sale.workerRatePerBrick || 0);
    const totalWorkerCost = workerRate > 0 ? sale.quantity * workerRate : 0;
    const workerPaidAmount = Number(sale.workerPaidAmount || 0);
    const workerDebt = Math.max(0, totalWorkerCost - workerPaidAmount);

    sale.totalWorkerCost = totalWorkerCost;
    sale.workerPaidAmount = workerPaidAmount;
    sale.workerDebt = workerDebt;
    await this.saleRepository.save(sale);

    if (totalWorkerCost <= 0) return;

    await this.workerPaymentRepository.save(
      this.workerPaymentRepository.create({
        workerName: 'Ishchilar (sotuv)',
        category: WorkerPaymentCategory.ROAD_PAYMENT,
        amount: totalWorkerCost,
        paidAmount: workerPaidAmount,
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

  async getBankTransferFirms() {
    const sales = await this.saleRepository.find({
      where: { paymentType: PaymentType.BANK_TRANSFER },
      order: { date: 'DESC' },
      relations: ['createdBy'],
    });

    const grouped: Record<string, { firmName: string; totalSales: number; totalQuantity: number; totalAmount: number; sales: Sale[] }> = {};

    for (const sale of sales) {
      const key = sale.customerName || "Noma'lum";
      if (!grouped[key]) {
        grouped[key] = { firmName: key, totalSales: 0, totalQuantity: 0, totalAmount: 0, sales: [] };
      }
      grouped[key].totalSales++;
      grouped[key].totalQuantity += sale.quantity;
      grouped[key].totalAmount += Number(sale.totalAmount);
      grouped[key].sales.push(sale);
    }

    return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getDebtFirms() {
    const sales = await this.saleRepository.find({
      where: { paymentType: PaymentType.DEBT },
      order: { date: 'DESC' },
      relations: ['createdBy'],
    });

    const grouped: Record<string, { firmName: string; totalSales: number; totalQuantity: number; totalAmount: number; sales: Sale[] }> = {};

    for (const sale of sales) {
      const key = sale.customerName || "Noma'lum";
      if (!grouped[key]) {
        grouped[key] = { firmName: key, totalSales: 0, totalQuantity: 0, totalAmount: 0, sales: [] };
      }
      grouped[key].totalSales++;
      grouped[key].totalQuantity += sale.quantity;
      grouped[key].totalAmount += Number(sale.totalAmount);
      grouped[key].sales.push(sale);
    }

    return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
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
