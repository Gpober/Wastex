"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar,
  Download,
  RefreshCw,
  TrendingUp,
  Package,
  DollarSign,
  BarChart3,
  FileText,
  ChevronDown,
  Eye,
  Loader2,
  X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import type { TooltipProps } from 'recharts';
import { supabase } from '@/lib/supabaseClient';

// Brand Colors
const BRAND_COLORS = {
  primary: '#56B6E9',
  secondary: '#3A9BD1',
  tertiary: '#7CC4ED',
  accent: '#2E86C1',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A'
  }
};

// Types
interface ProductionLog {
  id: string;
  year: number;
  month: number;
  log_date: string;
  tonnage: number;
  price_per_ton: number;
  total_amount: number;
  client_name: string;
  project_deliverable: string;
  approval_name: string;
  file_name: string;
  folder_path: string;
  file_url: string;
  last_modified: string;
  processing_status: string;
  created_at: string;
}

type SupabaseProductionLog = {
  id: number | string;
  log_date?: string | null;
  year?: number | null;
  month?: number | null;
  tonnage?: number | string | null;
  price_per_ton?: number | string | null;
  total_amount?: number | string | null;
  client_name?: string | null;
  project_deliverable?: string | null;
  approval_name?: string | null;
  file_name?: string | null;
  folder_path?: string | null;
  file_url?: string | null;
  last_modified?: string | null;
  processing_status?: string | null;
  created_at?: string | null;
};

interface KPIs {
  totalTonnage: number;
  totalRevenue: number;
  avgPricePerTon: number;
  totalLogs: number;
  revenueGrowth: number;
  tonnageGrowth: number;
}

interface ChartData {
  label: string;
  rawDate?: string;
  tonnage: number;
  revenue: number;
}

type TimePeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'YTD' | 'Trailing 12';

const TOGGLE_BASE_CLASSES =
  'h-9 px-4 text-sm font-semibold rounded-full transition-all duration-200 border flex items-center gap-1';
const TOGGLE_ACTIVE_CLASSES =
  'bg-gradient-to-r from-[#56B6E9] to-[#2E86C1] text-white shadow-md border-transparent';
const TOGGLE_INACTIVE_CLASSES =
  'bg-white text-gray-600 border-gray-300 hover:border-[#56B6E9] hover:text-[#2E86C1]';

// Logo Component
const WasteXLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center relative`}>
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <circle cx="60" cy="60" r="55" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="2"/>
      <circle cx="60" cy="60" r="42" fill={BRAND_COLORS.primary}/>
      <g fill="white">
        <rect x="45" y="40" width="30" height="8" rx="2"/>
        <rect x="35" y="55" width="50" height="6" rx="2"/>
        <rect x="40" y="68" width="40" height="6" rx="2"/>
        <rect x="45" y="81" width="30" height="6" rx="2"/>
      </g>
      <text x="60" y="102" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif">WasteX</text>
    </svg>
  </div>
);

// Main Component
const WasteXDashboard: React.FC = () => {
  // State
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('Monthly');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [timePeriodDropdownOpen, setTimePeriodDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [notification, setNotification] = useState<{show: boolean; message: string; type: 'success' | 'error' | 'info'}>({
    show: false, message: '', type: 'info'
  });
  const [photoViewer, setPhotoViewer] = useState<{ url: string; title: string } | null>(null);
  const [photoViewerLoading, setPhotoViewerLoading] = useState(false);

  const timePeriodDropdownRef = useRef<HTMLDivElement | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement | null>(null);
  const yearDropdownRef = useRef<HTMLDivElement | null>(null);

  const TIME_PERIOD_OPTIONS: TimePeriod[] = useMemo(
    () => ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'YTD', 'Trailing 12'],
    []
  );

  const monthsList = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: new Date(0, i).toLocaleString('en', { month: 'long' })
      })),
    []
  );

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

  const selectedMonthLabel = useMemo(() => {
    const found = monthsList.find((month) => month.value === selectedMonth);
    return found ? found.label : 'Select Month';
  }, [monthsList, selectedMonth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        timePeriodDropdownRef.current &&
        !timePeriodDropdownRef.current.contains(event.target as Node)
      ) {
        setTimePeriodDropdownOpen(false);
      }

      if (
        monthDropdownRef.current &&
        !monthDropdownRef.current.contains(event.target as Node)
      ) {
        setMonthDropdownOpen(false);
      }

      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(event.target as Node)
      ) {
        setYearDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const normalizeProductionLogs = (logs: SupabaseProductionLog[]): ProductionLog[] => {
    return logs.map((log) => {
      const id = log.id ? String(log.id) : `${log.log_date ?? "unknown"}-${log.client_name ?? "client"}`;
      const logDateRaw = log.log_date ?? null;
      const parsedDate = logDateRaw ? new Date(logDateRaw) : null;

      const tonnageValue = Number(log.tonnage ?? 0);
      const tonnage = Number.isFinite(tonnageValue) ? tonnageValue : 0;

      const pricePerTonValue = Number(log.price_per_ton ?? 0);
      const pricePerTon = Number.isFinite(pricePerTonValue) ? pricePerTonValue : 0;

      const totalAmountValue = Number(
        log.total_amount ?? (Number.isFinite(tonnage * pricePerTon) ? tonnage * pricePerTon : 0)
      );
      const totalAmount = Number.isFinite(totalAmountValue) ? totalAmountValue : tonnage * pricePerTon;

      return {
        id,
        year: typeof log.year === 'number' && !Number.isNaN(log.year)
          ? log.year
          : parsedDate?.getFullYear() ?? selectedYear,
        month: typeof log.month === 'number' && !Number.isNaN(log.month)
          ? log.month
          : (parsedDate ? parsedDate.getMonth() + 1 : selectedMonth),
        log_date: parsedDate ? parsedDate.toISOString() : (logDateRaw ?? new Date().toISOString()),
        tonnage,
        price_per_ton: pricePerTon,
        total_amount: totalAmount,
        client_name: log.client_name ?? 'Unknown Client',
        project_deliverable: log.project_deliverable ?? 'N/A',
        approval_name: log.approval_name ?? 'Pending Approval',
        file_name: log.file_name ?? 'N/A',
        folder_path: log.folder_path ?? '',
        file_url: log.file_url ?? '#',
        last_modified: log.last_modified ?? '',
        processing_status: log.processing_status ?? 'Pending',
        created_at: log.created_at ?? ''
      };
    });
  };

  // Load data from Supabase
  const loadProductionData = async () => {
    console.group('🚛 WasteX Production Logs Fetch');
    try {
      setLoading(true);
      setError(null);

      console.log('🔌 Testing Supabase connection to wastex_production_logs...');
      const {
        error: connectionError,
        count: connectionCount
      } = await supabase
        .from('wastex_production_logs')
        .select('id', { count: 'exact', head: true });

      if (connectionError) {
        console.error('❌ Supabase connection test failed:', connectionError);
        throw new Error(`Supabase connection test failed: ${connectionError.message}`);
      }

      console.log(
        `✅ Supabase connection succeeded. Accessible rows: ${
          typeof connectionCount === 'number' ? connectionCount : 'unknown'
        }`
      );

      const { data, error: fetchError, status } = await supabase
        .from('wastex_production_logs')
        .select('*')
        .order('log_date', { ascending: false });

      if (fetchError) {
        console.error('❌ Supabase fetch error:', { status, fetchError });
        throw new Error(`Failed to fetch production logs: ${fetchError.message}`);
      }

      const normalized = normalizeProductionLogs((data ?? []) as SupabaseProductionLog[]);
      console.log(`📦 Retrieved ${data?.length ?? 0} rows. Normalized entries: ${normalized.length}.`);

      if ((data?.length ?? 0) === 0) {
        if (typeof connectionCount === 'number' && connectionCount > 0) {
          console.warn('⚠️ Table has rows but query returned none. Check RLS policies or filters.');
        } else {
          console.warn('ℹ️ No production logs returned from Supabase.');
        }
      }

      if (normalized.length > 0) {
        setProductionLogs(normalized);
        showNotification('Production data loaded successfully', 'success');
      } else {
        setProductionLogs([]);
        showNotification('No production logs found. Check your filters or add new entries.', 'info');
      }
    } catch (err) {
      console.error('🚨 Error loading production data from Supabase:', err);
      const message = err instanceof Error ? err.message : 'Failed to load production data. Using demo data.';
      setError(message);

      // Fallback to demo data
      setProductionLogs([
        {
          id: '1',
          year: 2025,
          month: 9,
          log_date: '2025-09-26',
          tonnage: 80.0,
          price_per_ton: 20.00,
          total_amount: 1600.00,
          client_name: 'Panzarella',
          project_deliverable: 'MRF',
          approval_name: 'Michael Cruz',
          file_name: '09.26.2025 - 80 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example1',
          last_modified: '2025-09-27T07:42:00Z',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:42:00Z'
        },
        {
          id: '2',
          year: 2025,
          month: 9,
          log_date: '2025-09-25',
          tonnage: 75.0,
          price_per_ton: 20.00,
          total_amount: 1500.00,
          client_name: 'Metro Waste',
          project_deliverable: 'Collection',
          approval_name: 'Sarah Johnson',
          file_name: '09.25.2025 - 75 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example2',
          last_modified: '2025-09-27T07:34:00Z',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:34:00Z'
        },
        {
          id: '3',
          year: 2025,
          month: 9,
          log_date: '2025-09-24',
          tonnage: 176.0,
          price_per_ton: 20.00,
          total_amount: 3520.00,
          client_name: 'City Municipal',
          project_deliverable: 'Bulk Collection',
          approval_name: 'Mike Davis',
          file_name: '09.24.2025 - 176 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example3',
          last_modified: '2025-09-27T07:34:00Z',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:34:00Z'
        },
        {
          id: '4',
          year: 2025,
          month: 9,
          log_date: '2025-09-23',
          tonnage: 111.0,
          price_per_ton: 20.00,
          total_amount: 2220.00,
          client_name: 'Industrial Services',
          project_deliverable: 'Commercial',
          approval_name: 'Lisa Brown',
          file_name: '09.23.2025 - 111 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example4',
          last_modified: '2025-09-27T07:35:00Z',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:35:00Z'
        }
      ]);
      showNotification('Using demo data - check Supabase connection', 'error');
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  useEffect(() => {
    loadProductionData();
  }, []);

  // Utility functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (
    value: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      ...options
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const resolvePublicPhotoUrl = async (candidate: string | null | undefined): Promise<string | null> => {
    if (!candidate || candidate === '#') {
      return null;
    }

    const urlPattern = /^https?:\/\//i;
    if (urlPattern.test(candidate)) {
      return candidate;
    }

    const { data, error } = supabase.storage
      .from('production-photos')
      .getPublicUrl(candidate);

    if (error) {
      console.error('Failed to get public URL for production photo', error);
      return null;
    }

    return data?.publicUrl ?? null;
  };

  const handleViewPhoto = async (log: ProductionLog) => {
    try {
      setPhotoViewer(null);
      setPhotoViewerLoading(true);

      const urlPattern = /^https?:\/\//i;
      let candidate = log.file_url && log.file_url !== '#' ? log.file_url : null;

      if (!candidate && log.processing_status && urlPattern.test(log.processing_status)) {
        candidate = log.processing_status;
      }

      if (!candidate && log.file_name && log.file_name.includes('/')) {
        candidate = log.file_name;
      }

      const publicUrl = await resolvePublicPhotoUrl(candidate);

      if (!publicUrl) {
        throw new Error('No photo is associated with this production log.');
      }

      setPhotoViewer({
        url: publicUrl,
        title: log.file_name || `${log.client_name} — ${formatDate(log.log_date)}`
      });
    } catch (err) {
      console.error('Unable to display production photo', err);
      const message = err instanceof Error ? err.message : 'Unable to load production photo.';
      showNotification(message, 'error');
    } finally {
      setPhotoViewerLoading(false);
    }
  };

  const closePhotoViewer = () => {
    setPhotoViewer(null);
  };

  const formatTonnage = (
    tonnage: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      ...options
    });

    return `${formatter.format(tonnage)} tons`;
  };

  const formatAxisTonnage = (value: number): string => {
    return formatNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    });
  };

  const formatPercentageChange = (value: number): string => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

    if (value > 0) {
      return `+${formatter.format(Math.abs(value))}%`;
    }

    if (value < 0) {
      return `-${formatter.format(Math.abs(value))}%`;
    }

    return '0%';
  };

  const getDeltaColorClass = (value: number): string => {
    if (value > 0) {
      return 'text-green-600';
    }

    if (value < 0) {
      return 'text-red-600';
    }

    return 'text-gray-600';
  };

  const getComparisonLabel = (): string => {
    switch (timePeriod) {
      case 'Daily':
        return 'vs previous day';
      case 'Weekly':
        return 'vs previous week';
      case 'Monthly':
        return 'vs last month';
      case 'Quarterly':
        return 'vs prior quarter';
      case 'YTD':
        return 'vs previous YTD';
      case 'Trailing 12':
        return 'vs prior 12 months';
      default:
        return 'vs last period';
    }
  };

  const formatTooltipValue = (
    value: number | string,
    _name: string,
    props?: { dataKey?: string }
  ): [string, string] => {
    const numericValue = typeof value === 'number' ? value : Number(value);

    if (props?.dataKey === 'tonnage') {
      const tonnageDisplay = Number.isFinite(numericValue)
        ? formatTonnage(numericValue, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        : `${value} tons`;
      return [tonnageDisplay, 'Tonnage'];
    }

    const revenueValue = Number.isFinite(numericValue) ? numericValue : Number(value);
    return [formatCurrency(revenueValue), 'Revenue'];
  };

  const renderClientTooltip = (
    props: TooltipProps<number, string>
  ): JSX.Element | null => {
    if (!props.active || !props.payload?.length) {
      return null;
    }

    const { payload } = props.payload[0];
    const clientName = payload?.name ?? 'Client';
    const revenueValue = typeof props.payload[0].value === 'number'
      ? props.payload[0].value
      : Number(props.payload[0].value ?? 0);
    const percent = typeof payload?.percent === 'number' ? payload.percent * 100 : null;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-gray-900">{clientName}</p>
        <p className="text-sm text-gray-700">{formatCurrency(revenueValue)}</p>
        {percent !== null && (
          <p className="text-xs text-gray-500">{percent.toFixed(1)}% of revenue</p>
        )}
      </div>
    );
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 3000);
  };

  const getQuarterMonths = (month: number) => {
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return [startMonth, startMonth + 1, startMonth + 2];
  };

  // Filter data based on selected period
  const getFilteredData = (): ProductionLog[] => {
    const endOfSelectedMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

    switch (timePeriod) {
      case 'Daily':
      case 'Weekly':
        return productionLogs.filter(
          (log) => log.year === selectedYear && log.month === selectedMonth
        );
      case 'Monthly':
        return productionLogs.filter(
          (log) => log.year === selectedYear && log.month === selectedMonth
        );
      case 'Quarterly': {
        const quarterMonths = getQuarterMonths(selectedMonth);
        return productionLogs.filter(
          (log) => log.year === selectedYear && quarterMonths.includes(log.month)
        );
      }
      case 'YTD':
        return productionLogs.filter(
          (log) => log.year === selectedYear && log.month <= selectedMonth
        );
      case 'Trailing 12': {
        const startDate = new Date(endOfSelectedMonth);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setHours(0, 0, 0, 0);

        return productionLogs.filter((log) => {
          const logDate = new Date(log.log_date);
          return logDate >= startDate && logDate <= endOfSelectedMonth;
        });
      }
      default:
        return productionLogs.filter(
          (log) => log.year === selectedYear && log.month === selectedMonth
        );
    }
  };

  // Calculate KPIs
  const calculateKPIs = (): KPIs => {
    const filteredData = getFilteredData();
    const totalTonnage = filteredData.reduce((sum, log) => sum + log.tonnage, 0);
    const totalRevenue = filteredData.reduce((sum, log) => sum + log.total_amount, 0);
    const avgPricePerTon = totalTonnage > 0 ? totalRevenue / totalTonnage : 0;
    const totalLogs = filteredData.length;

    // Calculate growth (simplified)
    let previousData: ProductionLog[] = [];

    if (timePeriod === 'Quarterly') {
      const currentQuarterIndex = Math.floor((selectedMonth - 1) / 3);
      const previousQuarterIndex = (currentQuarterIndex + 3) % 4;
      const previousYear = currentQuarterIndex === 0 ? selectedYear - 1 : selectedYear;
      const previousQuarterStart = previousQuarterIndex * 3 + 1;
      const previousQuarterMonths = [
        previousQuarterStart,
        previousQuarterStart + 1,
        previousQuarterStart + 2
      ];

      previousData = productionLogs.filter(
        (log) => log.year === previousYear && previousQuarterMonths.includes(log.month)
      );
    } else if (timePeriod === 'YTD') {
      previousData = productionLogs.filter(
        (log) => log.year === selectedYear - 1 && log.month <= selectedMonth
      );
    } else if (timePeriod === 'Trailing 12') {
      const comparisonEnd = new Date(selectedYear, selectedMonth - 1, 1);
      comparisonEnd.setMonth(comparisonEnd.getMonth() - 1);
      const comparisonStart = new Date(comparisonEnd);
      comparisonStart.setMonth(comparisonStart.getMonth() - 11);
      comparisonStart.setHours(0, 0, 0, 0);
      const comparisonEndDate = new Date(comparisonEnd.getFullYear(), comparisonEnd.getMonth() + 1, 0, 23, 59, 59, 999);

      previousData = productionLogs.filter((log) => {
        const logDate = new Date(log.log_date);
        return logDate >= comparisonStart && logDate <= comparisonEndDate;
      });
    } else {
      const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const previousYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      previousData = productionLogs.filter(
        (log) => log.year === previousYear && log.month === previousMonth
      );
    }

    const previousRevenue = previousData.reduce((sum, log) => sum + log.total_amount, 0);
    const previousTonnage = previousData.reduce((sum, log) => sum + log.tonnage, 0);

    const revenueGrowth = previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const tonnageGrowth = previousTonnage > 0
      ? ((totalTonnage - previousTonnage) / previousTonnage) * 100
      : 0;

    return {
      totalTonnage,
      totalRevenue,
      avgPricePerTon,
      totalLogs,
      revenueGrowth,
      tonnageGrowth
    };
  };

  const getWeekStartDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // Generate chart data
  const generateChartData = (): ChartData[] => {
    const filteredData = getFilteredData();

    if (!filteredData.length && !productionLogs.length) {
      return [];
    }

    switch (timePeriod) {
      case 'Daily':
        return filteredData
          .slice()
          .sort(
            (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
          )
          .map((log) => ({
            label: new Date(log.log_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }),
            rawDate: log.log_date,
            tonnage: log.tonnage,
            revenue: log.total_amount
          }));
      case 'Weekly': {
        const weeklyMap = new Map<string, ChartData>();

        filteredData.forEach((log) => {
          const weekStart = getWeekStartDate(log.log_date);
          const key = weekStart.toISOString();

          if (!weeklyMap.has(key)) {
            weeklyMap.set(key, {
              label: `Week of ${weekStart.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}`,
              rawDate: key,
              tonnage: 0,
              revenue: 0
            });
          }

          const entry = weeklyMap.get(key)!;
          entry.tonnage += log.tonnage;
          entry.revenue += log.total_amount;
        });

        return Array.from(weeklyMap.values()).sort(
          (a, b) => new Date(a.rawDate ?? '').getTime() - new Date(b.rawDate ?? '').getTime()
        );
      }
      case 'Monthly': {
        const monthlyTotals = new Map<string, { tonnage: number; revenue: number }>();

        productionLogs.forEach((log) => {
          const key = `${log.year}-${log.month.toString().padStart(2, '0')}`;
          if (!monthlyTotals.has(key)) {
            monthlyTotals.set(key, { tonnage: 0, revenue: 0 });
          }

          const entry = monthlyTotals.get(key)!;
          entry.tonnage += log.tonnage;
          entry.revenue += log.total_amount;
        });

        return Array.from(monthlyTotals.entries())
          .sort(([a], [b]) => new Date(`${a}-01`).getTime() - new Date(`${b}-01`).getTime())
          .slice(-12)
          .map(([key, data]) => {
            const [yearStr, monthStr] = key.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            const date = new Date(year, month - 1, 1);

            return {
              label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              rawDate: date.toISOString(),
              tonnage: data.tonnage,
              revenue: data.revenue
            };
          });
      }
      case 'Quarterly': {
        const quarterlyTotals = new Map<string, { tonnage: number; revenue: number }>();

        productionLogs.forEach((log) => {
          const quarter = Math.floor((log.month - 1) / 3) + 1;
          const key = `${log.year}-Q${quarter}`;
          if (!quarterlyTotals.has(key)) {
            quarterlyTotals.set(key, { tonnage: 0, revenue: 0 });
          }

          const entry = quarterlyTotals.get(key)!;
          entry.tonnage += log.tonnage;
          entry.revenue += log.total_amount;
        });

        return Array.from(quarterlyTotals.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-8)
          .map(([key, data]) => ({
            label: key.replace('-', ' '),
            rawDate: key,
            tonnage: data.tonnage,
            revenue: data.revenue
          }));
      }
      case 'YTD': {
        const ytdTotals = new Map<number, { tonnage: number; revenue: number }>();

        productionLogs.forEach((log) => {
          if (log.year === selectedYear && log.month <= selectedMonth) {
            if (!ytdTotals.has(log.month)) {
              ytdTotals.set(log.month, { tonnage: 0, revenue: 0 });
            }

            const entry = ytdTotals.get(log.month)!;
            entry.tonnage += log.tonnage;
            entry.revenue += log.total_amount;
          }
        });

        return Array.from(ytdTotals.entries())
          .sort(([a], [b]) => a - b)
          .map(([month, data]) => {
            const date = new Date(selectedYear, month - 1, 1);
            return {
              label: date.toLocaleDateString('en-US', { month: 'short' }),
              rawDate: date.toISOString(),
              tonnage: data.tonnage,
              revenue: data.revenue
            };
          });
      }
      case 'Trailing 12': {
        const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setHours(0, 0, 0, 0);

        const trailingTotals = new Map<string, { tonnage: number; revenue: number }>();

        productionLogs.forEach((log) => {
          const logDate = new Date(log.log_date);
          if (logDate >= startDate && logDate <= endDate) {
            const key = `${log.year}-${log.month.toString().padStart(2, '0')}`;
            if (!trailingTotals.has(key)) {
              trailingTotals.set(key, { tonnage: 0, revenue: 0 });
            }

            const entry = trailingTotals.get(key)!;
            entry.tonnage += log.tonnage;
            entry.revenue += log.total_amount;
          }
        });

        return Array.from(trailingTotals.entries())
          .sort(([a], [b]) => new Date(`${a}-01`).getTime() - new Date(`${b}-01`).getTime())
          .map(([key, data]) => {
            const [yearStr, monthStr] = key.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            const date = new Date(year, month - 1, 1);
            return {
              label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              rawDate: date.toISOString(),
              tonnage: data.tonnage,
              revenue: data.revenue
            };
          });
      }
      default:
        return [];
    }
  };

  // Generate client distribution data
  const getClientDistribution = () => {
    const filteredData = getFilteredData();
    const clientData: { [key: string]: number } = {};
    
    filteredData.forEach(log => {
      const client = log.client_name || 'Unknown Client';
      clientData[client] = (clientData[client] || 0) + log.total_amount;
    });

    return Object.entries(clientData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const kpis = calculateKPIs();
  const chartData = generateChartData();
  const clientDistribution = getClientDistribution();
  const chartTitle =
    timePeriod === 'Trailing 12'
      ? 'Trailing 12-Month Production Trend'
      : `${timePeriod} Production Trend`;

  const pieColors = [BRAND_COLORS.primary, BRAND_COLORS.secondary, BRAND_COLORS.tertiary, BRAND_COLORS.success, BRAND_COLORS.warning];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading WasteX production data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <WasteXLogo className="w-10 h-10 mr-4" />
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">WasteX Production</h1>
                  <span className="text-sm px-3 py-1 rounded-full text-white" style={{ backgroundColor: BRAND_COLORS.primary }}>
                    Desktop Dashboard
                  </span>
                  {!error && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                      Auto-Updated Hourly
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">Real-time tonnage tracking • Revenue analytics • Production monitoring</p>
              </div>
            </div>
            
            {error && (
              <div className="text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                Demo Mode
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold" style={{ color: BRAND_COLORS.primary }}>
            Production Dashboard
          </h2>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative" ref={timePeriodDropdownRef}>
              <button
                onClick={() => setTimePeriodDropdownOpen(!timePeriodDropdownOpen)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ '--tw-ring-color': BRAND_COLORS.primary + '33' } as React.CSSProperties}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {timePeriod}
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>

              {timePeriodDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {TIME_PERIOD_OPTIONS.map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setTimePeriod(period);
                        setTimePeriodDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {period}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={monthDropdownRef}>
              <button
                onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ '--tw-ring-color': BRAND_COLORS.primary + '33' } as React.CSSProperties}
              >
                {selectedMonthLabel}
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>

              {monthDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-20">
                  {monthsList.map((month) => (
                    <button
                      key={month.value}
                      onClick={() => {
                        setSelectedMonth(month.value);
                        setMonthDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {month.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={yearDropdownRef}>
              <button
                onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ '--tw-ring-color': BRAND_COLORS.primary + '33' } as React.CSSProperties}
              >
                {selectedYear}
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>

              {yearDropdownOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-20">
                  {yearsList.map((year) => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setYearDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={loadProductionData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: BRAND_COLORS.primary }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Total Tonnage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatTonnage(kpis.totalTonnage, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
                <p
                  className={`text-xs mt-1 ${getDeltaColorClass(kpis.tonnageGrowth)}`}
                >
                  {formatPercentageChange(kpis.tonnageGrowth)} {getComparisonLabel()}
                </p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: BRAND_COLORS.success }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.totalRevenue)}</p>
                <p
                  className={`text-xs mt-1 ${getDeltaColorClass(kpis.revenueGrowth)}`}
                >
                  {formatPercentageChange(kpis.revenueGrowth)} {getComparisonLabel()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: BRAND_COLORS.warning }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Avg Price/Ton</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.avgPricePerTon)}</p>
                <p className="text-xs text-blue-600 mt-1">Standard rate</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: BRAND_COLORS.secondary }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Production Logs</p>
                <p className="text-2xl font-bold text-gray-900">{kpis.totalLogs}</p>
                <p className="text-xs text-gray-600 mt-1">This period</p>
              </div>
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: BRAND_COLORS.tertiary }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Avg Daily</p>
                <p className="text-2xl font-bold text-gray-900">
                  {kpis.totalLogs > 0
                    ? formatTonnage(kpis.totalTonnage / kpis.totalLogs, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })
                    : '0 tons'}
                </p>
                <p className="text-xs text-gray-600 mt-1">Per working day</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Production Trend */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold text-gray-900">{chartTitle}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`${TOGGLE_BASE_CLASSES} ${
                    chartType === 'line' ? TOGGLE_ACTIVE_CLASSES : TOGGLE_INACTIVE_CLASSES
                  }`}
                >
                  <TrendingUp
                    className={`h-4 w-4 ${
                      chartType === 'line' ? 'text-white' : 'text-gray-600'
                    }`}
                  />
                  <span className={chartType === 'line' ? 'text-white' : 'text-gray-700'}>
                    Line
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`${TOGGLE_BASE_CLASSES} ${
                    chartType === 'bar' ? TOGGLE_ACTIVE_CLASSES : TOGGLE_INACTIVE_CLASSES
                  }`}
                >
                  <BarChart3
                    className={`h-4 w-4 ${
                      chartType === 'bar' ? 'text-white' : 'text-gray-600'
                    }`}
                  />
                  <span className={chartType === 'bar' ? 'text-white' : 'text-gray-700'}>
                    Bar
                  </span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                {chartType === 'line' ? (
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 70, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis
                      yAxisId="tonnage"
                      orientation="left"
                      tickFormatter={(value) => formatAxisTonnage(Number(value))}
                      tickMargin={12}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="right"
                      tickFormatter={(value) => formatCurrency(value)}
                      tickMargin={12}
                    />
                    <Tooltip formatter={formatTooltipValue} />
                    <Legend />
                    <Line
                      yAxisId="tonnage"
                      type="monotone"
                      dataKey="tonnage"
                      stroke={BRAND_COLORS.primary}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Tonnage"
                    />
                    <Line
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="revenue"
                      stroke={BRAND_COLORS.success}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Revenue"
                    />
                  </LineChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 70, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis
                      yAxisId="tonnage"
                      orientation="left"
                      tickFormatter={(value) => formatAxisTonnage(Number(value))}
                      tickMargin={12}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="right"
                      tickFormatter={(value) => formatCurrency(value)}
                      tickMargin={12}
                    />
                    <Tooltip formatter={formatTooltipValue} />
                    <Legend />
                    <Bar
                      yAxisId="tonnage"
                      dataKey="tonnage"
                      fill={BRAND_COLORS.primary}
                      name="Tonnage"
                    />
                    <Bar
                      yAxisId="revenue"
                      dataKey="revenue"
                      fill={BRAND_COLORS.success}
                      name="Revenue"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Client Distribution */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Revenue by Client</h3>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={clientDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {clientDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderClientTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Production Logs Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Production Logs</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const csvContent = getFilteredData().map(log => 
                      [
                        log.log_date,
                        log.client_name || '',
                        log.project_deliverable || '',
                        log.tonnage,
                        log.price_per_ton,
                        log.total_amount,
                        log.processing_status
                      ].join(',')
                    ).join('\n');
                    
                    const blob = new Blob([
                      'Date,Client,Project,Tonnage,Price per Ton,Total Amount,Status\n' + csvContent
                    ], { type: 'text/csv' });
                    
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `wastex-production-${selectedYear}-${selectedMonth.toString().padStart(2, '0')}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showNotification('Data exported successfully', 'success');
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                  style={{ backgroundColor: BRAND_COLORS.primary }}
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => window.open('https://drive.google.com', '_blank')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View Source Files
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tonnage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Ton</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredData().map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(log.log_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.client_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.project_deliverable || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-semibold text-blue-600">{formatTonnage(log.tonnage)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(log.price_per_ton)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {formatCurrency(log.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {log.processing_status && !/^https?:\/\//i.test(log.processing_status) && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            {log.processing_status}
                          </span>
                        )}
                        {(log.file_url && log.file_url !== '#') ||
                        (log.processing_status && /^https?:\/\//i.test(log.processing_status)) ||
                        (log.file_name && log.file_name.trim().length > 0) ? (
                          <button
                            onClick={() => handleViewPhoto(log)}
                            className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-lg text-white shadow-sm transition-colors"
                            style={{ backgroundColor: BRAND_COLORS.primary }}
                          >
                            <Eye className="w-4 h-4" />
                            View Photo
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">No photo available</span>
                        )}
                        <button
                          onClick={() => showNotification(`Viewing details for ${log.file_name}`, 'info')}
                          className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {getFilteredData().length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No production logs found for the selected period.</p>
              <p className="text-gray-400 text-sm mt-2">Try selecting a different month or year, or check back later for updated data.</p>
            </div>
          )}
        </div>
      </main>

      {photoViewerLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-4 shadow-lg text-gray-700">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm font-semibold">Loading photo...</span>
          </div>
        </div>
      )}

      {photoViewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closePhotoViewer}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Production Photo</h4>
                {photoViewer.title && (
                  <p className="text-sm text-gray-500">{photoViewer.title}</p>
                )}
              </div>
              <button
                onClick={closePhotoViewer}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                aria-label="Close photo viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-50">
              <img
                src={photoViewer.url}
                alt={photoViewer.title || 'Production photo'}
                className="h-full max-h-[70vh] w-full object-contain bg-black"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-4 rounded-lg text-white font-medium shadow-lg transition-transform ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default WasteXDashboard;
