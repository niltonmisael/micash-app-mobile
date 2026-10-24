// Contratos de criação de MiCash.API (MiCash.Communication). Enums são enviados como número,
// com os mesmos valores do backend (a API não usa JsonStringEnumConverter).
import type { IncomeCategory } from '@/types/dashboard';

/** RequestIncomeJson — POST /api/income */
export type CreateIncomeRequest = {
  title: string;
  description: string | null;
  amount: number;
  /** DateOnly, "AAAA-MM-DD" */
  receivedAt: string;
  incomeCategory: IncomeCategory;
  isRecurring: boolean;
};

/** PaymentType (MiCash.Communication.Enums) */
export enum PaymentType {
  Cash = 0,
  CreditCard = 1,
  DebitCard = 2,
  EletronicTransfer = 3,
  Pix = 4,
}

/** ExpenseStatus (MiCash.Communication.Enums) */
export enum ExpenseStatus {
  Pending = 0,
  Paid = 1,
  Canceled = 2,
}

/** RequestExpenseJson — POST /api/expense */
export type CreateExpenseRequest = {
  title: string;
  /** Não aceita null na API: vazio vira "". */
  description: string;
  /** DateTime em UTC (ISO 8601); a API recusa datas futuras. */
  expenseDate: string;
  amount: number;
  paymentType: PaymentType;
  expenseStatus: ExpenseStatus;
  categoryId: number;
};

/** ResponseShortCategoryJson — categoria de despesa criada pelo usuário. */
export type Category = {
  id: number;
  name: string;
  color: string;
  icon: string;
  isActive: boolean;
};

/** RequestCreateCategoryJson / RequestUpdateCategoryJson — os três campos são obrigatórios. */
export type CategoryRequest = {
  name: string;
  /** Cor em hexadecimal (convenção do app), ex.: "#F58A3C". */
  color: string;
  /** Nome do ícone Tabler (convenção do app), ex.: "shopping-cart". */
  icon: string;
};

/** ResponseCategoriesJson — GET /api/category/all (204 quando não há categorias). */
export type CategoriesResponse = {
  categories: Category[];
};
