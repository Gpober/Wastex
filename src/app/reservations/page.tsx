"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  RefreshCw,
  X,
  TrendingUp,
  Package,
  DollarSign,
  BarChart3,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/lib/supabaseClient';

const PRODUCTION_PHOTO_BUCKET = 'production-photos';
const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

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
  file_url: string | null;
  raw_file_reference: string | null;
  photo_storage_path: string | null;
  photo_bucket: string | null;
  photo_hash: string | null;
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
  photo_hash?: string | null;
  last_modified?: string | null;
  processing_status?: string | null;
  created_at?: string | null;
};

interface KPIs {
  totalTonnage: number;
  totalRevenue: number;
  avgPricePerTon: number;
  totalLogs: number;
  monthlyGrowth: number;
}

interface ChartData {
  date: string;
  tonnage: number;
  revenue: number;
  month?: string;
}

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
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [notification, setNotification] = useState<{show: boolean; message: string; type: 'success' | 'error' | 'info'}>({
    show: false, message: '', type: 'info'
  });
  interface PhotoModalState {
    open: boolean;
    url: string;
    title: string;
    bucket: string | null;
    storagePath: string | null;
    rawUrl: string | null;
    isLoading: boolean;
  }

  const [photoModal, setPhotoModal] = useState<PhotoModalState>({
    open: false,
    url: '',
    title: '',
    bucket: null,
    storagePath: null,
    rawUrl: null,
    isLoading: false
  });
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseStorageReference = useCallback((value: string) => {
    const storageProtocolMatch = value.match(/^storage:\/\/([^/]+)\/(.+)$/i);
    if (storageProtocolMatch) {
      return {
        bucket: storageProtocolMatch[1],
        path: storageProtocolMatch[2]
      };
    }

    const trimmed = value.replace(/^\/+/, '');
    if (!trimmed) {
      return {
        bucket: PRODUCTION_PHOTO_BUCKET,
        path: ''
      };
    }

    if (trimmed.startsWith(`${PRODUCTION_PHOTO_BUCKET}/`)) {
      return {
        bucket: PRODUCTION_PHOTO_BUCKET,
        path: trimmed.slice(PRODUCTION_PHOTO_BUCKET.length + 1)
      };
    }

    return {
      bucket: PRODUCTION_PHOTO_BUCKET,
      path: trimmed
    };
  }, []);

  const resolveProductionPhoto = useCallback((rawReference: string | null | undefined) => {
    if (!rawReference) {
      return {
        publicUrl: null as string | null,
        bucket: null as string | null,
        storagePath: null as string | null,
        rawUrl: null as string | null
      };
    }

    if (isAbsoluteUrl(rawReference)) {
      return {
        publicUrl: rawReference,
        bucket: null,
        storagePath: null,
        rawUrl: rawReference
      };
    }

    const { bucket, path } = parseStorageReference(rawReference);

    if (!path) {
      return {
        publicUrl: null,
        bucket,
        storagePath: null,
        rawUrl: rawReference
      };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      publicUrl: data?.publicUrl ?? null,
      bucket,
      storagePath: path,
      rawUrl: rawReference
    };
  }, [parseStorageReference]);

  const normalizeProductionLogs = useCallback((logs: SupabaseProductionLog[]): ProductionLog[] => {
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

      const photo = resolveProductionPhoto(log.file_url ?? null);
      const resolvedUrl = photo.publicUrl ?? null;

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
        file_url: resolvedUrl,
        raw_file_reference: typeof log.file_url === 'string' ? log.file_url : null,
        photo_storage_path: photo.storagePath,
        photo_bucket: photo.bucket,
        photo_hash: log.photo_hash ?? null,
        last_modified: log.last_modified ?? '',
        processing_status: log.processing_status ?? 'Pending',
        created_at: log.created_at ?? ''
      };
    });
  }, [resolveProductionPhoto, selectedMonth, selectedYear]);

  const requestSignedUrl = useCallback(async (bucket: string, path: string) => {
    const sanitizedPath = path.replace(/^\/+/, '');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(sanitizedPath, 120);
    if (error) {
      throw error;
    }
    return data?.signedUrl ?? null;
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ show: true, message, type });
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Load data from Supabase
  const loadProductionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('wastex_production_logs')
        .select('*')
        .order('log_date', { ascending: false })
        .limit(200);

      if (fetchError) {
        throw fetchError;
      }

      const normalized = normalizeProductionLogs((data ?? []) as SupabaseProductionLog[]);

      if (normalized.length > 0) {
        setProductionLogs(normalized);
      } else {
        setProductionLogs([]);
        showNotification('No production logs found. Try selecting a different range.', 'info');
      }
    } catch (err) {
      console.error('🚨 Error loading production data from Supabase:', err);
      const message = err instanceof Error ? err.message : 'Failed to load production data. Using demo data.';
      setError(message);

      const fallbackLogs: SupabaseProductionLog[] = [
        {
          id: '1',
          year: 2025,
          month: 9,
          log_date: '2025-09-26',
          tonnage: 80.0,
          price_per_ton: 20.0,
          total_amount: 1600.0,
          client_name: 'Panzarella',
          project_deliverable: 'MRF',
          approval_name: 'Michael Cruz',
          file_name: '09.26.2025 - 80 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example1',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:42:00Z'
        },
        {
          id: '2',
          year: 2025,
          month: 9,
          log_date: '2025-09-25',
          tonnage: 75.0,
          price_per_ton: 20.0,
          total_amount: 1500.0,
          client_name: 'Metro Waste',
          project_deliverable: 'Collection',
          approval_name: 'Sarah Johnson',
          file_name: '09.25.2025 - 75 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example2',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:34:00Z'
        },
        {
          id: '3',
          year: 2025,
          month: 9,
          log_date: '2025-09-24',
          tonnage: 176.0,
          price_per_ton: 20.0,
          total_amount: 3520.0,
          client_name: 'City Municipal',
          project_deliverable: 'Bulk Collection',
          approval_name: 'Mike Davis',
          file_name: '09.24.2025 - 176 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example3',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:34:00Z'
        },
        {
          id: '4',
          year: 2025,
          month: 9,
          log_date: '2025-09-23',
          tonnage: 111.0,
          price_per_ton: 20.0,
          total_amount: 2220.0,
          client_name: 'Industrial Services',
          project_deliverable: 'Commercial',
          approval_name: 'Lisa Brown',
          file_name: '09.23.2025 - 111 Tons.jpg',
          folder_path: 'Wastex - Production Log/2025/09.2025',
          file_url: 'https://drive.google.com/file/d/example4',
          processing_status: 'Processed',
          created_at: '2025-09-27T07:35:00Z'
        }
      ];

      setProductionLogs(normalizeProductionLogs(fallbackLogs));
      showNotification('Using demo data - check Supabase connection', 'error');
    } finally {
      setLoading(false);
    }
  }, [normalizeProductionLogs, showNotification]);

  useEffect(() => {
    void loadProductionData();
  }, [loadProductionData]);

  // Utility functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTonnage = (tonnage: number): string => {
    return `${tonnage.toFixed(1)} tons`;
  };

  const closePhotoModal = () => {
    setPhotoModal({
      open: false,
      url: '',
      title: '',
      bucket: null,
      storagePath: null,
      rawUrl: null,
      isLoading: false
    });
    setPhotoLoadFailed(false);
  };

  const handleOpenPhoto = async (log: ProductionLog) => {
    const hasPhotoReference = Boolean(log.file_url || log.photo_storage_path || log.raw_file_reference);
    if (!hasPhotoReference) {
      showNotification('No production photo is available for this entry yet.', 'info');
      return;
    }

    setPhotoLoadFailed(false);

    const shouldFetchSignedUrl = !log.file_url && Boolean(log.photo_storage_path && log.photo_bucket);

    setPhotoModal({
      open: true,
      url: log.file_url ?? '',
      title: log.file_name || formatDate(log.log_date),
      bucket: log.photo_bucket,
      storagePath: log.photo_storage_path,
      rawUrl: log.raw_file_reference,
      isLoading: shouldFetchSignedUrl
    });

    if (shouldFetchSignedUrl && log.photo_bucket && log.photo_storage_path) {
      try {
        const signedUrl = await requestSignedUrl(log.photo_bucket, log.photo_storage_path);
        if (signedUrl) {
          setPhotoModal((prev) => (
            prev.open
              ? {
                  ...prev,
                  url: signedUrl,
                  isLoading: false
                }
              : prev
          ));
        } else {
          setPhotoModal((prev) => (prev.open ? { ...prev, isLoading: false } : prev));
          setPhotoLoadFailed(true);
        }
      } catch (error) {
        console.error('Failed to create signed production photo URL', error);
        setPhotoModal((prev) => (prev.open ? { ...prev, isLoading: false } : prev));
        setPhotoLoadFailed(true);
        showNotification('Unable to open the production photo right now. Please try again later.', 'error');
      }
    }
  };

  useEffect(() => {
    if (!photoLoadFailed || !photoModal.storagePath || !photoModal.bucket) {
      return;
    }

    let isCancelled = false;

    const refreshSignedUrl = async () => {
      try {
        setPhotoModal((prev) => (prev.open ? { ...prev, isLoading: true } : prev));
        const signedUrl = await requestSignedUrl(photoModal.bucket!, photoModal.storagePath!);
        if (!isCancelled && signedUrl) {
          setPhotoLoadFailed(false);
          setPhotoModal((prev) => (prev.open ? { ...prev, url: signedUrl, isLoading: false } : prev));
        } else if (!isCancelled) {
          setPhotoModal((prev) => (prev.open ? { ...prev, isLoading: false } : prev));
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to refresh production photo link', error);
          setPhotoModal((prev) => (prev.open ? { ...prev, isLoading: false } : prev));
          showNotification('Unable to refresh the production photo link. Try again shortly.', 'error');
        }
      }
    };

    void refreshSignedUrl();

    return () => {
      isCancelled = true;
    };
  }, [photoLoadFailed, photoModal.bucket, photoModal.storagePath, requestSignedUrl, showNotification]);

  // Filter data based on selected period
  const getFilteredData = (): ProductionLog[] => {
    return productionLogs.filter(log => {
      if (viewMode === 'monthly') {
        return log.year === selectedYear && log.month === selectedMonth;
      }
      return log.year === selectedYear;
    });
  };

  // Calculate KPIs
  const calculateKPIs = (): KPIs => {
    const filteredData = getFilteredData();
    const totalTonnage = filteredData.reduce((sum, log) => sum + log.tonnage, 0);
    const totalRevenue = filteredData.reduce((sum, log) => sum + log.total_amount, 0);
    const avgPricePerTon = totalTonnage > 0 ? totalRevenue / totalTonnage : 0;
    const totalLogs = filteredData.length;

    // Calculate growth (simplified)
    const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const previousYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const previousData = productionLogs.filter(log => 
      log.year === previousYear && log.month === previousMonth
    );
    const previousRevenue = previousData.reduce((sum, log) => sum + log.total_amount, 0);
    const monthlyGrowth = previousRevenue > 0 ? 
      ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      totalTonnage,
      totalRevenue,
      avgPricePerTon,
      totalLogs,
      monthlyGrowth
    };
  };

  // Generate chart data
  const generateChartData = (): ChartData[] => {
    const filteredData = getFilteredData();
    
    if (viewMode === 'daily') {
      return filteredData.map(log => ({
        date: formatDate(log.log_date),
        tonnage: log.tonnage,
        revenue: log.total_amount
      })).reverse();
    } else {
      // Monthly aggregation
      const monthlyData: { [key: string]: { tonnage: number; revenue: number } } = {};
      
      productionLogs.forEach(log => {
        const key = `${log.year}-${log.month.toString().padStart(2, '0')}`;
        if (!monthlyData[key]) {
          monthlyData[key] = { tonnage: 0, revenue: 0 };
        }
        monthlyData[key].tonnage += log.tonnage;
        monthlyData[key].revenue += log.total_amount;
      });

      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // Last 12 months
        .map(([key, data]) => ({
          date: key,
          month: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          tonnage: data.tonnage,
          revenue: data.revenue
        }));
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
          
          <div className="flex space-x-4 items-center">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'monthly' | 'daily')}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly View</option>
              <option value="daily">Daily View</option>
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 3 }, (_, i) => {
                const year = new Date().getFullYear() - 1 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>

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
                <p className="text-2xl font-bold text-gray-900">{formatTonnage(kpis.totalTonnage)}</p>
                <p className="text-xs text-green-600 mt-1">+5.2% vs last month</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: BRAND_COLORS.success }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.totalRevenue)}</p>
                <p className={`text-xs mt-1 ${kpis.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.monthlyGrowth >= 0 ? '+' : ''}{kpis.monthlyGrowth.toFixed(1)}% vs last month
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
                  {kpis.totalLogs > 0 ? formatTonnage(kpis.totalTonnage / kpis.totalLogs) : '0 tons'}
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
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {viewMode === 'daily' ? 'Daily' : 'Monthly'} Production Trend
              </h3>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={viewMode === 'daily' ? 'date' : 'month'} />
                  <YAxis yAxisId="tonnage" orientation="left" />
                  <YAxis yAxisId="revenue" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'tonnage' ? `${Number(value).toFixed(1)} tons` : formatCurrency(Number(value)),
                      name === 'tonnage' ? 'Tonnage' : 'Revenue'
                    ]}
                  />
                  <Legend />
                  <Line 
                    yAxisId="tonnage"
                    type="monotone" 
                    dataKey="tonnage" 
                    stroke={BRAND_COLORS.primary}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    name="Tonnage"
                  />
                  <Line 
                    yAxisId="revenue"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke={BRAND_COLORS.success}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    name="Revenue"
                  />
                </LineChart>
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
                  <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']} />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredData().map((log) => {
                  const hasPhotoReference = Boolean(log.file_url || log.photo_storage_path || log.raw_file_reference);
                  const photoTitle = log.file_name || formatDate(log.log_date);

                  return (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.approval_name || 'Pending'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        {log.processing_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => void handleOpenPhoto(log)}
                          className="text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            color: hasPhotoReference ? BRAND_COLORS.primary : BRAND_COLORS.gray[400]
                          }}
                          disabled={!hasPhotoReference}
                        >
                          View Photo
                        </button>
                        {hasPhotoReference ? (
                          <button
                            type="button"
                            onClick={() => void handleOpenPhoto(log)}
                            className="group relative h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            {log.file_url ? (
                              <img
                                src={log.file_url}
                                alt={`Production photo preview for ${photoTitle}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gray-100">
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            <span className="sr-only">Open production photo for {photoTitle}</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <ImageIcon className="h-4 w-4" />
                            No Photo
                          </span>
                        )}
                        <button
                          onClick={() => showNotification(`Viewing details for ${log.file_name}`, 'info')}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
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

      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-4 rounded-lg text-white font-medium shadow-lg transition-transform ${
          notification.type === 'success' ? 'bg-green-500' :
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {notification.message}
        </div>
      )}

      {photoModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={closePhotoModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Production Photo</h3>
                {photoModal.title && (
                  <p className="text-sm text-gray-500 mt-1 truncate max-w-[18rem] sm:max-w-none">
                    {photoModal.title}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closePhotoModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {photoModal.url && !photoLoadFailed ? (
                <div className="relative w-full max-h-[70vh] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={photoModal.url}
                    alt={photoModal.title || 'Production photo preview'}
                    className="w-full h-full object-contain bg-gray-100"
                    onError={() => setPhotoLoadFailed(true)}
                  />
                </div>
              ) : photoModal.isLoading ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center text-gray-500">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  <div>
                    <p className="font-medium">Loading production photo…</p>
                    {photoModal.storagePath && (
                      <p className="text-sm text-gray-400">Requesting a secure Supabase link for {photoModal.storagePath}.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 py-16 space-y-4">
                  <ImageIcon className="w-10 h-10 text-gray-400" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {photoLoadFailed ? "We couldn't load this photo." : 'No preview is available for this photo.'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {photoModal.storagePath
                        ? 'The file may require a refreshed signed link. Try opening the original file below.'
                        : 'The file may have been moved or is no longer available.'}
                    </p>
                    {photoModal.storagePath && (
                      <code className="block rounded bg-gray-100 px-3 py-1 text-xs text-gray-500">
                        {photoModal.storagePath}
                      </code>
                    )}
                  </div>
                  {(photoModal.url || photoModal.rawUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        const link = photoModal.url || photoModal.rawUrl;
                        if (link) {
                          window.open(link, '_blank');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm"
                      style={{ backgroundColor: BRAND_COLORS.primary }}
                    >
                      Open Original File
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteXDashboard;
