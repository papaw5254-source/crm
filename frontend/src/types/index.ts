// ─── Auth ────────────────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'EMPLOYEE'

export interface User {
  id: string
  fullName: string
  phone?: string
  username: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
}

// ─── Brick Type ───────────────────────────────────────────────────────────────
export type BrickType = 'RAW_BRICK' | 'BAKED_BRICK'

// ─── Stock ───────────────────────────────────────────────────────────────────
export interface Stock {
  id: string
  productName: string
  quantity: number
  brickType?: BrickType
  updatedAt: string
}

export type StockMovementType =
  | 'INCOME'
  | 'SALE'
  | 'MANUAL_ADJUSTMENT'
  | 'SALE_CANCEL'
  | 'INCOME_CANCEL'
  | 'TO_RESERVE'
  | 'FROM_RESERVE'
  | 'KILN_IN_RAW'
  | 'KILN_OUT_BAKED'
  | 'RAW_PRODUCTION'
  | 'PREPAYMENT_DELIVERY'

export interface StockMovement {
  id: string
  type: StockMovementType
  quantity: number
  previousQuantity: number
  newQuantity: number
  brickType?: BrickType
  reason?: string
  createdById?: string
  createdAt: string
}

// ─── Inventory ───────────────────────────────────────────────────────────────
export interface InventoryIncome {
  id: string
  quantity: number
  brickType?: BrickType
  description?: string
  date: string
  workerRatePerBrick?: number
  totalWorkerCost?: number
  workerPaidAmount?: number
  workerDebt?: number
  createdById?: string
  createdBy?: User
  createdAt: string
  updatedAt: string
}

// ─── Sales ───────────────────────────────────────────────────────────────────
export type PaymentType = 'CASH' | 'CARD' | 'DEBT' | 'PREPAYMENT' | 'BANK_TRANSFER'

export interface Sale {
  id: string
  quantity: number
  pricePerBrick: number
  totalAmount: number
  paymentType: PaymentType
  isReserveSale?: boolean
  brickType?: BrickType
  customerName?: string
  customerPhone?: string
  description?: string
  date: string
  workerRatePerBrick?: number
  totalWorkerCost?: number
  workerPaidAmount?: number
  workerDebt?: number
  createdById?: string
  createdBy?: User
  createdAt: string
  updatedAt: string
}

// ─── Debtors ─────────────────────────────────────────────────────────────────
export interface Debtor {
  id: string
  fullName: string
  phone?: string
  totalDebt: number
  paidAmount: number
  remainingDebt: number
  isPaid: boolean
  notes?: string
  payments?: DebtPayment[]
  createdAt: string
  updatedAt: string
}

export interface DebtPayment {
  id: string
  debtorId: string
  amount: number
  description?: string
  date: string
  createdById?: string
  createdBy?: User
  createdAt: string
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'GAS'
  | 'ELECTRICITY'
  | 'SALARY'
  | 'TRANSPORT'
  | 'MAINTENANCE'
  | 'COAL'
  | 'SOIL'
  | 'SPARE_PARTS'
  | 'CONSTRUCTION'
  | 'MEDICINE'
  | 'GREENHOUSE'
  | 'MATERIAL_HELP'
  | 'BANK_PAYMENT'
  | 'ANIMAL_FEED'
  | 'OTHER'

export interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  description?: string
  date: string
  createdById?: string
  createdBy?: User
  createdAt: string
  updatedAt: string
}

// ─── Kiln / Humbuz ────────────────────────────────────────────────────────────
export type KilnName = 'HUMBUZ_1' | 'HUMBUZ_2' | 'HUMBUZ_3'
export type RawBrickSource = 'FIELD' | 'RESERVE'

export interface KilnOperation {
  id: string
  kilnName: KilnName
  rawBricksEntered: number
  bakedBricksOutput: number
  rawBrickSource?: RawBrickSource
  responsibleWorker?: string
  date: string
  description?: string
  workerRatePerBrick?: number
  totalWorkerCost?: number
  workerPaidAmount?: number
  workerDebt?: number
  rawWorkerRatePerBrick?: number
  rawWorkerTotalCost?: number
  rawWorkerPaidAmount?: number
  rawWorkerDebt?: number
  bakedWorkerRatePerBrick?: number
  bakedWorkerTotalCost?: number
  bakedWorkerPaidAmount?: number
  bakedWorkerDebt?: number
  createdBy?: User
  createdAt: string
  updatedAt: string
}

// ─── Reserve / Zaxira ────────────────────────────────────────────────────────
export type ReserveMovementType = 'ADD' | 'REMOVE' | 'SALE' | 'TO_KILN' | 'ADJUSTMENT'

export interface ReserveMovement {
  id: string
  brickType: BrickType
  movementType: ReserveMovementType
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason?: string
  customerName?: string
  customerPhone?: string
  workerRatePerBrick?: number
  totalWorkerCost?: number
  workerPaidAmount?: number
  workerDebt?: number
  date: string
  createdBy?: User
  createdAt: string
}

export interface ReserveBalance {
  rawBrick: number
  bakedBrick: number
}

// ─── Prepayment / Zalog ──────────────────────────────────────────────────────
export type PrepaymentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Prepayment {
  id: string
  customerName?: string
  customerPhone?: string
  brickType: BrickType
  quantity: number
  pricePerBrick: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  remainingQuantity: number
  status: PrepaymentStatus
  paymentType?: PaymentType
  notes?: string
  deliveries?: PrepaymentDelivery[]
  createdBy?: User
  createdAt: string
  updatedAt: string
}

export interface PrepaymentDelivery {
  id: string
  prepaymentId: string
  quantity: number
  date: string
  deliveredAt?: string
  description?: string
  createdBy?: User
}

// ─── Money Incomes / Pul kirimlari ───────────────────────────────────────────
export type MoneyIncomeSource = 'FOUNDER' | 'BANK' | 'DEBT_RETURN' | 'OTHER'

export interface MoneyIncome {
  id: string
  amount: number
  source: MoneyIncomeSource
  fromWhom?: string
  description?: string
  date: string
  createdBy?: User
  createdAt: string
  updatedAt: string
}

// ─── Worker Payments / Ishchilar ─────────────────────────────────────────────
export type WorkerPaymentCategory =
  | 'HUMBUZ_KIRDI_CHIQDI'
  | 'HUMBUZ_ESHIKCHI'
  | 'PRESS'
  | 'FIELD_RAW_LOADING'
  | 'RESERVE_RAW_LOADING'
  | 'RESERVE_BAKED_LOADING'
  | 'ROAD_PAYMENT'
  | 'ADVANCE'
  | 'OTHER'

export interface WorkerPayment {
  id: string
  workerName: string
  category: WorkerPaymentCategory
  debtFromPreviousMonth: number
  amount: number
  paidAmount: number
  remainingDebt: number
  month: number
  year: number
  date: string
  description?: string
  createdBy?: User
  createdAt: string
  updatedAt: string
}

export interface WorkerPaymentReport {
  totalWorkers: number
  totalAmount: number
  totalPaid: number
  totalDebt: number
  totalCarriedDebt?: number
  byCategory: Record<string, { count: number; amount: number; paid: number; debt: number; carriedDebt?: number }>
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export interface DashboardData {
  currentStock: number
  bakedBrickStock: number
  rawBrickStock: number
  reserveRawBrick: number
  reserveBakedBrick: number
  todaySalesAmount: number
  todayCashReceived: number
  todayDebtAmount: number
  todayExpenses: number
  todayProfit: number
  monthlyProfit: number
  yearlyProfit: number
  totalDebts: number
  totalWorkerDebts: number
  recentSales: Sale[]
  recentExpenses: Expense[]
  recentStockMovements: StockMovement[]
}

export interface DailyReport {
  date: string
  rawBrickProduced: number
  bakedBrickProduced: number
  rawBrickToKiln: number
  rawBrickToKilnFromReserve: number
  rawBrickToKilnFromField: number
  rawBrickSold: number
  bakedBrickSold: number
  reserveRawAdded: number
  reserveBakedAdded: number
  reserveRawSold: number
  reserveBakedSold: number
  reserveRawToKiln: number
  reserveRawRemoved: number
  reserveBakedRemoved: number
  reserveSoldBricks: number
  totalSoldBricks: number
  totalAddedBricks: number
  totalSalesAmount: number
  cashSales: number
  cardSales: number
  debtSalesAmount: number
  debtPayments: number
  prepaymentPaid: number
  moneyIncomes: number
  expensesByCategory: Record<string, number>
  workerAccrued: number
  workerPayments: number
  receivedCash: number
  totalExpenses: number
  netProfit: number
  paperProfit: number
  bakedBrickStock: number
  rawBrickStock: number
  reserveRawBrick: number
  reserveBakedBrick: number
  stockAtEndOfDay: number
}

export interface MonthlyReport {
  year: number
  month: number
  dateFrom: string
  dateTo: string
  totalAddedBricks: number
  totalSoldBricks: number
  totalSalesAmount: number
  cashReceived: number
  debtSalesAmount: number
  totalExpenses: number
  netProfit: number
  paperProfit: number
  groupedByDay: Record<string, DayData>
  bestSalesDay: { date: string; salesAmount: number; soldBricks: number } | null
  highestExpenseCategory: { category: string; amount: number } | null
  expenseByCategory: Record<string, number>
}

export interface YearlyReport {
  year: number
  totalAddedBricks: number
  totalSoldBricks: number
  totalSalesAmount: number
  cashReceived: number
  debtSalesAmount: number
  totalExpenses: number
  netProfit: number
  paperProfit: number
  groupedByMonth: Record<string, MonthData>
  bestMonth: { month: string; salesAmount: number; soldBricks: number } | null
  highestExpenseCategory: { category: string; amount: number } | null
  expenseByCategory: Record<string, number>
}

export interface DayData {
  salesAmount: number
  soldBricks: number
  addedBricks: number
  expenses: number
}

export interface MonthData {
  salesAmount: number
  soldBricks: number
  expenses: number
}

export interface DebtReport {
  totalDebtors: number
  totalDebt: number
  totalPaid: number
  totalRemainingDebt: number
  unpaidDebtors: Debtor[]
  workerDebts?: { totalWorkers: number; totalDebt: number }
}

export interface ExpenseReport {
  dateFrom: string
  dateTo: string
  totalExpenses: number
  expensesByCategory: Record<string, number>
  expensesByDate: Record<string, number>
  expenses: Expense[]
}

export interface SalesReport {
  dateFrom: string
  dateTo: string
  totalSales: number
  totalSoldBricks: number
  totalSalesAmount: number
  salesByPaymentType: Record<string, { count: number; amount: number }>
  salesByDate: Record<string, number>
  sales: Sale[]
}

export interface InventoryReport {
  dateFrom: string
  dateTo: string
  totalIncome: number
  totalSales: number
  currentStock: number
  stockMovements: StockMovement[]
}

export interface StockReport {
  bakedBrickStock: number
  rawBrickStock: number
  reserveRawBrick: number
  reserveBakedBrick: number
  totalBakedBrick: number
  totalRawBrick: number
}

export interface CashflowReport {
  dateFrom: string
  dateTo: string
  totalInflows: number
  totalOutflows: number
  netCashflow: number
  inflows: { cashSales: number; cardSales: number; debtPayments: number; prepayments: number; moneyIncomes: number }
  outflows: { expenses: number; workerPayments: number }
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    totalQuantity?: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}
