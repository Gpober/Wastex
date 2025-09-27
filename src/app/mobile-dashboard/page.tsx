"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import {
  Menu,
  X,
  ChevronLeft,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle,
  Target,
  Mic,
  Bot,
  MessageCircle,
  Factory,
  PlusCircle,
  Camera,
  Image as ImageIcon,
  RefreshCcw,
  Loader2,
  Calendar,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

// I AM CFO Brand Colors
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
    200: '#E2E8F0'
  }
};

interface PropertySummary {
  name: string;
  revenue?: number;
  cogs?: number;
  expenses?: number;
  netIncome?: number;
  operating?: number;
  financing?: number;
  investing?: number;
  current?: number;
  days30?: number;
  days60?: number;
  days90?: number;
  over90?: number;
  total?: number;
}

interface Category {
  name: string;
  total: number;
}

interface Transaction {
  date: string;
  amount: number;
  running: number;
  payee?: string | null;
  memo?: string | null;
  customer?: string | null;
  entryNumber?: string;
  invoiceNumber?: string | null;
}

interface ARTransaction {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  daysOutstanding: number;
  customer: string;
  memo?: string | null;
}

interface APTransaction {
  billNumber: string;
  billDate: string;
  dueDate: string;
  amount: number;
  daysOutstanding: number;
  vendor: string;
  memo?: string | null;
}

interface JournalRow {
  account: string;
  account_type: string | null;
  debit: number | null;
  credit: number | null;
  customer: string | null;
  report_category?: string | null;
  normal_balance?: number | null;
  date: string;
  memo?: string | null;
  vendor?: string | null;
  name?: string | null;
  entry_number?: string;
  number?: string | null;
  entry_bank_account?: string | null;
  is_cash_account?: boolean;
}

interface JournalEntryLine {
  date: string;
  account: string;
  memo: string | null;
  customer: string | null;
  debit: number | null;
  credit: number | null;
}

const getMonthName = (m: number) =>
  new Date(0, m - 1).toLocaleString("en-US", { month: "long" });

const calculateDaysOutstanding = (dueDate: string) => {
  const due = new Date(dueDate);
  const today = new Date();
  const diff = today.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const getAgingBucket = (days: number): string => {
  if (days <= 30) return "current";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  return "120+";
};

const getAgingColor = (days: number) => {
  if (days <= 30) return BRAND_COLORS.success;
  if (days <= 60) return BRAND_COLORS.warning;
  if (days <= 90) return "#f59e0b";
  return BRAND_COLORS.danger;
};

type Insight = {
  title: string;
  message: string;
  icon: LucideIcon;
  type: "success" | "warning" | "info";
};

type RankingMetric =
  | "revenue"
  | "margin"
  | "netIncome"
  | "growth"
  | "operating"
  | "netCash"
  | "investing"
  | "stability"
  | "cogs"
  | "arTotal"
  | "arCurrent"
  | "arOverdue"
  | "apTotal"
  | "apCurrent"
  | "apOverdue"
  | "payrollDept"
  | "payrollEmployee";

const insights: Insight[] = [
  {
    title: "Revenue trending up",
    message: "Revenue increased compared to last period.",
    icon: TrendingUp,
    type: "success",
  },
  {
    title: "Expense spike detected",
    message: "Expenses rose faster than revenue this period.",
    icon: AlertTriangle,
    type: "warning",
  },
  {
    title: "Stable cash position",
    message: "Cash flow remains steady.",
    icon: CheckCircle,
    type: "info",
  },
];

interface ProductionPhoto {
  base64: string;
  hash: string;
  fileName: string;
  mimeType: string;
}

interface ProductionEntry {
  id: string;
  log_date: string;
  tonnage: number;
  price_per_ton: number;
  total_amount: number;
  client_name: string;
  project_deliverable?: string | null;
  approval_name?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  photo_hash?: string | null;
  processing_status?: string | null;
  created_at?: string;
  synced?: boolean;
  photo?: ProductionPhoto | null;
}

const PRODUCTION_STORAGE_KEY = "wastex-production-entries";
const PRODUCTION_OFFLINE_KEY = "wastex-production-offline";
const PRODUCTION_CLIENTS = [
  "Panzarella Waste",
  "City of Fort Lauderdale",
  "Broward County",
  "Custom",
];

const getStartOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const result = new Date(date);
  result.setDate(date.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getEndOfWeek = (date: Date) => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const formatTonnage = (value: number) =>
  `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })} tons`;

const getFileExtension = (fileName: string) => {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop() || "jpg" : "jpg";
};

const createFileNameFromHash = (hash: string, originalName: string) => {
  const ext = getFileExtension(originalName).toLowerCase();
  return `${hash.slice(0, 8)}-${Date.now()}.${ext}`;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(blob);
  });

const base64ToBlob = (base64: string, mimeType: string) => {
  const cleaned = base64.includes(",") ? base64.split(",").pop() || base64 : base64;
  if (typeof window === "undefined") {
    const buffer = Buffer.from(cleaned, "base64");
    return new Blob([buffer], { type: mimeType });
  }
  const byteCharacters = atob(cleaned);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

const compressImageFile = async (file: File, maxWidth = 1280, quality = 0.7) => {
  if (typeof window === "undefined") return file;
  if (file.type === "image/gif") return file;
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else resolve(file);
        },
        file.type === "image/png" ? "image/png" : "image/jpeg",
        quality,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to compress image"));
    };
    image.src = url;
  });
};

const hashBase64 = async (base64: string) => {
  const cleaned = base64.includes(",") ? base64.split(",").pop() || base64 : base64;
  let buffer: ArrayBuffer;
  if (typeof window === "undefined") {
    const nodeBuffer = Buffer.from(cleaned, "base64");
    buffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength,
    );
  } else {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    buffer = bytes.buffer;
  }
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export default function EnhancedMobileDashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportType, setReportType] = useState<
    "pl" | "cf" | "ar" | "ap" | "payroll"
  >("pl");
  const [reportPeriod, setReportPeriod] = useState<
    "Monthly" | "Custom" | "Year to Date" | "Trailing 12" | "Quarterly"
  >("Monthly");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [view, setView] = useState<"overview" | "summary" | "report" | "detail">("overview");
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [plData, setPlData] = useState<{ revenue: Category[]; cogs: Category[]; expenses: Category[] }>({
    revenue: [],
    cogs: [],
    expenses: [],
  });
  const [cfData, setCfData] = useState<{
    operating: Category[];
    financing: Category[];
    investing: Category[];
  }>({
    operating: [],
    financing: [],
    investing: [],
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [arTransactions, setArTransactions] = useState<ARTransaction[]>([]);
  const [apTransactions, setApTransactions] = useState<APTransaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [rankingMetric, setRankingMetric] = useState<RankingMetric | null>(null);
  const [journalEntryLines, setJournalEntryLines] = useState<JournalEntryLine[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalTitle, setJournalTitle] = useState("");
  const [payrollTotals, setPayrollTotals] = useState<number>(0);
  const [employeeBreakdown, setEmployeeBreakdown] = useState<Record<string, { total: number; payments: Transaction[] }>>({});
  const [employeeTotals, setEmployeeTotals] = useState<Category[]>([]);

  // AI CFO States
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Production logging states
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [productionForm, setProductionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tonnage: '',
    client: PRODUCTION_CLIENTS[0],
    customClient: '',
    pricePerTon: '20',
    projectNotes: '',
  });
  const [productionPhoto, setProductionPhoto] = useState<ProductionPhoto | null>(null);
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});
  const [productionDuplicateMessage, setProductionDuplicateMessage] = useState<string | null>(null);
  const [productionSubmitting, setProductionSubmitting] = useState(false);
  const [productionPhotoLoading, setProductionPhotoLoading] = useState(false);
  const [isSyncingProduction, setIsSyncingProduction] = useState(false);
  const [offlineProductionQueue, setOfflineProductionQueue] = useState<ProductionEntry[]>([]);
  const [showAllProduction, setShowAllProduction] = useState(false);

  const buttonRef = useRef<HTMLDivElement>(null);
  const productionPhotoInputRef = useRef<HTMLInputElement>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(finalTranscript + interimTranscript);
        
        if (finalTranscript) {
          processAIQuery(finalTranscript);
          recognitionInstance.stop();
        }
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsProcessing(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  const processAIQuery = async (query: string) => {
    if (!query.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/ai-chat-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          context: {
            platform: 'I AM CFO',
            userType: 'property_manager',
            requestType: 'voice_query',
            currentData: {
              reportType,
              properties,
              selectedProperty,
              companyTotals
            }
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const data = await response.json();
      setResponse(data.response);
      
      // Speak the response if speech synthesis is available
      if ('speechSynthesis' in window && data.response) {
        const utterance = new SpeechSynthesisUtterance(data.response);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      }
      
    } catch (error) {
      console.error('Error processing AI query:', error);
      setResponse('Sorry, I encountered an error processing your request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = async () => {
    if (!recognition || isListening) return;

    try {
      // Request microphone permission on user interaction for mobile browsers
      if (navigator?.mediaDevices) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setIsListening(true);
      setTranscript('');
      setResponse('');
      setIsProcessing(false);
      recognition.start();
    } catch (err) {
      console.error('Microphone access denied:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (!recognition || !isListening) return;

    recognition.stop();
    setIsListening(false);
  };

  const closeModal = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
    setShowModal(false);
    setIsListening(false);
    setIsProcessing(false);
    setTranscript('');
    setResponse('');
  };

  const openAIModal = () => {
    setShowModal(true);
    setIsListening(false);
    setIsProcessing(false);
    setTranscript('');
    setResponse('');
  };

  const persistProductionState = useCallback(
    (entries: ProductionEntry[], offline: ProductionEntry[]) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(entries));
        localStorage.setItem(PRODUCTION_OFFLINE_KEY, JSON.stringify(offline));
      } catch (error) {
        console.error('Failed to persist production data', error);
      }
    },
    [],
  );

  const mergeProductionEntries = useCallback(
    (remote: ProductionEntry[], offline: ProductionEntry[]) => {
      const keyFor = (entry: ProductionEntry) =>
        entry.id || `${entry.log_date}-${entry.client_name}-${entry.total_amount}-${entry.photo_hash || ''}`;
      const map = new Map<string, ProductionEntry>();
      remote.forEach((entry) => {
        map.set(keyFor(entry), { ...entry, synced: true, photo: null });
      });
      offline.forEach((entry) => {
        map.set(keyFor(entry), { ...entry, synced: entry.synced ?? false });
      });
      return Array.from(map.values());
    },
    [],
  );

  const uploadProductionEntry = useCallback(
    async (entry: ProductionEntry) => {
      let duplicate = false;
      const payload: any = {
        log_date: entry.log_date,
        tonnage: entry.tonnage,
        price_per_ton: entry.price_per_ton,
        total_amount: entry.total_amount,
        client_name: entry.client_name,
        project_deliverable: entry.project_deliverable || null,
        approval_name: entry.approval_name || null,
        file_name: entry.file_name || null,
        file_url: entry.file_url || null,
        photo_hash: entry.photo_hash || entry.photo?.hash || null,
        processing_status: 'Mobile Entry',
      };

      if (entry.photo && entry.photo.base64) {
        const hash = entry.photo.hash || (await hashBase64(entry.photo.base64));
        payload.photo_hash = hash;
        let fileUrl = entry.file_url || null;
        let fileName = entry.file_name || null;

        const { data: duplicateData, error: duplicateError } = await supabase
          .from('wastex_production_logs')
          .select('file_url, file_name')
          .eq('photo_hash', hash)
          .limit(1);

        if (!duplicateError && duplicateData && duplicateData.length > 0) {
          duplicate = true;
          fileUrl = duplicateData[0].file_url;
          fileName = duplicateData[0].file_name;
        } else {
          const filePath = createFileNameFromHash(hash, entry.photo.fileName);
          const fileBlob = base64ToBlob(entry.photo.base64, entry.photo.mimeType);
          const uploadResult = await supabase.storage
            .from('production-photos')
            .upload(filePath, fileBlob, {
              contentType: entry.photo.mimeType,
              upsert: false,
            });

          if (uploadResult.error) {
            throw uploadResult.error;
          }

          const publicUrl = supabase.storage
            .from('production-photos')
            .getPublicUrl(filePath);
          fileUrl = publicUrl.data.publicUrl;
          fileName = filePath;
        }

        payload.file_url = fileUrl;
        payload.file_name = fileName;
      }

      const { data, error } = await supabase
        .from('wastex_production_logs')
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const savedEntry: ProductionEntry = {
        id: data?.id?.toString?.() || entry.id,
        log_date: data?.log_date || entry.log_date,
        tonnage: Number(data?.tonnage ?? entry.tonnage) || 0,
        price_per_ton: Number(data?.price_per_ton ?? entry.price_per_ton) || 0,
        total_amount: Number(data?.total_amount ?? entry.total_amount) || 0,
        client_name: data?.client_name || entry.client_name,
        project_deliverable: data?.project_deliverable || entry.project_deliverable || null,
        approval_name: data?.approval_name || entry.approval_name || null,
        file_name: data?.file_name || payload.file_name || null,
        file_url: data?.file_url || payload.file_url || null,
        photo_hash: data?.photo_hash || payload.photo_hash || null,
        processing_status: data?.processing_status || 'Mobile Entry',
        created_at: data?.created_at || data?.inserted_at || new Date().toISOString(),
        synced: true,
        photo: null,
      };

      return { savedEntry, duplicate };
    },
    [],
  );

  const loadProductionEntries = useCallback(async () => {
    if (typeof window === 'undefined') return;

    let cachedEntries: ProductionEntry[] = [];
    let offlineEntries: ProductionEntry[] = [];

    try {
      const stored = localStorage.getItem(PRODUCTION_STORAGE_KEY);
      cachedEntries = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse cached production entries', error);
    }

    try {
      const storedOffline = localStorage.getItem(PRODUCTION_OFFLINE_KEY);
      offlineEntries = storedOffline ? JSON.parse(storedOffline) : [];
    } catch (error) {
      console.error('Failed to parse offline production queue', error);
    }

    setOfflineProductionQueue(offlineEntries);

    if (cachedEntries.length || offlineEntries.length) {
      setProductionEntries(mergeProductionEntries(cachedEntries, offlineEntries));
    }

    try {
      const { data, error } = await supabase
        .from('wastex_production_logs')
        .select('*')
        .order('log_date', { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      const remoteEntries: ProductionEntry[] = ((data as any[]) || []).map((record) => ({
        id: record.id?.toString?.() || `${record.log_date}-${record.client_name}-${record.total_amount}`,
        log_date: record.log_date,
        tonnage: Number(record.tonnage) || 0,
        price_per_ton: Number(record.price_per_ton) || 0,
        total_amount: Number(record.total_amount) || 0,
        client_name: record.client_name || 'Unknown Client',
        project_deliverable: record.project_deliverable || null,
        approval_name: record.approval_name || null,
        file_name: record.file_name || null,
        file_url: record.file_url || null,
        photo_hash: record.photo_hash || null,
        processing_status: record.processing_status || 'Mobile Entry',
        created_at: record.created_at || record.inserted_at || record.createdAt || `${record.log_date}T00:00:00`,
        synced: true,
        photo: null,
      }));

      const combined = mergeProductionEntries(remoteEntries, offlineEntries);
      setProductionEntries(combined);
      persistProductionState(combined, offlineEntries);
    } catch (error) {
      console.error('Error loading production entries from Supabase', error);
    }
  }, [mergeProductionEntries, persistProductionState]);

  const syncProductionEntries = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    if (!offlineProductionQueue.length) return;

    setIsSyncingProduction(true);
    const remaining: ProductionEntry[] = [];
    const synced: ProductionEntry[] = [];

    for (const entry of offlineProductionQueue) {
      try {
        const { savedEntry } = await uploadProductionEntry(entry);
        synced.push(savedEntry);
      } catch (error) {
        console.error('Failed to sync production entry', error);
        remaining.push(entry);
      }
    }

    const combined = mergeProductionEntries(
      [
        ...productionEntries.filter((entry) => entry.synced),
        ...synced,
      ],
      remaining,
    );

    setOfflineProductionQueue(remaining);
    setProductionEntries(combined);
    persistProductionState(combined, remaining);
    setIsSyncingProduction(false);
  }, [mergeProductionEntries, offlineProductionQueue, persistProductionState, productionEntries, uploadProductionEntry]);

  useEffect(() => {
    loadProductionEntries();
  }, [loadProductionEntries]);

  useEffect(() => {
    const handleOnline = () => {
      syncProductionEntries();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [syncProductionEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;
    syncProductionEntries();
  }, [syncProductionEntries, offlineProductionQueue.length]);

  const resetProductionForm = () => {
    setProductionForm({
      date: new Date().toISOString().split('T')[0],
      tonnage: '',
      client: PRODUCTION_CLIENTS[0],
      customClient: '',
      pricePerTon: '20',
      projectNotes: '',
    });
    setProductionPhoto(null);
    setProductionErrors({});
  };

  const handleProductionFieldChange = (field: string, value: string) => {
    setProductionForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setProductionErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleProductionPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProductionPhotoLoading(true);
    setProductionDuplicateMessage(null);
    try {
      const compressed = await compressImageFile(file);
      const base64 = await blobToBase64(compressed);
      const hash = await hashBase64(base64);
      setProductionPhoto({
        base64,
        hash,
        fileName: file.name,
        mimeType: compressed.type || file.type || 'image/jpeg',
      });
    } catch (error) {
      console.error('Failed to process production photo', error);
    } finally {
      setProductionPhotoLoading(false);
    }
  };

  const removeProductionPhoto = () => {
    setProductionPhoto(null);
  };

  const triggerProductionPhotoPicker = () => {
    productionPhotoInputRef.current?.click();
  };

  const validateProductionForm = () => {
    const errors: Record<string, string> = {};
    if (!productionForm.date) {
      errors.date = 'Date is required';
    }

    const tonnage = parseFloat(productionForm.tonnage);
    if (Number.isNaN(tonnage) || tonnage <= 0) {
      errors.tonnage = 'Tonnage must be greater than 0';
    }

    const rate = parseFloat(productionForm.pricePerTon);
    if (Number.isNaN(rate) || rate <= 0) {
      errors.pricePerTon = 'Price per ton must be positive';
    }

    let clientName = productionForm.client;
    if (clientName === 'Custom') {
      clientName = productionForm.customClient.trim();
    }

    if (!clientName) {
      errors.client = 'Client is required';
    }

    return {
      errors,
      tonnage,
      rate,
      clientName,
    };
  };

  const handleProductionSubmit = async () => {
    setProductionDuplicateMessage(null);
    const { errors, tonnage, rate, clientName } = validateProductionForm();
    if (Object.keys(errors).length) {
      setProductionErrors(errors);
      return;
    }

    setProductionSubmitting(true);

    const baseEntry: ProductionEntry = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `local-${Date.now()}`,
      log_date: productionForm.date,
      tonnage,
      price_per_ton: rate,
      total_amount: Number((tonnage * rate).toFixed(2)),
      client_name: clientName,
      project_deliverable: productionForm.projectNotes || null,
      approval_name: null,
      file_name: productionPhoto?.fileName || null,
      file_url: null,
      photo_hash: productionPhoto?.hash || null,
      processing_status: 'Mobile Entry',
      created_at: new Date().toISOString(),
      synced: false,
      photo: productionPhoto,
    };

    try {
      if (typeof window !== 'undefined' && navigator.onLine) {
        const { savedEntry, duplicate } = await uploadProductionEntry(baseEntry);
        const remoteEntries = [
          savedEntry,
          ...productionEntries.filter((entry) => entry.synced && entry.id !== savedEntry.id),
        ];
        const combined = mergeProductionEntries(remoteEntries, offlineProductionQueue);
        setProductionEntries(combined);
        persistProductionState(combined, offlineProductionQueue);
        if (duplicate) {
          setProductionDuplicateMessage('Duplicate photo detected. Reused previous upload.');
        }
      } else {
        const offlineQueue = [...offlineProductionQueue, baseEntry];
        setOfflineProductionQueue(offlineQueue);
        const combined = mergeProductionEntries(productionEntries, offlineQueue);
        setProductionEntries(combined);
        persistProductionState(combined, offlineQueue);
      }

      resetProductionForm();
      setProductionModalOpen(false);
    } catch (error) {
      console.error('Failed to log production entry', error);
      const offlineQueue = [...offlineProductionQueue, baseEntry];
      setOfflineProductionQueue(offlineQueue);
      const combined = mergeProductionEntries(productionEntries, offlineQueue);
      setProductionEntries(combined);
      persistProductionState(combined, offlineQueue);
    } finally {
      setProductionSubmitting(false);
    }
  };

  const openProductionPhoto = (entry: ProductionEntry) => {
    if (typeof window === 'undefined') return;
    const source = entry.file_url || entry.photo?.base64;
    if (!source) return;
    const viewer = window.open('', '_blank');
    if (viewer) {
      viewer.document.title = `Production - ${entry.client_name}`;
      viewer.document.body.style.margin = '0';
      viewer.document.body.style.background = '#000';
      const image = viewer.document.createElement('img');
      image.src = source;
      image.style.width = '100%';
      image.style.height = 'auto';
      image.style.display = 'block';
      viewer.document.body.appendChild(image);
    }
  };


  const transactionTotal = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const arTransactionTotal = useMemo(
    () => arTransactions.reduce((sum, t) => sum + t.amount, 0),
    [arTransactions],
  );

  const apTransactionTotal = useMemo(
    () => apTransactions.reduce((sum, t) => sum + t.amount, 0),
    [apTransactions],
  );

  const productionCalculatedTotal = useMemo(() => {
    const tonnage = parseFloat(productionForm.tonnage);
    const rate = parseFloat(productionForm.pricePerTon);
    if (Number.isNaN(tonnage) || Number.isNaN(rate)) return 0;
    return Number((tonnage * rate).toFixed(2));
  }, [productionForm.tonnage, productionForm.pricePerTon]);

  const sortedProductionEntries = useMemo(() => {
    const entries = [...productionEntries];
    return entries.sort((a, b) => {
      const aDate = new Date(a.created_at || `${a.log_date}T00:00:00`);
      const bDate = new Date(b.created_at || `${b.log_date}T00:00:00`);
      return bDate.getTime() - aDate.getTime();
    });
  }, [productionEntries]);

  const todaysProduction = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let tonnage = 0;
    let revenue = 0;
    sortedProductionEntries.forEach((entry) => {
      const entryDate = new Date(`${entry.log_date}T00:00:00`);
      if (entryDate.getTime() === today.getTime()) {
        tonnage += entry.tonnage || 0;
        revenue += entry.total_amount || 0;
      }
    });
    return { tonnage, revenue };
  }, [sortedProductionEntries]);

  const weeklyProduction = useMemo(() => {
    const now = new Date();
    const start = getStartOfWeek(now);
    const end = getEndOfWeek(now);
    let tonnage = 0;
    let revenue = 0;
    sortedProductionEntries.forEach((entry) => {
      const entryDate = new Date(`${entry.log_date}T00:00:00`);
      if (entryDate >= start && entryDate <= end) {
        tonnage += entry.tonnage || 0;
        revenue += entry.total_amount || 0;
      }
    });
    return { tonnage, revenue };
  }, [sortedProductionEntries]);

  const recentProductionEntries = useMemo(
    () => sortedProductionEntries.slice(0, 5),
    [sortedProductionEntries],
  );

  const displayedProductionEntries = useMemo(
    () => (showAllProduction ? sortedProductionEntries : recentProductionEntries),
    [recentProductionEntries, showAllProduction, sortedProductionEntries],
  );

  const plannedProductionTonnage = useMemo(() => {
    const tonnage = parseFloat(productionForm.tonnage);
    return Number.isNaN(tonnage) ? 0 : tonnage;
  }, [productionForm.tonnage]);

  const filteredARTransactions = useMemo(() => {
    return arTransactions.filter((t) => {
      const bucket = getAgingBucket(t.daysOutstanding);
      if (selectedCategory === "90+") {
        return bucket === "91-120" || bucket === "120+";
      }
      return bucket === selectedCategory;
    });
  }, [arTransactions, selectedCategory]);

  const filteredARTotal = useMemo(
    () => filteredARTransactions.reduce((sum, t) => sum + t.amount, 0),
    [filteredARTransactions],
  );

  const filteredAPTransactions = useMemo(() => {
    return apTransactions.filter((t) => {
      const bucket = getAgingBucket(t.daysOutstanding);
      if (selectedCategory === "90+") {
        return bucket === "91-120" || bucket === "120+";
      }
      return bucket === selectedCategory;
    });
  }, [apTransactions, selectedCategory]);

  const filteredAPTotal = useMemo(
    () => filteredAPTransactions.reduce((sum, t) => sum + t.amount, 0),
    [filteredAPTransactions],
  );

  const bucketLabels: Record<string, string> = {
    current: "Current (0-30 Days)",
    "31-60": "31-60 Days",
    "61-90": "61-90 Days",
    "90+": "90+ Days",
  };

  const plTotals = useMemo(() => {
    const revenue = plData.revenue.reduce((sum, c) => sum + c.total, 0);
    const cogs = plData.cogs.reduce((sum, c) => sum + c.total, 0);
    const expenses = plData.expenses.reduce((sum, c) => sum + c.total, 0);
    const grossProfit = revenue - cogs;
    const net = grossProfit - expenses;
    return { revenue, cogs, grossProfit, expenses, net };
  }, [plData]);

  const cfTotals = useMemo(() => {
    const operating = cfData.operating.reduce((sum, c) => sum + c.total, 0);
    const financing = cfData.financing.reduce((sum, c) => sum + c.total, 0);
    const investing = cfData.investing.reduce((sum, c) => sum + c.total, 0);
    return { 
      operating, 
      financing, 
      investing,
      net: operating + financing + investing
    };
  }, [cfData]);

  // Enhanced classification function to mirror cash flow component
  const classifyTransaction = (
    accountType: string | null,
    reportCategory: string | null,
  ) => {
    const typeLower = accountType?.toLowerCase() || "";
    
    if (reportCategory === "transfer") {
      return "transfer";
    }

    // Operating activities - Income and Expenses (mirroring cash flow logic)
    const isReceivable = typeLower.includes("accounts receivable") || typeLower.includes("a/r");
    const isPayable = typeLower.includes("accounts payable") || typeLower.includes("a/p");

    if (
      typeLower === "income" ||
      typeLower === "other income" ||
      typeLower === "expenses" ||
      typeLower === "expense" ||
      typeLower === "cost of goods sold" ||
      isReceivable ||
      isPayable
    ) {
      return "operating";
    }

    // Investing activities - Fixed Assets and Other Assets
    if (
      typeLower === "fixed assets" || 
      typeLower === "other assets" || 
      typeLower === "property, plant & equipment"
    ) {
      return "investing";
    }

    // Financing activities - Liabilities, Equity, Credit Cards
    if (
      typeLower === "long term liabilities" ||
      typeLower === "equity" ||
      typeLower === "credit card" ||
      typeLower === "other current liabilities" ||
      typeLower === "line of credit"
    ) {
      return "financing";
    }

    return "other";
  };

  const getDateRange = useCallback(() => {
    const makeUTCDate = (y: number, m: number, d: number) =>
      new Date(Date.UTC(y, m, d));
    const y = year;
    const m = month;
    if (reportPeriod === "Custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    if (reportPeriod === "Monthly") {
      const startDate = makeUTCDate(y, m - 1, 1);
      const endDate = makeUTCDate(y, m, 0);
      return {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      };
    }
    if (reportPeriod === "Quarterly") {
      const qStart = Math.floor((m - 1) / 3) * 3;
      const startDate = makeUTCDate(y, qStart, 1);
      const endDate = makeUTCDate(y, qStart + 3, 0);
      return {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      };
    }
    if (reportPeriod === "Year to Date") {
      const startDate = makeUTCDate(y, 0, 1);
      const endDate = makeUTCDate(y, m, 0);
      return {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      };
    }
    if (reportPeriod === "Trailing 12") {
      const endDate = makeUTCDate(y, m, 0);
      const startDate = makeUTCDate(y, m - 11, 1);
      return {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      };
    }
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }, [reportPeriod, month, year, customStart, customEnd]);

  useEffect(() => {
    const load = async () => {
      if (reportType === "ap") {
        const { data } = await supabase
          .from("ap_aging")
          .select("*")
          .gt("open_balance", 0);
        const map: Record<string, PropertySummary> = {};
        (data || []).forEach((rec: any) => {
          const vendor = rec.vendor || "General";
          if (!map[vendor]) {
            map[vendor] = {
              name: vendor,
              current: 0,
              days30: 0,
              days60: 0,
              days90: 0,
              over90: 0,
              total: 0,
            };
          }
          const amt = Number(rec.open_balance) || 0;
          const days = calculateDaysOutstanding(rec.due_date);
          const bucket = getAgingBucket(days);
          if (bucket === "current") map[vendor].current = (map[vendor].current || 0) + amt;
          else if (bucket === "31-60") map[vendor].days30 = (map[vendor].days30 || 0) + amt;
          else if (bucket === "61-90") map[vendor].days60 = (map[vendor].days60 || 0) + amt;
          else if (bucket === "91-120") map[vendor].days90 = (map[vendor].days90 || 0) + amt;
          else map[vendor].over90 = (map[vendor].over90 || 0) + amt;
          map[vendor].total = (map[vendor].total || 0) + amt;
        });
        setProperties(Object.values(map));
        return;
      }

      if (reportType === "ar") {
        const { data } = await supabase
          .from("ar_aging_detail")
          .select("*")
          .gt("open_balance", 0);
        const map: Record<string, PropertySummary> = {};
        (data || []).forEach((rec: any) => {
          const customer = rec.customer || "General";
          if (!map[customer]) {
            map[customer] = {
              name: customer,
              current: 0,
              days30: 0,
              days60: 0,
              days90: 0,
              over90: 0,
              total: 0,
            };
          }
          const amt = Number(rec.open_balance) || 0;
          const days = calculateDaysOutstanding(rec.due_date);
          const bucket = getAgingBucket(days);
          if (bucket === "current") map[customer].current = (map[customer].current || 0) + amt;
          else if (bucket === "31-60") map[customer].days30 = (map[customer].days30 || 0) + amt;
          else if (bucket === "61-90") map[customer].days60 = (map[customer].days60 || 0) + amt;
          else if (bucket === "91-120") map[customer].days90 = (map[customer].days90 || 0) + amt;
          else map[customer].over90 = (map[customer].over90 || 0) + amt;
          map[customer].total = (map[customer].total || 0) + amt;
        });
        setProperties(Object.values(map));
        return;
      }

      const { start, end } = getDateRange();

      if (reportType === "payroll") {
        const { data } = await supabase
          .from("payments")
          .select("department, total_amount, date, first_name, last_name")
          .gte("date", start)
          .lte("date", end);
        const deptMap: Record<string, PropertySummary> = {};
        const empMap: Record<string, Category> = {};
        (data || []).forEach((rec: any) => {
          const dept = rec.department || "Unknown";
          if (!deptMap[dept]) {
            deptMap[dept] = { name: dept, expenses: 0 };
          }
          deptMap[dept].expenses = (deptMap[dept].expenses || 0) + (Number(rec.total_amount) || 0);

          const emp = [rec.first_name, rec.last_name].filter(Boolean).join(" ") || "Unknown";
          if (!empMap[emp]) {
            empMap[emp] = { name: emp, total: 0 };
          }
          empMap[emp].total = (empMap[emp].total || 0) + (Number(rec.total_amount) || 0);
        });
        setProperties(Object.values(deptMap));
        setEmployeeTotals(Object.values(empMap).sort((a, b) => b.total - a.total));
        return;
      }

      const selectColumns = "account_type, report_category, normal_balance, debit, credit, customer, date, entry_bank_account, is_cash_account";

      let query = supabase
        .from("journal_entry_lines")
        .select(selectColumns)
        .gte("date", start)
        .lte("date", end);

      if (reportType === "cf") {
        query = query
          .not("entry_bank_account", "is", null)
          .eq("is_cash_account", false)
          .neq("report_category", "transfer");
      }

      const { data } = await query;
      const map: Record<string, PropertySummary> = {};

      ((data as JournalRow[]) || []).forEach((row) => {
        const customer = row.customer || "General";
        if (!map[customer]) {
          map[customer] = {
            name: customer,
            revenue: 0,
            cogs: 0,
            expenses: 0,
            netIncome: 0,
            operating: 0,
            financing: 0,
            investing: 0,
          };
        }

        const debit = Number(row.debit) || 0;
        const credit = Number(row.credit) || 0;

        if (reportType === "pl") {
          const t = (row.account_type || "").toLowerCase();
          if (t.includes("income") || t.includes("revenue")) {
            map[customer].revenue = (map[customer].revenue || 0) + (credit - debit);
          } else if (t.includes("cost of goods sold") || t.includes("cogs")) {
            const amt = debit - credit;
            map[customer].cogs = (map[customer].cogs || 0) + amt;
          } else if (t.includes("expense")) {
            const amt = debit - credit;
            map[customer].expenses = (map[customer].expenses || 0) + amt;
          }
          map[customer].netIncome = (map[customer].revenue || 0) - (map[customer].cogs || 0) - (map[customer].expenses || 0);
        } else {
          const classification = classifyTransaction(row.account_type, row.report_category);

          if (classification !== "other" && classification !== "transfer") {
            const cashImpact = row.report_category === "transfer"
              ? debit - credit
              : row.normal_balance || credit - debit;

            if (classification === "operating") {
              map[customer].operating = (map[customer].operating || 0) + cashImpact;
            } else if (classification === "financing") {
              map[customer].financing = (map[customer].financing || 0) + cashImpact;
            } else if (classification === "investing") {
              map[customer].investing = (map[customer].investing || 0) + cashImpact;
            }
          }
        }
      });

      const list = Object.values(map).filter((p) => {
        return reportType === "pl"
          ? (p.revenue || 0) !== 0 || (p.cogs || 0) !== 0 || (p.expenses || 0) !== 0 || (p.netIncome || 0) !== 0
          : (p.operating || 0) !== 0 || (p.financing || 0) !== 0 || (p.investing || 0) !== 0;
      });

      const finalList =
        map["General"] && !list.find((p) => p.name === "General")
          ? [...list, map["General"]]
          : list;
      setProperties(finalList);
    };
    load();
  }, [reportType, reportPeriod, month, year, customStart, customEnd, getDateRange]);

  const revenueKing = useMemo(() => {
    if (reportType !== "pl" || !properties.length) return null;
    return properties.reduce((max, p) =>
      (p.revenue || 0) > (max.revenue || 0) ? p : max,
    properties[0]).name;
  }, [properties, reportType]);

  const marginMaster = useMemo(() => {
    if (reportType !== "pl" || !properties.length) return null;
    return properties.reduce((max, p) => {
      const marginP = p.revenue ? (p.netIncome || 0) / p.revenue : 0;
      const marginM = max.revenue ? (max.netIncome || 0) / max.revenue : 0;
      return marginP > marginM ? p : max;
    }, properties[0]).name;
  }, [properties, reportType]);

  const cogsChamp = useMemo(() => {
    if (reportType !== "pl" || !properties.length) return null;
    return properties.reduce((min, p) => {
      const cogsRatioP = p.revenue ? (p.cogs || 0) / p.revenue : Infinity;
      const cogsRatioMin = min.revenue ? (min.cogs || 0) / min.revenue : Infinity;
      return cogsRatioP < cogsRatioMin ? p : min;
    }, properties[0]).name;
  }, [properties, reportType]);

  const payrollKing = useMemo(() => {
    if (reportType !== "payroll" || !properties.length) return null;
    return properties.reduce(
      (max, p) => (p.expenses || 0) > (max.expenses || 0) ? p : max,
      properties[0],
    ).name;
  }, [properties, reportType]);

  const payrollTopEmployee = useMemo(() => {
    if (reportType !== "payroll" || !employeeTotals.length) return null;
    return employeeTotals.reduce(
      (max, e) => (e.total || 0) > (max.total || 0) ? e : max,
      employeeTotals[0],
    ).name;
  }, [employeeTotals, reportType]);

  const cashKing = useMemo(() => {
    if (reportType !== "cf" || !properties.length) return null;
    return properties.reduce((max, p) =>
      (p.operating || 0) > (max.operating || 0) ? p : max,
    properties[0]).name;
  }, [properties, reportType]);

  const flowMaster = useMemo(() => {
    if (reportType !== "cf" || !properties.length) return null;
    return properties.reduce((max, p) => {
      const netP = (p.operating || 0) + (p.financing || 0) + (p.investing || 0);
      const netM = (max.operating || 0) + (max.financing || 0) + (max.investing || 0);
      return netP > netM ? p : max;
    }, properties[0]).name;
  }, [properties, reportType]);

  const arKing = useMemo(() => {
    if (reportType !== "ar" || !properties.length) return null;
    return properties.reduce((max, p) =>
      (p.total || 0) > (max.total || 0) ? p : max,
    properties[0]).name;
  }, [properties, reportType]);

  const currentChamp = useMemo(() => {
    if (reportType !== "ar" || !properties.length) return null;
    return properties.reduce((max, p) => {
      const ratioP = p.total ? (p.current || 0) / (p.total || 1) : 0;
      const ratioM = max.total ? (max.current || 0) / (max.total || 1) : 0;
      return ratioP > ratioM ? p : max;
    }, properties[0]).name;
  }, [properties, reportType]);

  const overdueAlert = useMemo(() => {
    if (reportType !== "ar" || !properties.length) return null;
    return properties.reduce((max, p) => {
      const overdueP = (p.total || 0) - (p.current || 0);
      const overdueM = (max.total || 0) - (max.current || 0);
      return overdueP > overdueM ? p : max;
    }, properties[0]).name;
  }, [properties, reportType]);

  const avgDays = useMemo(() => {
    if (reportType !== "ar" || !properties.length) return 0;
    const weighted = properties.reduce((sum, p) =>
      sum + ((p.current || 0) * 15 + (p.days30 || 0) * 45 + (p.days60 || 0) * 75 + (p.days90 || 0) * 105 + (p.over90 || 0) * 135),
    0);
    const total = properties.reduce((sum, p) => sum + (p.total || 0), 0);
    return total ? Math.round(weighted / total) : 0;
  }, [properties, reportType]);

  const apKing = useMemo(() => {
    if (reportType !== "ap" || !properties.length) return null;
    return properties.reduce((max, p) =>
      (p.total || 0) > (max.total || 0) ? p : max,
    properties[0]).name;
  }, [properties, reportType]);

  const apCurrentChamp = useMemo(() => {
    if (reportType !== "ap" || !properties.length) return null;
    return properties.reduce((max, p) => {
      const ratioP = p.total ? (p.current || 0) / (p.total || 1) : 0;
      const ratioM = max.total ? (max.current || 0) / (max.total || 1) : 0;
      return ratioP > ratioM ? p : max;
    }, properties[0]).name;
  }, [properties, reportType]);

  const apOverdueAlert = useMemo(() => {
    if (reportType !== "ap" || !properties.length) return null;
    return properties.reduce((max, p) => {
      const overdueP = (p.total || 0) - (p.current || 0);
      const overdueM = (max.total || 0) - (max.current || 0);
      return overdueP > overdueM ? p : max;
    }, properties[0]).name;
  }, [properties, reportType]);

  const apAvgDays = useMemo(() => {
    if (reportType !== "ap" || !properties.length) return 0;
    const weighted = properties.reduce((sum, p) =>
      sum + ((p.current || 0) * 15 + (p.days30 || 0) * 45 + (p.days60 || 0) * 75 + (p.days90 || 0) * 105 + (p.over90 || 0) * 135),
    0);
    const total = properties.reduce((sum, p) => sum + (p.total || 0), 0);
    return total ? Math.round(weighted / total) : 0;
  }, [properties, reportType]);

  const companyTotals = properties.reduce(
    (acc, p) => {
      if (reportType === "pl") {
        acc.revenue += p.revenue || 0;
        acc.cogs += p.cogs || 0;
        acc.expenses += p.expenses || 0;
        acc.net += p.netIncome || 0;
      } else if (reportType === "cf") {
        acc.operating += p.operating || 0;
        acc.financing += p.financing || 0;
        acc.investing += p.investing || 0;
        acc.net += (p.operating || 0) + (p.financing || 0) + (p.investing || 0);
      } else if (reportType === "ar" || reportType === "ap") {
        acc.current += p.current || 0;
        acc.days30 += p.days30 || 0;
        acc.days60 += p.days60 || 0;
        acc.days90 += p.days90 || 0;
        acc.over90 += p.over90 || 0;
        acc.net += p.total || 0;
      } else {
        acc.expenses += p.expenses || 0;
        acc.net += p.expenses || 0;
      }
      return acc;
    },
    {
      revenue: 0,
      cogs: 0,
      expenses: 0,
      net: 0,
      operating: 0,
      financing: 0,
      investing: 0,
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
    },
  );

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const formatCurrencyWithCents = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const formatCompactCurrency = (n: number) => {
    if (Math.abs(n) >= 1000000) {
      return `${(n / 1000000).toFixed(1)}M`;
    } else if (Math.abs(n) >= 1000) {
      return `${(n / 1000).toFixed(1)}K`;
    }
    return formatCurrency(n);
  };

  const rankingLabels: Record<RankingMetric, string> = {
    revenue: "Revenue",
    margin: "Margin",
    netIncome: "Net Income",
    cogs: "COGS Efficiency",
    growth: "Revenue",
    operating: "Operating Cash",
    netCash: "Net Cash",
    investing: "Investing",
    stability: "Net Cash",
    arTotal: "Total A/R",
    arCurrent: "Current Ratio",
    arOverdue: "Overdue A/R",
    apTotal: "Total A/P",
    apCurrent: "Current Ratio",
    apOverdue: "Overdue A/P",
    payrollDept: "Payroll",
    payrollEmployee: "Payroll",
  };

  const rankedProperties = useMemo(() => {
    if (!rankingMetric) return [];
    const arr = [...properties];
    switch (rankingMetric) {
      case "revenue":
        return arr.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
      case "margin":
        return arr.sort((a, b) => {
          const mA = a.revenue ? (a.netIncome || 0) / (a.revenue || 1) : -Infinity;
          const mB = b.revenue ? (b.netIncome || 0) / (b.revenue || 1) : -Infinity;
          return mB - mA;
        });
      case "cogs":
        return arr.sort((a, b) => {
          const cogsRatioA = a.revenue ? (a.cogs || 0) / a.revenue : Infinity;
          const cogsRatioB = b.revenue ? (b.cogs || 0) / b.revenue : Infinity;
          return cogsRatioA - cogsRatioB; // Lower COGS ratio is better
        });
      case "netIncome":
        return arr.sort((a, b) => (b.netIncome || 0) - (a.netIncome || 0));
      case "growth":
        return arr.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
      case "operating":
        return arr.sort((a, b) => (b.operating || 0) - (a.operating || 0));
      case "netCash":
        return arr.sort(
          (a, b) =>
            (b.operating || 0) + (b.financing || 0) + (b.investing || 0) -
            ((a.operating || 0) + (a.financing || 0) + (a.investing || 0)),
        );
      case "investing":
        return arr.sort((a, b) => (a.investing || 0) - (b.investing || 0));
      case "arTotal":
        return arr.sort((a, b) => (b.total || 0) - (a.total || 0));
      case "arCurrent":
        return arr.sort((a, b) => {
          const rA = a.total ? (a.current || 0) / (a.total || 1) : 0;
          const rB = b.total ? (b.current || 0) / (b.total || 1) : 0;
          return rB - rA;
        });
      case "arOverdue":
        return arr.sort(
          (a, b) =>
            ((b.total || 0) - (b.current || 0)) -
            ((a.total || 0) - (a.current || 0)),
        );
      case "apTotal":
        return arr.sort((a, b) => (b.total || 0) - (a.total || 0));
      case "apCurrent":
        return arr.sort((a, b) => {
          const rA = a.total ? (a.current || 0) / (a.total || 1) : 0;
          const rB = b.total ? (b.current || 0) / (b.total || 1) : 0;
          return rB - rA;
        });
      case "apOverdue":
        return arr.sort(
          (a, b) =>
            ((b.total || 0) - (b.current || 0)) -
            ((a.total || 0) - (a.current || 0)),
        );
      case "payrollDept":
        return arr.sort((a, b) => (b.expenses || 0) - (a.expenses || 0));
      case "payrollEmployee":
        return [...employeeTotals].sort((a, b) => b.total - a.total);
      default:
        return arr;
    }
  }, [properties, employeeTotals, rankingMetric]);

  const formatRankingValue = (p: any) => {
    switch (rankingMetric) {
      case "margin":
        const m = p.revenue ? (p.netIncome || 0) / (p.revenue || 1) : 0;
        return `${(m * 100).toFixed(1)}%`;
      case "cogs":
        const cogsRatio = p.revenue ? (p.cogs || 0) / p.revenue : 0;
        return `${(cogsRatio * 100).toFixed(1)}%`;
      case "netCash":
        return formatCompactCurrency(
          (p.operating || 0) + (p.financing || 0) + (p.investing || 0),
        );
      case "operating":
        return formatCompactCurrency(p.operating || 0);
      case "investing":
        return formatCompactCurrency(p.investing || 0);
      case "revenue":
        return formatCompactCurrency(p.revenue || 0);
      case "growth":
        return formatCompactCurrency(p.revenue || 0);
      case "arTotal":
        return formatCompactCurrency(p.total || 0);
      case "arCurrent":
        const rc = p.total ? (p.current || 0) / (p.total || 1) : 0;
        return `${(rc * 100).toFixed(1)}%`;
      case "arOverdue":
        return formatCompactCurrency((p.total || 0) - (p.current || 0));
      case "apTotal":
        return formatCompactCurrency(p.total || 0);
      case "apCurrent":
        const rca = p.total ? (p.current || 0) / (p.total || 1) : 0;
        return `${(rca * 100).toFixed(1)}%`;
      case "apOverdue":
        return formatCompactCurrency((p.total || 0) - (p.current || 0));
      case "payrollDept":
        return formatCompactCurrency(p.expenses || 0);
      case "payrollEmployee":
        return formatCompactCurrency(p.total || 0);
      case "netIncome":
      default:
        return formatCompactCurrency(p.netIncome || 0);
    }
  };

  const showRanking = (metric: RankingMetric) => {
    setRankingMetric(metric);
    setView("summary");
  };

  const showARTransactions = (bucket: string) => {
    setSelectedCategory(bucket);
    setView("detail");
  };

  const showAPTransactions = (bucket: string) => {
    setSelectedCategory(bucket);
    setView("detail");
  };

  const showEmployeeTransactions = (employee: string) => {
    setSelectedCategory(employee);
    const breakdown = employeeBreakdown[employee];
    setTransactions(breakdown ? breakdown.payments : []);
    setView("detail");
  };

  const handlePropertySelect = async (name: string | null) => {
    setSelectedProperty(name);
    if (reportType === "pl") await loadPL(name);
    else if (reportType === "cf") await loadCF(name);
    else if (reportType === "payroll") await loadPayroll(name);
    else if (reportType === "ap") await loadAP(name);
    else await loadAR(name);
    setView("report");
  };

  const loadPL = async (propertyName: string | null = selectedProperty) => {
    const { start, end } = getDateRange();
    let query = supabase
      .from("journal_entry_lines")
      .select("account, account_type, debit, credit, customer, date")
      .gte("date", start)
      .lte("date", end);
    if (propertyName) {
      query =
        propertyName === "General"
          ? query.is("customer", null)
          : query.eq("customer", propertyName);
    }
    const { data } = await query;
    const rev: Record<string, number> = {};
    const cogs: Record<string, number> = {};
    const exp: Record<string, number> = {};
    ((data as JournalRow[]) || []).forEach((row) => {
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      const t = (row.account_type || "").toLowerCase();
      
      if (t.includes("income") || t.includes("revenue")) {
        const amount = credit - debit;
        rev[row.account] = (rev[row.account] || 0) + amount;
      } else if (t.includes("cost of goods sold") || t.includes("cogs")) {
        const cogsAmount = debit - credit;
        cogs[row.account] = (cogs[row.account] || 0) + cogsAmount;
      } else if (t.includes("expense")) {
        const expAmount = debit - credit;
        exp[row.account] = (exp[row.account] || 0) + expAmount;
      }
    });
    setPlData({
      revenue: Object.entries(rev).map(([name, total]) => ({ name, total })),
      cogs: Object.entries(cogs).map(([name, total]) => ({ name, total })),
      expenses: Object.entries(exp).map(([name, total]) => ({ name, total })),
    });
  };

  const loadCF = async (propertyName: string | null = selectedProperty) => {
    const { start, end } = getDateRange();
    
    // Enhanced query mirroring cash flow component
    const selectColumns = "account, account_type, report_category, normal_balance, debit, credit, customer, date, entry_bank_account, is_cash_account";
    
    let query = supabase
      .from("journal_entry_lines")
      .select(selectColumns)
      .gte("date", start)
      .lte("date", end)
      .not("entry_bank_account", "is", null)  // Must have bank account source
      .eq("is_cash_account", false)           // Only non-cash transactions
      .neq("report_category", "transfer");    // Exclude transfers

    if (propertyName) {
      query =
        propertyName === "General"
          ? query.is("customer", null)
          : query.eq("customer", propertyName);
    }
    
    const { data } = await query;
    const op: Record<string, number> = {};
    const fin: Record<string, number> = {};
    const inv: Record<string, number> = {};
    
    ((data as JournalRow[]) || []).forEach((row) => {
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      
      // Enhanced cash impact calculation mirroring cash flow component
      const classification = classifyTransaction(row.account_type, row.report_category);
      
      if (classification !== "other" && classification !== "transfer") {
        const cashImpact = row.report_category === "transfer" 
          ? debit - credit  // Reverse for transfers
          : row.normal_balance || credit - debit;  // Normal for others
          
        if (classification === "operating") {
          op[row.account] = (op[row.account] || 0) + cashImpact;
        } else if (classification === "financing") {
          fin[row.account] = (fin[row.account] || 0) + cashImpact;
        } else if (classification === "investing") {
          inv[row.account] = (inv[row.account] || 0) + cashImpact;
        }
      }
    });
    
    const operatingArr = Object.entries(op)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    const financingArr = Object.entries(fin)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    const investingArr = Object.entries(inv)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
      
    setCfData({
      operating: operatingArr,
      financing: financingArr,
      investing: investingArr
    });
  };

  const loadAR = async (propertyName: string | null = selectedProperty) => {
    let query = supabase
      .from("ar_aging_detail")
      .select("*")
      .gt("open_balance", 0);
    if (propertyName) {
      query = query.eq("customer", propertyName);
    }
    const { data } = await query;
    const list: ARTransaction[] = (data as any[] || []).map((rec) => ({
      invoiceNumber: rec.number || "",
      invoiceDate: rec.date,
      dueDate: rec.due_date,
      amount: Number(rec.open_balance) || 0,
      daysOutstanding: calculateDaysOutstanding(rec.due_date),
      customer: rec.customer,
      memo: rec.memo || null,
    }));
    setArTransactions(list);
  };

  const loadAP = async (propertyName: string | null = selectedProperty) => {
    let query = supabase
      .from("ap_aging")
      .select("*")
      .gt("open_balance", 0);
    if (propertyName) {
      query = query.eq("vendor", propertyName);
    }
    const { data } = await query;
    const list: APTransaction[] = (data as any[] || []).map((rec) => ({
      billNumber: rec.number || "",
      billDate: rec.date,
      dueDate: rec.due_date,
      amount: Number(rec.open_balance) || 0,
      daysOutstanding: calculateDaysOutstanding(rec.due_date),
      vendor: rec.vendor,
      memo: rec.memo || null,
    }));
    setApTransactions(list);
  };

  const loadPayroll = async (department: string | null = selectedProperty) => {
    const { start, end } = getDateRange();
    let query = supabase
      .from("payments")
      .select("date, total_amount, first_name, last_name, department")
      .gte("date", start)
      .lte("date", end);
    if (department) {
      query = query.eq("department", department);
    }
    const { data } = await query;
    const breakdown: Record<string, { total: number; payments: Transaction[] }> = {};
    ((data as any[]) || [])
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((row) => {
        const amount = Number(row.total_amount) || 0;
        const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown";
        if (!breakdown[name]) {
          breakdown[name] = { total: 0, payments: [] };
        }
        breakdown[name].total += amount;
        breakdown[name].payments.push({
          date: row.date,
          amount,
          running: 0,
          payee: name,
          customer: row.department,
        });
      });
    setEmployeeBreakdown(breakdown);
    setTransactions([]);
    setPayrollTotals(Object.values(breakdown).reduce((sum, e) => sum + e.total, 0));
  };

  const handleCategory = async (
    account: string,
    type: "revenue" | "cogs" | "expense" | "operating" | "financing" | "investing",
  ) => {
    const { start, end } = getDateRange();
    let query = supabase
      .from("journal_entry_lines")
      .select(
        "date, debit, credit, account, customer, report_category, normal_balance, memo, vendor, name, entry_number, number",
      )
      .eq("account", account)
      .gte("date", start)
      .lte("date", end);

    if (reportType === "cf") {
      query = query
        .not("entry_bank_account", "is", null)
        .eq("is_cash_account", false)
        .neq("report_category", "transfer");
    }
    if (selectedProperty) {
      query =
        selectedProperty === "General"
          ? query.is("customer", null)
          : query.eq("customer", selectedProperty);
    }
    const { data } = await query;
    const list: Transaction[] = ((data as JournalRow[]) || [])
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => {
        const debit = Number(row.debit) || 0;
        const credit = Number(row.credit) || 0;
        let amount = 0;
        if (reportType === "pl") {
          if (type === "revenue") {
            amount = credit - debit;
          } else {
            amount = debit - credit;
          }
        } else {
          // Enhanced cash flow calculation for transactions
          amount = row.report_category === "transfer" 
            ? debit - credit
            : row.normal_balance || credit - debit;
        }
        return {
          date: row.date,
          amount,
          running: 0,
          payee: row.vendor || row.name,
          memo: row.memo,
          customer: row.customer,
          entryNumber: row.entry_number,
        };
      });
    let run = 0;
    list.forEach((t) => {
      run += t.amount;
      t.running = run;
    });
    setTransactions(list);
    setSelectedCategory(account);
    setView("detail");
  };

  const openJournalEntry = async (entryNumber?: string) => {
    if (!entryNumber) return;
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select("date, account, memo, customer, debit, credit")
      .eq("entry_number", entryNumber)
      .order("line_sequence");
    if (error) {
      console.error("Error fetching journal entry lines:", error);
      return;
    }
    setJournalEntryLines(data || []);
    setJournalTitle(`Journal Entry ${entryNumber}`);
    setShowJournalModal(true);
  };

  const back = () => {
    if (view === "detail") setView("report");
    else if (view === "report") setView("overview");
    else if (view === "summary") {
      setRankingMetric(null);
      setView("overview");
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: BRAND_COLORS.gray[50],
      padding: '16px',
      position: 'relative'
    }}>
      <style jsx>{`
        @keyframes slideDown {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Enhanced Header */}
      <header style={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        color: 'white',
        boxShadow: `0 8px 32px ${BRAND_COLORS.primary}33`
      }}>
        <div className="relative flex items-center justify-center mb-4">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="absolute left-0"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              color: 'white'
            }}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <span
            onClick={() => handlePropertySelect(null)}
            style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', cursor: 'pointer' }}
          >
            I AM CFO
          </span>
        </div>

        {/* Dashboard Summary */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            {reportType === "pl"
              ? "P&L Dashboard"
              : reportType === "cf"
              ? "Cash Flow Dashboard"
              : reportType === "payroll"
              ? "Payroll Dashboard"
              : reportType === "ap"
              ? "A/P Aging Report"
              : "A/R Aging Report"}
          </h1>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>
            {reportType === "ar" || reportType === "ap" ? "As of Today" : `${getMonthName(month)} ${year}`} • {properties.length}{" "}
            {reportType === "payroll" ? "Departments" : reportType === "ap" ? "Vendors" : "Customers"}
          </p>
        </div>

        {/* Company Total - Enhanced */}
        <div
          onClick={() => handlePropertySelect(null)}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '20px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Company Total</span>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '8px 0' }}>
              {formatCompactCurrency(companyTotals.net)}
            </div>
          </div>
          
          {reportType === "pl" ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.revenue)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Revenue</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.cogs)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>COGS</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.expenses)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Expenses</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.net)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Net Income</div>
              </div>
            </div>
          ) : reportType === "cf" ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.operating)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Operating</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.financing)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Financing</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.investing)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Investing</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.net)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Net Cash</div>
              </div>
            </div>
          ) : reportType === "payroll" ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.expenses)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Payroll</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.current)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Current</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.days30)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>31-60</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.days60)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>61-90</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.days90)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>91-120</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCompactCurrency(companyTotals.over90)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>120+</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hamburger Dropdown Menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '16px',
          right: '16px',
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)',
          border: `2px solid ${BRAND_COLORS.gray[200]}`,
          zIndex: 1000,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: BRAND_COLORS.accent }}>
              Report Type
            </label>
            <select
              style={{
                width: '100%',
                padding: '12px',
                border: `2px solid ${BRAND_COLORS.gray[200]}`,
                borderRadius: '8px',
                fontSize: '16px'
              }}
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as "pl" | "cf" | "ar" | "ap" | "payroll",
                )
              }
            >
              <option value="pl">P&L Statement</option>
              <option value="cf">Cash Flow Statement</option>
              <option value="payroll">Payroll</option>
              <option value="ar">A/R Aging Report</option>
              <option value="ap">A/P Aging Report</option>
            </select>
          </div>
          {reportType !== "ar" && reportType !== "ap" && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: BRAND_COLORS.accent }}>
                  Report Period
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${BRAND_COLORS.gray[200]}`,
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  value={reportPeriod}
                  onChange={(e) =>
                    setReportPeriod(e.target.value as "Monthly" | "Custom" | "Year to Date" | "Trailing 12" | "Quarterly")
                  }
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Custom">Custom Range</option>
                  <option value="Year to Date">Year to Date</option>
                  <option value="Trailing 12">Trailing 12 Months</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
              </div>
              {reportPeriod === "Custom" ? (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <input
                    type="date"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: `2px solid ${BRAND_COLORS.gray[200]}`,
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <input
                    type="date"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: `2px solid ${BRAND_COLORS.gray[200]}`,
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <select
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: `2px solid ${BRAND_COLORS.gray[200]}`,
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString("en", { month: "long" })}
                      </option>
                    ))}
                  </select>
                  <select
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: `2px solid ${BRAND_COLORS.gray[200]}`,
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </>
          )}
          <button
            style={{
              width: '100%',
              padding: '12px',
              background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onClick={() => setMenuOpen(false)}
          >
            Apply Filters
          </button>
        </div>
      )}

      {view === "overview" && (
        <div>
          {/* Production Summary */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            border: `1px solid ${BRAND_COLORS.gray[200]}`,
            boxShadow: '0 4px 20px rgba(86, 182, 233, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
                  color: 'white',
                  boxShadow: `0 10px 24px ${BRAND_COLORS.primary}33`
                }}>
                  <Factory size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: BRAND_COLORS.accent }}>Production</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Monitor daily output & revenue</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetProductionForm();
                  setProductionModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: `0 8px 18px ${BRAND_COLORS.primary}2b`
                }}
              >
                <PlusCircle size={18} />
                Log Production
              </button>
            </div>

            <div style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              marginBottom: '16px'
            }}>
              <div style={{
                borderRadius: '12px',
                border: `1px solid ${BRAND_COLORS.primary}22`,
                padding: '16px',
                background: `linear-gradient(135deg, ${BRAND_COLORS.gray[50]}, #f1f9ff)`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: BRAND_COLORS.primary,
                  marginBottom: '8px'
                }}>
                  <Calendar size={14} />
                  Today
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: BRAND_COLORS.accent, marginBottom: '4px' }}>
                  {formatTonnage(todaysProduction.tonnage)}
                </div>
                <div style={{ fontSize: '14px', color: '#475569' }}>
                  {formatCurrencyWithCents(todaysProduction.revenue)}
                </div>
              </div>
              <div style={{
                borderRadius: '12px',
                border: `1px solid ${BRAND_COLORS.secondary}22`,
                padding: '16px',
                background: `linear-gradient(135deg, ${BRAND_COLORS.gray[50]}, #eef7ff)`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: BRAND_COLORS.secondary,
                  marginBottom: '8px'
                }}>
                  <Calendar size={14} />
                  This Week
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: BRAND_COLORS.secondary, marginBottom: '4px' }}>
                  {formatTonnage(weeklyProduction.tonnage)}
                </div>
                <div style={{ fontSize: '14px', color: '#475569' }}>
                  {formatCurrencyWithCents(weeklyProduction.revenue)}
                </div>
              </div>
              <div style={{
                borderRadius: '12px',
                border: `1px solid ${BRAND_COLORS.success}22`,
                padding: '16px',
                background: `linear-gradient(135deg, ${BRAND_COLORS.gray[50]}, #f3fff6)`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: BRAND_COLORS.success,
                  marginBottom: '8px'
                }}>
                  <DollarSign size={14} />
                  New Log Preview
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: BRAND_COLORS.success, marginBottom: '4px' }}>
                  {formatCurrencyWithCents(productionCalculatedTotal)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {plannedProductionTonnage > 0
                    ? `${plannedProductionTonnage.toFixed(1)} tons ready to log`
                    : 'Set tonnage to preview totals'}
                </div>
              </div>
            </div>

            {productionDuplicateMessage && (
              <div style={{
                background: `${BRAND_COLORS.primary}12`,
                border: `1px solid ${BRAND_COLORS.primary}33`,
                color: BRAND_COLORS.primary,
                borderRadius: '12px',
                padding: '12px',
                fontSize: '12px',
                marginBottom: offlineProductionQueue.length ? '12px' : '0'
              }}>
                {productionDuplicateMessage}
              </div>
            )}

            {offlineProductionQueue.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                border: `1px dashed ${BRAND_COLORS.warning}`,
                background: `${BRAND_COLORS.warning}12`
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: BRAND_COLORS.warning }}>
                  {offlineProductionQueue.length} offline entr{offlineProductionQueue.length === 1 ? 'y' : 'ies'} waiting to sync
                </div>
                <button
                  type="button"
                  onClick={syncProductionEntries}
                  disabled={isSyncingProduction}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: `linear-gradient(135deg, ${BRAND_COLORS.warning}, #f59e0b)`,
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isSyncingProduction ? 'not-allowed' : 'pointer',
                    opacity: isSyncingProduction ? 0.75 : 1
                  }}
                >
                  {isSyncingProduction ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <RefreshCcw size={16} />
                  )}
                  {isSyncingProduction ? 'Syncing' : 'Sync Now'}
                </button>
              </div>
            )}
          </div>

          {/* Recent Production */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            border: `1px solid ${BRAND_COLORS.gray[200]}`,
            boxShadow: '0 4px 20px rgba(86, 182, 233, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: BRAND_COLORS.accent }}>Recent Production</h3>
              <button
                type="button"
                onClick={() => setShowAllProduction((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${BRAND_COLORS.primary}44`,
                  color: BRAND_COLORS.primary,
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {showAllProduction ? 'Show Recent' : 'View All'}
              </button>
            </div>

            {displayedProductionEntries.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                borderRadius: '12px',
                border: `1px dashed ${BRAND_COLORS.gray[200]}`,
                color: '#94a3b8',
                fontSize: '13px'
              }}>
                No production entries logged yet. Tap "Log Production" to get started.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {displayedProductionEntries.map((entry) => (
                  <div
                    key={`${entry.id}-${entry.created_at}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${entry.synced ? BRAND_COLORS.gray[200] : BRAND_COLORS.warning}55`,
                      background: entry.synced ? `${BRAND_COLORS.gray[50]}` : `${BRAND_COLORS.warning}08`
                    }}
                  >
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        {new Date(`${entry.log_date}T00:00:00`).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: BRAND_COLORS.accent }}>
                        {formatTonnage(entry.tonnage)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{entry.client_name}</div>
                      {!entry.synced && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: BRAND_COLORS.warning }}>Pending Sync</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Amount</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: BRAND_COLORS.accent }}>
                          {formatCurrencyWithCents(entry.total_amount)}
                        </div>
                      </div>
                      {(entry.file_url || entry.photo?.base64) ? (
                        <button
                          type="button"
                          onClick={() => openProductionPhoto(entry)}
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: `1px solid ${BRAND_COLORS.gray[200]}`,
                            padding: 0,
                            background: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          <img
                            src={entry.file_url || entry.photo?.base64 || ''}
                            alt={`${entry.client_name} production`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </button>
                      ) : (
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          border: `1px dashed ${BRAND_COLORS.gray[200]}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8'
                        }}>
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portfolio Insights */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            border: `1px solid ${BRAND_COLORS.gray[200]}`,
            boxShadow: '0 4px 20px rgba(86, 182, 233, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Target size={20} style={{ color: BRAND_COLORS.accent }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: BRAND_COLORS.accent }}>
                {reportType === "ap" ? "Vendor Insights" : "Customer Insights"}
              </h3>
            </div>
            
            {/* Awards Section */}
            <div style={{
              background: `linear-gradient(135deg, ${BRAND_COLORS.gray[50]}, #f0f9ff)`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              border: `1px solid ${BRAND_COLORS.tertiary}33`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Award size={16} style={{ color: BRAND_COLORS.primary }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: BRAND_COLORS.primary }}>
                  {reportType === "ap" ? "Vendor Champions" : "Customer Champions"}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {reportType === "pl" ? (
                  <>
                    <div onClick={() => showRanking("revenue")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.warning}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>👑</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.warning, fontWeight: '600' }}>
                          REV CHAMP
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {revenueKing}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("margin")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.success}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>🏅</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.success, fontWeight: '600' }}>
                          MARGIN MASTER
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {marginMaster}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("cogs")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.accent}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>🎯</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.accent, fontWeight: '600' }}>
                          COGS CHAMP
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {cogsChamp}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("netIncome")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.primary}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>💎</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.primary, fontWeight: '600' }}>
                          PROFIT STAR
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {properties.find(p => (p.netIncome || 0) === Math.max(...properties.map(prop => prop.netIncome || 0)))?.name}
                        </div>
                      </div>
                    </div>
                  </>
                ) : reportType === "cf" ? (
                  <>
                    <div onClick={() => showRanking("operating")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.primary}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>💰</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.primary, fontWeight: '600' }}>
                          CASH KING
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {cashKing}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("netCash")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.success}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>⚡</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.success, fontWeight: '600' }}>
                          FLOW MASTER
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {flowMaster}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("investing")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.warning}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>🎯</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.warning, fontWeight: '600' }}>
                          EFFICIENCY ACE
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {properties.find(p => (p.investing || 0) === Math.min(...properties.map(prop => prop.investing || 0)))?.name}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("stability")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.secondary}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>💪</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.secondary, fontWeight: '600' }}>
                          STABILITY PRO
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {properties.length ? properties[Math.floor(Math.random() * properties.length)].name : "N/A"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : reportType === "payroll" ? (
                  <>
                    <div onClick={() => showRanking("payrollDept")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.danger}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>🏢</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.danger, fontWeight: '600' }}>
                          TOP DEPT
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {payrollKing}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("payrollEmployee")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.secondary}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>👤</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.secondary, fontWeight: '600' }}>
                          TOP EMP
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {payrollTopEmployee}
                        </div>
                      </div>
                    </div>
                  </>
                ) : reportType === "ap" ? (
                  <>
                    <div onClick={() => showRanking("apTotal")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.primary}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>💰</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.primary, fontWeight: '600' }}>
                          A/P KING
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {apKing}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("apCurrent")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.success}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>⏰</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.success, fontWeight: '600' }}>
                          CURRENT CHAMP
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {apCurrentChamp}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("apOverdue")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.danger}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>⚠️</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.danger, fontWeight: '600' }}>
                          OVERDUE ALERT
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {apOverdueAlert}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.accent}33`
                    }}>
                      <span style={{ fontSize: '20px' }}>📊</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.accent, fontWeight: '600' }}>
                          AVG DAYS
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {apAvgDays}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div onClick={() => showRanking("arTotal")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.primary}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>💰</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.primary, fontWeight: '600' }}>
                          A/R KING
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {arKing}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("arCurrent")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.success}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>⏰</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.success, fontWeight: '600' }}>
                          CURRENT CHAMP
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {currentChamp}
                        </div>
                      </div>
                    </div>
                    <div onClick={() => showRanking("arOverdue")} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.danger}33`,
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '20px' }}>⚠️</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.danger, fontWeight: '600' }}>
                          OVERDUE ALERT
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {overdueAlert}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${BRAND_COLORS.accent}33`
                    }}>
                      <span style={{ fontSize: '20px' }}>📊</span>
                      <div>
                        <div style={{ fontSize: '11px', color: BRAND_COLORS.accent, fontWeight: '600' }}>
                          AVG DAYS
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {avgDays}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {insights.map((insight, index) => {
                const Icon = insight.icon;
                const bgColor = insight.type === 'success' ? '#f0f9ff' :
                               insight.type === 'warning' ? '#fffbeb' : '#f8fafc';
                const iconColor = insight.type === 'success' ? BRAND_COLORS.success :
                                 insight.type === 'warning' ? BRAND_COLORS.warning : BRAND_COLORS.primary;

                return (
                  <div key={index} style={{
                    background: bgColor,
                    padding: '16px',
                    borderRadius: '8px',
                    border: `1px solid ${BRAND_COLORS.gray[200]}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                      <Icon size={20} style={{ color: iconColor, marginTop: '2px' }} />
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                          {insight.title}
                        </h4>
                        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                          {insight.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enhanced Customer KPI Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {properties.map((p) => {
              const isRevenueKing = p.name === revenueKing;
              const isMarginMaster = p.name === marginMaster;
              const isCogsChamp = p.name === cogsChamp;
              const isCashKing = p.name === cashKing;
              const isFlowMaster = p.name === flowMaster;
              const isArKing = p.name === arKing;
              const isCurrentChamp = p.name === currentChamp;
              const isOverdueAlert = p.name === overdueAlert;
              const isPayrollKing = p.name === payrollKing;
              const isApKing = p.name === apKing;
              const isApCurrentChamp = p.name === apCurrentChamp;
              const isApOverdueAlert = p.name === apOverdueAlert;
              
              return (
                <div
                  key={p.name}
                  onClick={() => handlePropertySelect(p.name)}
                  style={{
                    background: selectedProperty === p.name 
                      ? `linear-gradient(135deg, ${BRAND_COLORS.primary}15, ${BRAND_COLORS.tertiary}15)` 
                      : 'white',
                    border: selectedProperty === p.name 
                      ? `3px solid ${BRAND_COLORS.primary}` 
                      : `2px solid ${BRAND_COLORS.gray[200]}`,
                    borderRadius: '16px',
                    padding: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: selectedProperty === p.name 
                      ? `0 8px 32px ${BRAND_COLORS.primary}40, 0 0 0 1px ${BRAND_COLORS.primary}20` 
                      : '0 4px 16px rgba(0, 0, 0, 0.08)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    if (selectedProperty !== p.name) {
                      e.currentTarget.style.borderColor = BRAND_COLORS.tertiary;
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                      e.currentTarget.style.boxShadow = `0 12px 32px ${BRAND_COLORS.tertiary}30`;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedProperty !== p.name) {
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                    }
                  }}
                >
                  {/* Decorative corner element */}
                  <div style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '60px',
                    height: '60px',
                    background: `linear-gradient(135deg, ${BRAND_COLORS.tertiary}20, ${BRAND_COLORS.primary}10)`,
                    borderRadius: '50%',
                    opacity: 0.6
                  }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ 
                      fontWeight: '700', 
                      fontSize: '15px', 
                      color: BRAND_COLORS.accent,
                      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      {p.name}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {reportType === "pl" && isRevenueKing && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.warning}, #f59e0b)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>👑</span>
                        </div>
                      )}
                      {reportType === "pl" && isMarginMaster && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.success}, #22c55e)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>🏅</span>
                        </div>
                      )}
                      {reportType === "pl" && isCogsChamp && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.accent}, #0ea5e9)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>🎯</span>
                        </div>
                      )}
                      {reportType === "cf" && isCashKing && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, #0ea5e9)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>💰</span>
                        </div>
                      )}
                      {reportType === "cf" && isFlowMaster && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.success}, #22c55e)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>⚡</span>
                        </div>
                      )}
                      {reportType === "payroll" && isPayrollKing && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.warning}, #f59e0b)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(245,158,11,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>👑</span>
                        </div>
                      )}
                      {reportType === "ar" && isArKing && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, #0ea5e9)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(14,165,233,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>💰</span>
                        </div>
                      )}
                      {reportType === "ap" && isApKing && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, #0ea5e9)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(14,165,233,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>💰</span>
                        </div>
                      )}
                      {reportType === "ar" && isCurrentChamp && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.success}, #22c55e)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(34,197,94,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>⏰</span>
                        </div>
                      )}
                      {reportType === "ap" && isApCurrentChamp && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.success}, #22c55e)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(34,197,94,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>⏰</span>
                        </div>
                      )}
                      {reportType === "ar" && isOverdueAlert && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.danger}, #ef4444)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>⚠️</span>
                        </div>
                      )}
                      {reportType === "ap" && isApOverdueAlert && (
                        <div style={{
                          background: `linear-gradient(135deg, ${BRAND_COLORS.danger}, #ef4444)`,
                          borderRadius: '12px',
                          padding: '4px 6px',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
                        }}>
                          <span style={{ fontSize: '16px' }}>⚠️</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {reportType === "pl" ? (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.success}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.success}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Revenue</span>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: '700',
                          color: BRAND_COLORS.success,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.revenue || 0)}
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.warning}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.warning}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>COGS</span>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: '700',
                          color: BRAND_COLORS.warning,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.cogs || 0)}
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.danger}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.danger}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Expenses</span>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: '700',
                          color: BRAND_COLORS.danger,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.expenses || 0)}
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        background: `linear-gradient(135deg, ${BRAND_COLORS.primary}10, ${BRAND_COLORS.tertiary}05)`,
                        borderRadius: '8px',
                        border: `2px solid ${BRAND_COLORS.primary}30`,
                        boxShadow: `0 4px 12px ${BRAND_COLORS.primary}20`
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_COLORS.accent }}>Net Income</span>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: '800',
                          color: (p.netIncome || 0) >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger,
                          textShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}>
                          {formatCompactCurrency(p.netIncome || 0)}
                        </span>
                      </div>
                    </div>
                  ) : reportType === "cf" ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.primary}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.primary}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Operating</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: BRAND_COLORS.primary,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.operating || 0)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.secondary}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.secondary}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Financing</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: BRAND_COLORS.secondary,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.financing || 0)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.warning}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.warning}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Investing</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: BRAND_COLORS.warning,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.investing || 0)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px',
                        background: `linear-gradient(135deg, ${BRAND_COLORS.accent}10, ${BRAND_COLORS.primary}05)`,
                        borderRadius: '8px',
                        border: `2px solid ${BRAND_COLORS.accent}30`,
                        boxShadow: `0 4px 12px ${BRAND_COLORS.accent}20`
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_COLORS.accent }}>Net Cash</span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '800',
                          color: ((p.operating || 0) + (p.financing || 0) + (p.investing || 0)) >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger,
                          textShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}>
                          {formatCompactCurrency((p.operating || 0) + (p.financing || 0) + (p.investing || 0))}
                        </span>
                      </div>
                    </div>
                  ) : reportType === "payroll" ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.danger}08`,
                        borderRadius: '6px',
                        border: `1px solid ${BRAND_COLORS.danger}20`
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Payroll</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: BRAND_COLORS.danger,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {formatCompactCurrency(p.expenses || 0)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.success}20`,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Current</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_COLORS.success }}>
                          {formatCompactCurrency(p.current || 0)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.warning}20`,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>31-60</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_COLORS.warning }}>
                          {formatCompactCurrency(p.days30 || 0)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: `${BRAND_COLORS.danger}20`,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>61+</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_COLORS.danger }}>
                          {formatCompactCurrency((p.days60 || 0) + (p.days90 || 0) + (p.over90 || 0))}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px',
                        background: `linear-gradient(135deg, ${BRAND_COLORS.primary}10, ${BRAND_COLORS.tertiary}05)`,
                        borderRadius: '8px',
                        border: `2px solid ${BRAND_COLORS.primary}30`,
                        boxShadow: `0 4px 12px ${BRAND_COLORS.primary}20`
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_COLORS.accent }}>
                          {reportType === "ap" ? "Total A/P" : "Total A/R"}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: BRAND_COLORS.primary }}>
                          {formatCompactCurrency(p.total || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div
            onClick={() => handlePropertySelect(null)}
            style={{
              marginTop: '24px',
              background: 'white',
              borderRadius: '16px',
              padding: '18px',
              cursor: 'pointer',
              border: `2px solid ${BRAND_COLORS.gray[200]}`,
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
            }}
          >
            <span
              style={{
                fontWeight: '700',
                fontSize: '15px',
                color: BRAND_COLORS.accent
              }}
            >
              Company Total {reportType === "pl" ? "Net Income" : reportType === "cf" ? "Net Cash" : reportType === "payroll" ? "Payroll" : reportType === "ap" ? "A/P" : "A/R"}
            </span>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '800',
                marginTop: '4px',
                color: reportType === "ar" || reportType === "ap" ? BRAND_COLORS.primary : reportType === "payroll" ? BRAND_COLORS.danger : companyTotals.net >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger
              }}
            >
              {formatCompactCurrency(companyTotals.net)}
            </div>
          </div>
        </div>
      )}

      {view === "summary" && rankingMetric && (
        <div>
          <button
            onClick={back}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              fontSize: '16px',
              color: BRAND_COLORS.accent,
              marginBottom: '20px',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={20} style={{ marginRight: '4px' }} />
            Back to Overview
          </button>

          <div
            style={{
              background: `linear-gradient(135deg, ${BRAND_COLORS.tertiary}, ${BRAND_COLORS.primary})`,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              color: 'white'
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              {rankingMetric === 'payrollDept'
                ? 'Top Departments by Payroll'
                : rankingMetric === 'payrollEmployee'
                  ? 'Top Employees by Payroll'
                  : rankingMetric && rankingMetric.startsWith('ap')
                    ? `Top Vendors by ${rankingLabels[rankingMetric]}`
                    : `Top Customers by ${rankingLabels[rankingMetric]}`}
            </h2>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>
              {reportType === "ar" || reportType === "ap" ? "As of Today" : `${getMonthName(month)} ${year}`}
            </p>
          </div>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
            {rankedProperties.map((p, idx) => (
              <li
                key={p.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${BRAND_COLORS.gray[200]}`
                }}
              >
                <span style={{ fontWeight: '600' }}>{idx + 1}. {p.name}</span>
                <span style={{ fontWeight: '600', color: BRAND_COLORS.accent }}>
                  {formatRankingValue(p)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {view === "report" && (
        <div>
          <button 
            onClick={back}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              fontSize: '16px',
              color: BRAND_COLORS.accent,
              marginBottom: '20px',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={20} style={{ marginRight: '4px' }} /> 
            Back to {reportType === "payroll" ? "Departments" : reportType === "ap" ? "Vendors" : "Customers"}
          </button>
          
          <div style={{
            background: `linear-gradient(135deg, ${BRAND_COLORS.tertiary}, ${BRAND_COLORS.primary})`,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            color: 'white'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              {selectedProperty || "Company Total"} - {reportType === "pl" ? "P&L Statement" : reportType === "cf" ? "Cash Flow Statement" : reportType === "payroll" ? "Payroll Statement" : reportType === "ap" ? "A/P Aging" : "A/R Aging"}
            </h2>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>
              {reportType === "ar" || reportType === "ap" ? "As of Today" : `${getMonthName(month)} ${year}`}
            </p>
          </div>

          {reportType === "pl" ? (
            <>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${BRAND_COLORS.gray[200]}`
                }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  color: BRAND_COLORS.success,
                  borderBottom: `2px solid ${BRAND_COLORS.success}`,
                  paddingBottom: '8px'
                }}>
                  Revenue
                </h3>
                {plData.revenue.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => handleCategory(cat.name, "revenue")}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      background: BRAND_COLORS.gray[50],
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderColor = BRAND_COLORS.primary;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = BRAND_COLORS.gray[50];
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: BRAND_COLORS.success }}>
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${BRAND_COLORS.gray[200]}`
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  color: BRAND_COLORS.warning,
                  borderBottom: `2px solid ${BRAND_COLORS.warning}`,
                  paddingBottom: '8px'
                }}>
                  Cost of Goods Sold
                </h3>
                {plData.cogs.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => handleCategory(cat.name, "cogs")}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      background: BRAND_COLORS.gray[50],
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#fff7ed';
                      e.currentTarget.style.borderColor = BRAND_COLORS.warning;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = BRAND_COLORS.gray[50];
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: BRAND_COLORS.warning }}>
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${BRAND_COLORS.gray[200]}`
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  color: BRAND_COLORS.danger,
                  borderBottom: `2px solid ${BRAND_COLORS.danger}`,
                  paddingBottom: '8px'
                }}>
                  Expenses
                </h3>
                {plData.expenses.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => handleCategory(cat.name, "expense")}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      background: BRAND_COLORS.gray[50],
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.borderColor = BRAND_COLORS.danger;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = BRAND_COLORS.gray[50];
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: BRAND_COLORS.danger }}>
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                marginTop: '8px',
                textAlign: 'right',
                fontSize: '16px',
                fontWeight: '600',
                color:
                  plTotals.net >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger,
              }}
            >
              Net Income: {formatCurrency(plTotals.net)}
            </div>
            </>
          ) : reportType === "cf" ? (
            <>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${BRAND_COLORS.gray[200]}`
                }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  color: BRAND_COLORS.primary,
                  borderBottom: `2px solid ${BRAND_COLORS.primary}`,
                  paddingBottom: '8px'
                }}>
                  Operating Activities
                </h3>
                {cfData.operating.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => handleCategory(cat.name, "operating")}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      background: BRAND_COLORS.gray[50],
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderColor = BRAND_COLORS.primary;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = BRAND_COLORS.gray[50];
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: cat.total >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger
                    }}>
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${BRAND_COLORS.gray[200]}`
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  color: BRAND_COLORS.secondary,
                  borderBottom: `2px solid ${BRAND_COLORS.secondary}`,
                  paddingBottom: '8px'
                }}>
                  Financing Activities
                </h3>
                {cfData.financing.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => handleCategory(cat.name, "financing")}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      background: BRAND_COLORS.gray[50],
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = BRAND_COLORS.secondary;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = BRAND_COLORS.gray[50];
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: cat.total >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger
                    }}>
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Investing Activities Section */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${BRAND_COLORS.gray[200]}`
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  color: BRAND_COLORS.warning,
                  borderBottom: `2px solid ${BRAND_COLORS.warning}`,
                  paddingBottom: '8px'
                }}>
                  Investing Activities
                </h3>
                {cfData.investing.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => handleCategory(cat.name, "investing")}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      marginBottom: '8px',
                      background: BRAND_COLORS.gray[50],
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#fff7ed';
                      e.currentTarget.style.borderColor = BRAND_COLORS.warning;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = BRAND_COLORS.gray[50];
                      e.currentTarget.style.borderColor = BRAND_COLORS.gray[200];
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: cat.total >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger
                    }}>
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                marginTop: '8px',
                textAlign: 'right',
                fontSize: '16px',
                fontWeight: '600',
                color:
                  cfTotals.net >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger,
              }}
            >
              Net Cash Flow: {formatCurrency(cfTotals.net)}
            </div>
              </>
            ) : reportType === "payroll" ? (
              <>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${BRAND_COLORS.gray[200]}`
                }}>
                  {Object.entries(employeeBreakdown)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, info]) => (
                      <div
                        key={name}
                        onClick={() => showEmployeeTransactions(name)}
                        style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' }}
                      >
                        <span>{name}</span>
                        <span>{formatCurrency(info.total)}</span>
                      </div>
                    ))}
                </div>
                <div style={{
                  marginTop: '8px',
                  textAlign: 'right',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: BRAND_COLORS.danger,
                }}>
                  Total Payroll: {formatCurrency(payrollTotals)}
                </div>
              </>
            ) : reportType === "ar" ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div onClick={() => showARTransactions('current')} style={{ background: `${BRAND_COLORS.success}20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: BRAND_COLORS.success }}>Current (0-30 Days)</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: BRAND_COLORS.success }}>
                    {formatCurrency((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).current || 0)}
                  </div>
                </div>
                <div onClick={() => showARTransactions('31-60')} style={{ background: `${BRAND_COLORS.warning}20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: BRAND_COLORS.warning }}>31-60 Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: BRAND_COLORS.warning }}>
                    {formatCurrency((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).days30 || 0)}
                  </div>
                </div>
                <div onClick={() => showARTransactions('61-90')} style={{ background: `#f59e0b20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: '#f59e0b' }}>61-90 Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: '#f59e0b' }}>
                    {formatCurrency((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).days60 || 0)}
                  </div>
                </div>
                <div onClick={() => showARTransactions('90+')} style={{ background: `${BRAND_COLORS.danger}20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: BRAND_COLORS.danger }}>90+ Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: BRAND_COLORS.danger }}>
                    {formatCurrency(((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).days90 || 0) + ((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).over90 || 0))}
                  </div>
                </div>
              </div>
            ) : reportType === "ap" ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div onClick={() => showAPTransactions('current')} style={{ background: `${BRAND_COLORS.success}20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: BRAND_COLORS.success }}>Current (0-30 Days)</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: BRAND_COLORS.success }}>
                    {formatCurrency((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).current || 0)}
                  </div>
                </div>
                <div onClick={() => showAPTransactions('31-60')} style={{ background: `${BRAND_COLORS.warning}20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: BRAND_COLORS.warning }}>31-60 Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: BRAND_COLORS.warning }}>
                    {formatCurrency((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).days30 || 0)}
                  </div>
                </div>
                <div onClick={() => showAPTransactions('61-90')} style={{ background: `#f59e0b20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: '#f59e0b' }}>61-90 Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: '#f59e0b' }}>
                    {formatCurrency((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).days60 || 0)}
                  </div>
                </div>
                <div onClick={() => showAPTransactions('90+')} style={{ background: `${BRAND_COLORS.danger}20`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '600', color: BRAND_COLORS.danger }}>90+ Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', textAlign: 'right', color: BRAND_COLORS.danger }}>
                    {formatCurrency(((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).days90 || 0) + ((selectedProperty ? properties.find(p=>p.name===selectedProperty) : companyTotals).over90 || 0))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

      {view === "detail" && (
        <div>
          <button
            onClick={back}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              fontSize: '16px',
              color: BRAND_COLORS.accent,
              marginBottom: '20px',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={20} style={{ marginRight: '4px' }} />
            Back to {reportType === "pl" ? "P&L" : reportType === "cf" ? "Cash Flow" : reportType === "payroll" ? "Payroll" : reportType === "ap" ? "A/P" : "A/R"}
          </button>

          {reportType === "ar" ? (
            <>
              <div style={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.accent}, ${BRAND_COLORS.secondary})`,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                color: 'white'
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {bucketLabels[selectedCategory || ""]}
                </h2>
                <p style={{ fontSize: '14px', opacity: 0.9 }}>
                  Invoice Details • As of Today
                </p>
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredARTransactions.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '4px' }}>
                      <span>{t.invoiceNumber} - {t.customer}</span>
                      <span style={{ color: getAgingColor(t.daysOutstanding) }}>{formatCurrency(t.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                      <span>
                        {new Date(t.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {" "}• Due {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ color: getAgingColor(t.daysOutstanding), fontWeight: '600' }}>
                        {t.daysOutstanding} days
                      </span>
                    </div>
                    {t.memo && <div style={{ fontSize: '12px', marginTop: '4px' }}>{t.memo}</div>}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: BRAND_COLORS.primary,
                }}
              >
                Total Outstanding: {formatCurrency(filteredARTotal)}
              </div>
            </>
          ) : reportType === "ap" ? (
            <>
              <div style={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.accent}, ${BRAND_COLORS.secondary})`,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                color: 'white'
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {bucketLabels[selectedCategory || ""]}
                </h2>
                <p style={{ fontSize: '14px', opacity: 0.9 }}>
                  Bill Details • As of Today
                </p>
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredAPTransactions.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '4px' }}>
                      <span>{t.billNumber} - {t.vendor}</span>
                      <span style={{ color: getAgingColor(t.daysOutstanding) }}>{formatCurrency(t.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                      <span>
                        {new Date(t.billDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {" "}• Due {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ color: getAgingColor(t.daysOutstanding), fontWeight: '600' }}>
                        {t.daysOutstanding} days
                      </span>
                    </div>
                    {t.memo && <div style={{ fontSize: '12px', marginTop: '4px' }}>{t.memo}</div>}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: BRAND_COLORS.primary,
                }}
              >
                Total Outstanding: {formatCurrency(filteredAPTotal)}
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.accent}, ${BRAND_COLORS.secondary})`,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                color: 'white'
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {selectedCategory}
                </h2>
                <p style={{ fontSize: '14px', opacity: 0.9 }}>
                  Transaction Details • {getMonthName(month)} {year}
                </p>
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                {transactions.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                      cursor: reportType === 'payroll' ? 'default' : 'pointer'
                    }}
                    onClick={reportType === 'payroll' ? undefined : () => openJournalEntry(t.entryNumber)}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600' }}>DATE</div>
                      <div style={{ fontWeight: '600' }}>PAYEE/CUSTOMER</div>
                      <div style={{ fontWeight: '600' }}>INVOICE #</div>
                      <div style={{ fontWeight: '600' }}>MEMO</div>
                      <div style={{ fontWeight: '600', textAlign: 'right' }}>AMOUNT</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div>
                        {t.payee && <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>{t.payee}</div>}
                        {t.customer && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.customer}</div>}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569' }}>
                        {t.invoiceNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{t.memo}</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', textAlign: 'right', color: t.amount >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger }}>
                        {formatCurrency(t.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: transactionTotal >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger
                }}
              >
                {reportType === "pl"
                  ? "Total Net Income"
                  : reportType === "cf"
                  ? "Total Net Cash Flow"
                  : reportType === "payroll"
                  ? "Total Payroll"
                  : "Total"}: {formatCurrency(transactionTotal)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Journal Modal */}
      {showJournalModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: `1px solid ${BRAND_COLORS.gray[200]}`,
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>
                {journalTitle}
              </h3>
              <button
                onClick={() => setShowJournalModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X />
              </button>
            </div>
            <div style={{ overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#475569' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#475569' }}>Account</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#475569' }}>Memo</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#475569' }}>
                      {reportType === "ap" ? "Vendor" : "Customer"}
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#475569' }}>Debit</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#475569' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntryLines.map((line, idx) => (
                    <tr key={idx} style={{ borderTop: `1px solid ${BRAND_COLORS.gray[100]}` }}>
                      <td style={{ padding: '8px', fontSize: '12px', color: '#475569' }}>{line.customer || ''}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: BRAND_COLORS.danger }}>
                        {formatCurrency(Number(line.debit || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: BRAND_COLORS.success }}>
                        {formatCurrency(Number(line.credit || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AI CFO Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(10px)'
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))',
              borderRadius: '24px',
              padding: '32px',
              margin: '20px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(20px)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
                  borderRadius: '12px',
                  padding: '8px',
                  boxShadow: `0 4px 16px ${BRAND_COLORS.primary}40`
                }}>
                  <Bot size={20} style={{ color: 'white' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: BRAND_COLORS.accent }}>
                    AI CFO
                  </h3>
                  <p style={{ fontSize: '12px', margin: 0, color: '#64748b' }}>
                    Your Financial Assistant
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '24px' }}>
              {isListening ? (
                <div>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.tertiary})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    animation: 'pulse 2s infinite',
                    boxShadow: `0 0 30px ${BRAND_COLORS.primary}60`
                  }}>
                    <Mic size={32} style={{ color: 'white' }} />
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: '600', color: BRAND_COLORS.primary, margin: 0 }}>
                    Listening...
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                    Ask me about your financial data
                  </p>
                </div>
              ) : isProcessing ? (
                <div>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${BRAND_COLORS.warning}, #f59e0b)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    animation: 'pulse 1.5s infinite',
                    boxShadow: '0 0 30px rgba(245, 158, 11, 0.6)'
                  }}>
                    <MessageCircle size={32} style={{ color: 'white' }} />
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: '600', color: BRAND_COLORS.warning, margin: 0 }}>
                    Processing...
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                    Analyzing your request
                  </p>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${BRAND_COLORS.gray[200]}, ${BRAND_COLORS.gray[100]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      border: `3px solid ${BRAND_COLORS.primary}`
                    }}
                  >
                    <Mic size={32} style={{ color: BRAND_COLORS.primary }} />
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: '600', color: BRAND_COLORS.accent, margin: 0 }}>
                    Ready to Help
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                    Hold the button to ask a question
                  </p>
                </div>
              )}
            </div>

            {/* Transcript */}
            {transcript && (
              <div style={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                border: `1px solid ${BRAND_COLORS.gray[200]}`,
                textAlign: 'left'
              }}>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px', fontWeight: '600' }}>
                  You said:
                </p>
                <p style={{ fontSize: '14px', color: BRAND_COLORS.accent, margin: 0, fontStyle: 'italic' }}>
                  "{transcript}"
                </p>
              </div>
            )}

            {/* Response */}
            {response && (
              <div style={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.primary}10, ${BRAND_COLORS.tertiary}05)`,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                border: `1px solid ${BRAND_COLORS.primary}30`,
                textAlign: 'left'
              }}>
                <p style={{ fontSize: '12px', color: BRAND_COLORS.primary, margin: '0 0 8px', fontWeight: '600' }}>
                  AI CFO:
                </p>
                <p style={{ fontSize: '14px', color: BRAND_COLORS.accent, margin: 0, lineHeight: '1.5' }}>
                  {response}
                </p>
              </div>
            )}

            {/* Example Questions */}
            {!transcript && !response && (
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                border: `1px solid ${BRAND_COLORS.gray[200]}`,
                textAlign: 'left'
              }}>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px', fontWeight: '600' }}>
                  Try asking:
                </p>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <p style={{ fontSize: '13px', color: BRAND_COLORS.accent, margin: 0, padding: '8px', background: 'rgba(255,255,255,0.8)', borderRadius: '6px' }}>
                    "What's our total revenue this month?"
                  </p>
                  <p style={{ fontSize: '13px', color: BRAND_COLORS.accent, margin: 0, padding: '8px', background: 'rgba(255,255,255,0.8)', borderRadius: '6px' }}>
                    "Which customer has the highest profit margin?"
                  </p>
                  <p style={{ fontSize: '13px', color: BRAND_COLORS.accent, margin: 0, padding: '8px', background: 'rgba(255,255,255,0.8)', borderRadius: '6px' }}>
                    "Show me overdue receivables"
                  </p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
              Hold the microphone button below to speak, then release to stop
            </p>

            {/* Microphone Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <div
                onPointerDown={startListening}
                onPointerUp={stopListening}
                onPointerLeave={stopListening}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: isListening
                    ? `linear-gradient(135deg, ${BRAND_COLORS.tertiary}, ${BRAND_COLORS.primary})`
                    : `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isListening
                    ? `0 8px 32px ${BRAND_COLORS.primary}60, 0 0 0 8px ${BRAND_COLORS.primary}20`
                    : `0 8px 32px ${BRAND_COLORS.primary}40`,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isListening ? 'scale(1.1)' : 'scale(1)',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none'
                }}
              >
                {isListening ? (
                  <div style={{ position: 'relative' }}>
                    <Mic size={28} style={{ color: 'white' }} />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.6)',
                        animation: 'ripple 1.5s infinite'
                      }}
                    />
                  </div>
                ) : (
                  <Mic size={28} style={{ color: 'white' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {productionModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1200,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setProductionModalOpen(false);
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setProductionModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: BRAND_COLORS.accent, marginBottom: '4px' }}>
              Log Production
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Capture daily production tonnage, revenue, and supporting media.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleProductionSubmit();
              }}
              style={{ display: 'grid', gap: '16px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={productionForm.date}
                  onChange={(event) => handleProductionFieldChange('date', event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: `1px solid ${productionErrors.date ? BRAND_COLORS.danger : BRAND_COLORS.gray[200]}`,
                    fontSize: '14px',
                  }}
                />
                {productionErrors.date && (
                  <div style={{ color: BRAND_COLORS.danger, fontSize: '12px', marginTop: '4px' }}>
                    {productionErrors.date}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Tonnage (tons)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={productionForm.tonnage}
                    onChange={(event) => handleProductionFieldChange('tonnage', event.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1px solid ${productionErrors.tonnage ? BRAND_COLORS.danger : BRAND_COLORS.gray[200]}`,
                      fontSize: '14px',
                    }}
                  />
                  {productionErrors.tonnage && (
                    <div style={{ color: BRAND_COLORS.danger, fontSize: '12px', marginTop: '4px' }}>
                      {productionErrors.tonnage}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Price per Ton ($)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={productionForm.pricePerTon}
                    onChange={(event) => handleProductionFieldChange('pricePerTon', event.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1px solid ${productionErrors.pricePerTon ? BRAND_COLORS.danger : BRAND_COLORS.gray[200]}`,
                      fontSize: '14px',
                    }}
                  />
                  {productionErrors.pricePerTon && (
                    <div style={{ color: BRAND_COLORS.danger, fontSize: '12px', marginTop: '4px' }}>
                      {productionErrors.pricePerTon}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Client
                </label>
                <select
                  value={productionForm.client}
                  onChange={(event) => handleProductionFieldChange('client', event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: `1px solid ${productionErrors.client ? BRAND_COLORS.danger : BRAND_COLORS.gray[200]}`,
                    fontSize: '14px',
                    background: 'white',
                  }}
                >
                  {PRODUCTION_CLIENTS.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
                {productionForm.client === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter client name"
                    value={productionForm.customClient}
                    onChange={(event) => handleProductionFieldChange('customClient', event.target.value)}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1px solid ${productionErrors.client ? BRAND_COLORS.danger : BRAND_COLORS.gray[200]}`,
                      fontSize: '14px',
                    }}
                  />
                )}
                {productionErrors.client && (
                  <div style={{ color: BRAND_COLORS.danger, fontSize: '12px', marginTop: '4px' }}>
                    {productionErrors.client}
                  </div>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Total Amount
                  </span>
                  <div style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: `1px solid ${BRAND_COLORS.gray[200]}`,
                    background: `${BRAND_COLORS.gray[50]}`,
                    fontWeight: 600,
                    fontSize: '16px',
                    color: BRAND_COLORS.accent,
                  }}>
                    {formatCurrencyWithCents(productionCalculatedTotal)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Project / Notes
                  </span>
                  <textarea
                    rows={3}
                    placeholder="Optional project or delivery notes"
                    value={productionForm.projectNotes}
                    onChange={(event) => handleProductionFieldChange('projectNotes', event.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      fontSize: '14px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Photo Evidence
                </span>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                }}>
                  <button
                    type="button"
                    onClick={triggerProductionPhotoPicker}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: `1px dashed ${BRAND_COLORS.primary}`,
                      background: `${BRAND_COLORS.primary}10`,
                      color: BRAND_COLORS.primary,
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Camera size={18} />
                    {productionPhoto ? 'Retake Photo' : 'Add Photo'}
                  </button>
                  <input
                    ref={productionPhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleProductionPhotoChange}
                  />
                  {productionPhotoLoading && (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Processing photo...</span>
                  )}
                </div>
                {productionPhoto && (
                  <div style={{
                    marginTop: '12px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                  }}>
                    <img
                      src={productionPhoto.base64}
                      alt="Production preview"
                      style={{
                        width: '96px',
                        height: '96px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: `1px solid ${BRAND_COLORS.gray[200]}`,
                      }}
                    />
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={triggerProductionPhotoPicker}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${BRAND_COLORS.primary}55`,
                          background: 'white',
                          color: BRAND_COLORS.primary,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={removeProductionPhoto}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${BRAND_COLORS.danger}44`,
                          background: `${BRAND_COLORS.danger}08`,
                          color: BRAND_COLORS.danger,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={productionSubmitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: productionSubmitting ? 'not-allowed' : 'pointer',
                    opacity: productionSubmitting ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {productionSubmitting && (
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  )}
                  {productionSubmitting ? 'Saving Entry' : 'Save Production Log'}
                </button>
                <button
                  type="button"
                  onClick={() => setProductionModalOpen(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: `1px solid ${BRAND_COLORS.gray[200]}`,
                    background: 'white',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI CFO Button */}
      {!showModal && (
        <div
          ref={buttonRef}
          onClick={openAIModal}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary})`,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 32px ${BRAND_COLORS.primary}40`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1000,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = `0 12px 40px ${BRAND_COLORS.primary}50`;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = `0 8px 32px ${BRAND_COLORS.primary}40`;
          }}
        >
          <Bot size={28} style={{ color: 'white' }} />
        </div>
      )}
    </div>
  );
}
