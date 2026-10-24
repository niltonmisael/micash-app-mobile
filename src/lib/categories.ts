import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import type { CategoriesResponse, Category, CategoryRequest } from '@/types/transactions';

// Categorias de despesa do usuário (a API não tem categorias de receita: essas são um enum).

/** Categorias ativas (GET /api/category/all; 204 vira lista vazia). */
export async function getCategories(token: string): Promise<Category[]> {
  const response = await apiGet<CategoriesResponse>('/api/category/all', token);
  return response?.categories ?? [];
}

/** GET /api/category/{id} (404 quando não existe ou não pertence ao usuário). */
export async function getCategory(token: string, id: number): Promise<Category> {
  const category = await apiGet<Category>(`/api/category/${id}`, token);
  if (!category) throw new Error('Categoria sem conteúdo na resposta da API.');
  return category;
}

/** POST /api/category/create — a API responde 201 sem corpo (não devolve o id). */
export async function createCategory(token: string, data: CategoryRequest): Promise<void> {
  await apiPost('/api/category/create', data, token);
}

/** PUT /api/category/{id} */
export async function updateCategory(
  token: string,
  id: number,
  data: CategoryRequest,
): Promise<void> {
  await apiPut(`/api/category/${id}`, data, token);
}

/**
 * DELETE /api/category/{id} — a API inativa a categoria (não apaga). Despesas já
 * registradas continuam ligadas a ela; a categoria só deixa de aparecer na lista.
 */
export async function deleteCategory(token: string, id: number): Promise<void> {
  await apiDelete(`/api/category/${id}`, token);
}
