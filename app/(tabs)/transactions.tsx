import IconSearch from '@tabler/icons-react-native/IconSearch';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton, TransactionRowSkeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { TransactionRow } from '@/components/TransactionRow';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import {
  TRANSACTIONS_LIMIT,
  getTransactions,
  groupByDate,
  mergeTransactions,
  searchTransactions,
} from '@/lib/transactions';
import type { TransactionsData } from '@/lib/transactions';
import type { Transaction } from '@/types/dashboard';
import { formatCurrency, formatRelativeDate } from '@/utils/format';

type Filter = 'all' | 'income' | 'expense';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'income', label: 'Receitas' },
  { key: 'expense', label: 'Despesas' },
];

const EMPTY_MESSAGES: Record<Filter, string> = {
  all: 'Nenhuma movimentação ainda. Suas receitas e despesas aparecerão aqui.',
  income: 'Nenhuma receita registrada ainda.',
  expense: 'Nenhuma despesa registrada ainda.',
};

// O filtro escolhe a fonte: a API tem endpoints separados para receitas e despesas.
function selectTransactions(data: TransactionsData, filter: Filter): Transaction[] {
  if (filter === 'income') return data.incomes;
  if (filter === 'expense') return data.expenses;
  return mergeTransactions(data.incomes, data.expenses);
}

export default function TransactionsScreen() {
  const { data, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(getTransactions);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  function changeFilter(next: Filter) {
    setFilter(next);
    setQuery('');
  }

  const items = data
    ? filter === 'all'
      ? selectTransactions(data, filter)
      : searchTransactions(selectTransactions(data, filter), query)
    : [];
  const monthTotal =
    data && filter !== 'all'
      ? filter === 'income'
        ? data.summary.totalIncome
        : data.summary.totalExpense
      : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.title} accessibilityRole="header">
          Transações
        </Text>

        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={changeFilter}
          style={styles.segmented}
        />

        {filter !== 'all' && (
          <View style={styles.search}>
            <TextField
              label={filter === 'income' ? 'Buscar receita' : 'Buscar despesa'}
              hideLabel
              variant="white"
              icon={IconSearch}
              value={query}
              onChangeText={setQuery}
              placeholder={filter === 'income' ? 'Buscar receita' : 'Buscar despesa'}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        )}

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        {loading && !data ? (
          <ListSkeleton />
        ) : !data ? null : items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              {query.trim() ? `Nenhum resultado para "${query.trim()}".` : EMPTY_MESSAGES[filter]}
            </Text>
          </View>
        ) : filter === 'all' ? (
          groupByDate(items).map((group) => (
            <View key={group.date}>
              <Text style={styles.groupTitle}>{formatRelativeDate(group.date)}</Text>
              <View style={styles.card}>
                {group.items.map((item, index) => (
                  <TransactionRow
                    key={item.key}
                    transaction={item}
                    divider={index < group.items.length - 1}
                  />
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.card}>
            {items.map((item, index) => (
              <TransactionRow
                key={item.key}
                transaction={item}
                subtitle="date"
                showSign={false}
                divider={index < items.length - 1}
              />
            ))}
          </View>
        )}

        {monthTotal !== undefined && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total do mês</Text>
            <Text style={styles.totalValue}>{formatCurrency(monthTotal)}</Text>
          </View>
        )}

        {data?.truncated && (
          <Text style={styles.note}>
            Mostrando as {TRANSACTIONS_LIMIT} receitas e as {TRANSACTIONS_LIMIT} despesas mais
            recentes.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ListSkeleton() {
  return (
    <View>
      <Skeleton width={60} height={14} style={styles.groupSkeleton} />
      <View style={styles.card}>
        {Array.from({ length: 4 }, (_, index) => (
          <TransactionRowSkeleton key={index} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  segmented: {
    marginBottom: 16,
  },
  search: {
    marginBottom: 16,
  },
  groupTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  groupSkeleton: {
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  totalLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
