import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker, DateRangePicker } from '@/components/ui/date-picker';
import { Filter, Search, List, LayoutGrid } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface FilterOption {
  name: string;
  label: string;
  type: 'select' | 'date';
  options?: { value: string; label: string; disabled?: boolean }[];
  value: string | Date | undefined;
  onChange: (value: any) => void;
  searchable?: boolean;
}

interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
  filters?: FilterOption[];
  inlineFilters?: FilterOption[];
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  hasActiveFilters: () => boolean;
  activeFilterCount: () => number;
  onResetFilters: () => void;
  onApplyFilters?: () => void;
  perPageOptions?: number[];
  currentPerPage: string;
  onPerPageChange: (value: string) => void;
  // View toggle props
  showViewToggle?: boolean;
  activeView?: 'list' | 'grid';
  onViewChange?: (view: 'list' | 'grid') => void;
}

export function SearchAndFilterBar({
  searchTerm,
  onSearchChange,
  onSearch,
  filters = [],
  inlineFilters = [],
  showFilters,
  setShowFilters,
  hasActiveFilters,
  activeFilterCount,
  onResetFilters,
  onApplyFilters,
  perPageOptions = [10, 25, 50, 100],
  currentPerPage,
  onPerPageChange,
  // View toggle props
  showViewToggle = false,
  activeView = 'list',
  onViewChange,
}: SearchAndFilterBarProps) {
  const { t } = useTranslation();
  const getDateRangePair = (filter: FilterOption) => {
    if (filter.type !== 'date' || !filter.name.endsWith('_from')) return null;
    const prefix = filter.name.slice(0, -5);
    return filters.find((candidate) => candidate.type === 'date' && candidate.name === `${prefix}_to`) || null;
  };

  const renderFilterControl = (filter: FilterOption, rangePair: FilterOption | null = null): ReactNode => (
    <>
      {filter.type === 'select' && filter.options && (
        <Select
          value={filter.value as string}
          onValueChange={filter.onChange}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t(`All ${filter.label}`)} />
          </SelectTrigger>
          <SelectContent searchable={filter.searchable}>
            {filter.options.map((option) => (
              <SelectItem key={option.value || 'empty'} value={option.value || '_empty_'} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {filter.type === 'date' && rangePair && (
        <DateRangePicker
          startValue={(filter.value as string) || ''}
          endValue={(rangePair.value as string) || ''}
          onStartChange={filter.onChange}
          onEndChange={rangePair.onChange}
          startPlaceholder={filter.label}
          endPlaceholder={rangePair.label}
        />
      )}
      {filter.type === 'date' && !rangePair && (
        <DatePicker
          value={(filter.value as string) || ''}
          onChange={filter.onChange}
        />
      )}
    </>
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <form onSubmit={onSearch} className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search...")}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9"
              />
            </div>
            <Button type="submit" size="sm">
              <Search className="h-4 w-4 mr-1.5" />
              {t("Search")}
            </Button>
          </form>

          {inlineFilters.map((filter) => (
            <div key={filter.name} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{filter.label}</Label>
              {renderFilterControl(filter)}
            </div>
          ))}
          
          {filters.length > 0 && (
            <div className="ml-2">
              <Button
                variant={hasActiveFilters() ? "default" : "outline"}
                size="sm"
                className="h-8 px-2 py-1"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                {showFilters ? t('Hide Filters') : t('Filters')}
                {hasActiveFilters() && (
                  <span className="ml-1 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {activeFilterCount()}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showViewToggle && onViewChange && (
            <div className="border rounded-md p-0.5 mr-2">
              <Button 
                size="sm" 
                variant={activeView === 'list' ? "default" : "ghost"}
                className="h-7 px-2"
                onClick={() => onViewChange('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant={activeView === 'grid' ? "default" : "ghost"}
                className="h-7 px-2"
                onClick={() => onViewChange('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <Label className="text-xs text-muted-foreground">{t("Per Page:")}</Label>
          <Select
            value={currentPerPage}
            onValueChange={onPerPageChange}
          >
            <SelectTrigger className="w-16 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {perPageOptions.map(option => (
                <SelectItem key={option} value={option.toString()}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showFilters && filters.length > 0 && (
        <div className="w-full mt-3 p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-md">
          <div className="flex flex-wrap gap-4 items-end">
            {filters.map((filter) => {
              if (filter.type === 'date' && filter.name.endsWith('_to')) {
                const prefix = filter.name.slice(0, -3);
                const previous = filters.find((candidate) => candidate.type === 'date' && candidate.name === `${prefix}_from`);
                if (previous) return null;
              }

              const rangePair = getDateRangePair(filter);

              return (
                <div key={filter.name} className="space-y-2">
                  <Label>{rangePair ? `${filter.label} - ${rangePair.label}` : filter.label}</Label>
                  {renderFilterControl(filter, rangePair)}
                </div>
              );
            })}

            <div className="flex gap-2">
              {onApplyFilters && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-9"
                  onClick={onApplyFilters}
                >
                  {t("Apply Filters")}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={onResetFilters}
                disabled={!hasActiveFilters()}
              >
                {t("Reset Filters")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
