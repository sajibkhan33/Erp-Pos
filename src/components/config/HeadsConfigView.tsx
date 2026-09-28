import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { AccountHead, AccountType, RestaurantProfile, CommissionAgent } from '../../types';
import { PrintersConfigView } from './PrintersConfigView';
import { PrintTemplatesConfigView } from './PrintTemplatesConfigView';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Grid, 
  Users, 
  Truck, 
  Layers, 
  Tag, 
  Wallet, 
  UserCheck, 
  Utensils, 
  BookOpen, 
  Search, 
  MapPin, 
  Building2,
  Upload,
  Image as ImageIcon,
  Coffee,
  ChefHat,
  Crown,
  Store,
  Flame,
  Sparkles,
  CheckCircle2,
  Phone,
  Mail,
  FileText,
  DollarSign,
  Camera,
  Globe,
  RefreshCw,
  Receipt,
  Percent,
  Sliders,
  Printer,
  AlertTriangle
} from 'lucide-react';

export const HeadsConfigView: React.FC = () => {
  const { 
    data, 
    addConfigItem, 
    editConfigItem, 
    removeConfigItem,
    addAccountHead,
    editAccountHead,
    deleteAccountHead,
    addCustomTable,
    editCustomTable,
    deleteCustomTable,
    addTableZone,
    editTableZone,
    deleteTableZone,
    updateRestaurantProfile,
    addCommissionAgent,
    updateCommissionAgent,
    deleteCommissionAgent,
    language,
    t
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState<'profile' | 'heads' | 'coa' | 'agents' | 'printers' | 'templates'>('profile');

  // Commission Agent Modal State
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CommissionAgent | null>(null);
  const [agentForm, setAgentForm] = useState<{
    id?: string;
    name: string;
    commissionPercent: number;
    priceListMultiplier: number;
    contactPerson: string;
    phone: string;
    isActive: boolean;
  }>({
    name: '',
    commissionPercent: 15,
    priceListMultiplier: 1.15,
    contactPerson: '',
    phone: '',
    isActive: true
  });

  // Restaurant Profile & Logo State
  const [profileForm, setProfileForm] = useState<RestaurantProfile>({
    name: data.restaurantProfile?.name || 'Restaurant POS',
    tagline: data.restaurantProfile?.tagline || 'Restaurant POS & Recipe BOM ERP',
    logoUrl: data.restaurantProfile?.logoUrl || '',
    logoType: data.restaurantProfile?.logoType || 'preset',
    presetIcon: data.restaurantProfile?.presetIcon || 'flame',
    address: data.restaurantProfile?.address || 'House #42, Road #11, Block D, Banani, Dhaka-1213',
    phone: data.restaurantProfile?.phone || '+880 1700-000000',
    email: data.restaurantProfile?.email || 'info@restaurant.com',
    binOrVat: data.restaurantProfile?.binOrVat || '0029381-01',
    currencySymbol: data.restaurantProfile?.currencySymbol || '৳'
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const presetIcons = [
    { id: 'flame', label: 'Flame / Grill', icon: Flame, color: 'from-amber-600 to-amber-400' },
    { id: 'coffee', label: 'Coffee & Cafe', icon: Coffee, color: 'from-amber-700 to-yellow-600' },
    { id: 'utensils', label: 'Dine & Fork', icon: Utensils, color: 'from-emerald-600 to-teal-500' },
    { id: 'chef', label: 'Chef Hat', icon: ChefHat, color: 'from-indigo-600 to-violet-500' },
    { id: 'crown', label: 'VIP Lounge', icon: Crown, color: 'from-amber-500 to-yellow-400' },
    { id: 'store', label: 'Storefront', icon: Store, color: 'from-blue-600 to-cyan-500' },
    { id: 'sparkles', label: 'Premium Gold', icon: Sparkles, color: 'from-rose-600 to-amber-500' },
  ];

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Logo file size must be less than 3 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Str = uploadEvent.target?.result as string;
        setProfileForm(prev => ({
          ...prev,
          logoUrl: base64Str,
          logoType: 'custom'
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateRestaurantProfile(profileForm);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Input states for Master Heads
  const [inputVal, setInputVal] = useState<Record<string, string>>({
    tables: '',
    tableZones: '',
    waiters: '',
    vendors: '',
    purchaseCategories: '',
    departments: '',
    menuCategories: '',
    expenseHeads: '',
    customers: ''
  });

  const [selectedZoneForNewTable, setSelectedZoneForNewTable] = useState<string>(
    data.tableZones?.[0] || 'Floor 1'
  );

  // Inline editing state for Master Heads: { sectionId, index, text, extraZone }
  const [editingItem, setEditingItem] = useState<{ sectionId: string; index: number; text: string; extraZone?: string } | null>(null);

  // Search filter for COA
  const [coaFilter, setCoaFilter] = useState<'ALL' | AccountType>('ALL');
  const [coaSearch, setCoaSearch] = useState('');

  // Modal states for Chart of Accounts
  const [isCoaModalOpen, setIsCoaModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountHead | null>(null);
  const [coaForm, setCoaForm] = useState<{
    code: string;
    name: string;
    type: AccountType;
    category: string;
    balance: number;
  }>({
    code: '',
    name: '',
    type: 'EXPENSE',
    category: 'Operating Expenses',
    balance: 0
  });

  const [justAddedSec, setJustAddedSec] = useState<string | null>(null);

  // In-app Delete Confirmation Modal State (replaces blocked native confirm)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    itemDescription: string;
    actionType: string;
    onConfirm: () => void;
  } | null>(null);

  const allZones = data.tableZones && data.tableZones.length > 0
    ? data.tableZones
    : ['Floor 1', 'Floor 2', 'VIP Lounge', 'Rooftop Garden'];

  const handleAdd = (type: string) => {
    const val = inputVal[type]?.trim();
    if (!val) return;
    if (type === 'tables') {
      addCustomTable(val, selectedZoneForNewTable || allZones[0]);
    } else if (type === 'tableZones') {
      addTableZone(val);
    } else {
      addConfigItem(type as any, val);
    }
    setInputVal(prev => ({ ...prev, [type]: '' }));
    setJustAddedSec(type);
    setTimeout(() => setJustAddedSec(null), 2500);
  };

  const handleStartEdit = (sectionId: string, index: number, currentText: string, currentZone?: string) => {
    setEditingItem({ sectionId, index, text: currentText, extraZone: currentZone || allZones[0] });
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editingItem.text.trim()) return;
    if (editingItem.sectionId === 'tables') {
      editCustomTable(editingItem.index, editingItem.text.trim(), editingItem.extraZone);
    } else if (editingItem.sectionId === 'tableZones') {
      const oldZone = (data.tableZones || [])[editingItem.index];
      if (oldZone) editTableZone(oldZone, editingItem.text.trim());
    } else {
      editConfigItem(editingItem.sectionId as any, editingItem.index, editingItem.text.trim());
    }
    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleDelete = (sectionId: string, index: number, name: string) => {
    const sectionObj = sections.find(s => s.id === sectionId);
    const secTitle = sectionObj?.title || 'Configuration Item';
    setDeleteConfirm({
      title: `Delete "${name}"?`,
      itemDescription: `Are you sure you want to remove this entry from ${secTitle}?`,
      actionType: secTitle,
      onConfirm: () => {
        if (sectionId === 'tables') {
          deleteCustomTable(index);
        } else if (sectionId === 'tableZones') {
          deleteTableZone(name);
        } else {
          removeConfigItem(sectionId as any, index);
        }
        setDeleteConfirm(null);
      }
    });
  };

  // COA modal handlers
  const handleOpenAddCoa = () => {
    setEditingAccount(null);
    setCoaForm({
      code: '',
      name: '',
      type: 'EXPENSE',
      category: 'Operating Expenses',
      balance: 0
    });
    setIsCoaModalOpen(true);
  };

  const handleOpenEditCoa = (acc: AccountHead) => {
    setEditingAccount(acc);
    setCoaForm({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      category: acc.category,
      balance: acc.balance || 0
    });
    setIsCoaModalOpen(true);
  };

  const handleSaveCoa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coaForm.name.trim() || !coaForm.code.trim()) {
      alert('Please enter both Account Code and Account Title.');
      return;
    }

    if (editingAccount) {
      editAccountHead(editingAccount.id, {
        code: coaForm.code.trim(),
        name: coaForm.name.trim(),
        type: coaForm.type,
        category: coaForm.category.trim(),
        balance: Number(coaForm.balance) || 0
      });
    } else {
      addAccountHead({
        code: coaForm.code.trim(),
        name: coaForm.name.trim(),
        type: coaForm.type,
        category: coaForm.category.trim(),
        balance: Number(coaForm.balance) || 0
      });
    }
    setIsCoaModalOpen(false);
  };

  const handleDeleteCoa = (acc: AccountHead) => {
    setDeleteConfirm({
      title: `Delete Account Head "${acc.code} - ${acc.name}"?`,
      itemDescription: `This will permanently remove the ledger account head (${acc.type} • ${acc.category}) from the Chart of Accounts.`,
      actionType: 'Chart of Accounts',
      onConfirm: () => {
        deleteAccountHead(acc.id);
        setDeleteConfirm(null);
      }
    });
  };

  // Commission Agent Handlers
  const handleOpenAddAgent = () => {
    setEditingAgent(null);
    setAgentForm({
      name: '',
      commissionPercent: 15,
      priceListMultiplier: 1.15,
      contactPerson: '',
      phone: '',
      isActive: true
    });
    setIsAgentModalOpen(true);
  };

  const handleOpenEditAgent = (agent: CommissionAgent) => {
    setEditingAgent(agent);
    setAgentForm({
      id: agent.id,
      name: agent.name,
      commissionPercent: agent.commissionPercent,
      priceListMultiplier: agent.priceListMultiplier || 1.15,
      contactPerson: agent.contactPerson || '',
      phone: agent.phone || '',
      isActive: agent.isActive !== undefined ? agent.isActive : true
    });
    setIsAgentModalOpen(true);
  };

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentForm.name.trim()) return;

    if (editingAgent) {
      updateCommissionAgent(editingAgent.id, {
        name: agentForm.name.trim(),
        commissionPercent: Number(agentForm.commissionPercent) || 0,
        priceListMultiplier: Number(agentForm.priceListMultiplier) || 1.0,
        contactPerson: agentForm.contactPerson.trim(),
        phone: agentForm.phone.trim(),
        isActive: agentForm.isActive
      });
    } else {
      addCommissionAgent({
        name: agentForm.name.trim(),
        commissionPercent: Number(agentForm.commissionPercent) || 0,
        priceListMultiplier: Number(agentForm.priceListMultiplier) || 1.0,
        contactPerson: agentForm.contactPerson.trim(),
        phone: agentForm.phone.trim(),
        isActive: agentForm.isActive
      });
    }
    setIsAgentModalOpen(false);
  };

  const handleDeleteAgent = (agent: CommissionAgent) => {
    setDeleteConfirm({
      title: `Delete Commission Agent "${agent.name}"?`,
      itemDescription: `This will remove ${agent.name} (${agent.commissionPercent}% commission discount) from delivery channels and POS order billing.`,
      actionType: 'Commission Agent',
      onConfirm: () => {
        deleteCommissionAgent(agent.id);
        setDeleteConfirm(null);
      }
    });
  };

  const sections = [
    {
      id: 'tableZones',
      title: 'Floor Plan Zones',
      desc: 'Floor 1, Floor 2, VIP Lounge, Rooftop Garden',
      icon: MapPin,
      color: 'text-amber-700 bg-amber-50 border-amber-300',
      items: (data.tableZones && data.tableZones.length > 0) ? data.tableZones : ['Floor 1', 'Floor 2', 'VIP Lounge', 'Rooftop Garden']
    },
    {
      id: 'tables',
      title: 'Dining Tables',
      desc: 'Floor layout tables with assigned zones',
      icon: Grid,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      items: (data.tables || []).map(t => t.name),
      tableObjs: data.tables || []
    },
    {
      id: 'waiters',
      title: 'Waiters & Service Staff',
      desc: 'Floor stewards and order booking staff',
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      items: data.waiters || []
    },
    {
      id: 'vendors',
      title: 'Vendors & Suppliers',
      desc: 'Poultry, meat, grocery, and packaging suppliers',
      icon: Truck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      items: data.vendors || []
    },
    {
      id: 'purchaseCategories',
      title: 'Raw Material Categories',
      desc: 'Grocery, Meat, Dairy, Bakery, Beverage ingredients',
      icon: Layers,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      items: data.purchaseCategories || []
    },
    {
      id: 'departments',
      title: 'Kitchen Departments',
      desc: 'Main Kitchen, Rooftop BBQ, Coffee & Mocktail Counter',
      icon: Utensils,
      color: 'text-violet-600 bg-violet-50 border-violet-200',
      items: data.departments || []
    },
    {
      id: 'menuCategories',
      title: 'Menu Categories',
      desc: 'Appetizers, Steaks, Biryani, Drinks, Desserts',
      icon: Tag,
      color: 'text-pink-600 bg-pink-50 border-pink-200',
      items: data.menuCategories || []
    },
    {
      id: 'expenseHeads',
      title: 'Head of Cost / Expense Heads',
      desc: 'Staff salary, cleaning, electricity, gas, conveyance',
      icon: Wallet,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      items: data.expenseHeads || []
    },
    {
      id: 'customers',
      title: 'Customer & Client Accounts',
      desc: 'Regular, corporate, and VIP customer accounts',
      icon: UserCheck,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      items: data.customers || []
    }
  ];

  const chartList = data.chartOfAccounts || [];
  const filteredAccounts = chartList.filter(acc => {
    const matchesType = coaFilter === 'ALL' || acc.type === coaFilter;
    const matchesSearch = !coaSearch || 
      acc.name.toLowerCase().includes(coaSearch.toLowerCase()) || 
      acc.code.toLowerCase().includes(coaSearch.toLowerCase()) ||
      acc.category.toLowerCase().includes(coaSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getAccountTypeBadge = (type: AccountType) => {
    switch(type) {
      case 'ASSET': return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Asset (1000)</span>;
      case 'LIABILITY': return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Liability (2000)</span>;
      case 'EQUITY': return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Equity (3000)</span>;
      case 'REVENUE': return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Revenue (4000)</span>;
      case 'EXPENSE': return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Expense (5000/6000)</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Master Configurations & Chart of Accounts
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage Floor Zones, Tables, Staff, Vendors, Categories, Expense Heads, and Financial Ledger Accounts with Add & Edit capability
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-[#004b9b] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>'Restaurant Profile & Logo'</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('heads')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'heads'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Master Heads (9 Modules)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('coa')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'coa'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Chart of Accounts ({chartList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'agents'
                ? 'bg-[#004b9b] text-white font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Commission Agents / Delivery ({(data.commissionAgents || []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('printers')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'printers'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Printers & Routing ({(data.printers || []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Bill & KOT Templates ({(data.printTemplates || []).length})</span>
          </button>
        </div>
      </div>

      {/* Restaurant Profile & Logo Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in">
          {savedSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 font-bold text-sm shadow-xs animate-in slide-in-from-top">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>
                  {language === 'bn' 
                    ? 'Restaurant profile and logo updated successfully!' 
                    : 'Restaurant Profile, Logo & Branding saved successfully!'}
                </span>
              </div>
              <span className="text-xs bg-emerald-200/80 px-2.5 py-1 rounded-lg">Active Everywhere</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Col: Logo & Visual Assets (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Logo Setup Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      'Restaurant Logo & Icon'
                    </h3>
                    <p className="text-xs text-slate-500">
                      'Upload custom brand logo or select preset icon'
                    </p>
                  </div>
                </div>

                {/* Current Logo Preview Box */}
                <div className="p-4 bg-slate-950 rounded-2xl text-center border border-slate-800 flex flex-col items-center justify-center gap-3">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-1 flex items-center justify-center shadow-xl shadow-amber-500/20 text-slate-950 overflow-hidden relative group">
                    {profileForm.logoUrl ? (
                      <img 
                        src={profileForm.logoUrl} 
                        alt="Restaurant Logo Preview" 
                        className="w-full h-full object-contain rounded-xl bg-slate-900"
                      />
                    ) : profileForm.presetIcon === 'coffee' ? (
                      <Coffee className="w-12 h-12 text-slate-950" />
                    ) : profileForm.presetIcon === 'utensils' ? (
                      <Utensils className="w-12 h-12 text-slate-950" />
                    ) : profileForm.presetIcon === 'chef' ? (
                      <ChefHat className="w-12 h-12 text-slate-950" />
                    ) : profileForm.presetIcon === 'crown' ? (
                      <Crown className="w-12 h-12 text-slate-950" />
                    ) : profileForm.presetIcon === 'store' ? (
                      <Store className="w-12 h-12 text-slate-950" />
                    ) : profileForm.presetIcon === 'sparkles' ? (
                      <Sparkles className="w-12 h-12 text-slate-950" />
                    ) : (
                      <Flame className="w-12 h-12 text-slate-950" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base tracking-tight">{profileForm.name || 'Restaurant Name'}</h4>
                    <p className="text-xs text-amber-400 font-medium">{profileForm.tagline || 'Tagline'}</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                      {profileForm.logoUrl ? 'Custom Image Logo Active' : `Preset: ${profileForm.presetIcon.toUpperCase()}`}
                    </span>
                  </div>
                </div>

                {/* Option 1: File Upload */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>'1. Upload Logo from Device'</span>
                    <span className="text-[10px] text-slate-400 font-normal">PNG, JPG, WebP, SVG (&lt; 3MB)</span>
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 rounded-2xl cursor-pointer transition text-center group">
                    <Upload className="w-6 h-6 text-amber-600 group-hover:scale-110 transition mb-1" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-amber-800">
                      'Click or Drag image file to upload'
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      'Will render on Sidebar, Header & Customer Thermal Bills'
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Option 2: Image URL */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    '2. Or Paste Online Image URL'
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={profileForm.logoUrl}
                        onChange={e => setProfileForm(prev => ({ ...prev, logoUrl: e.target.value, logoType: e.target.value ? 'custom' : 'preset' }))}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    {profileForm.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileForm(prev => ({ ...prev, logoUrl: '', logoType: 'preset' }))}
                        className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition cursor-pointer"
                        title="Remove custom logo and use preset icon"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Option 3: Preset Icons Selector */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    '3. Preset Brand Icons (When no image is uploaded)'
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {presetIcons.map(p => {
                      const IconComp = p.icon;
                      const isSelected = profileForm.presetIcon === p.id && !profileForm.logoUrl;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProfileForm(prev => ({ ...prev, presetIcon: p.id as any, logoUrl: '', logoType: 'preset' }))}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 text-[#004b9b] border-[#004b9b] ring-2 ring-[#004b9b]/20 font-black'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${p.color} text-slate-950 flex items-center justify-center shadow-xs`}>
                            <IconComp className="w-4 h-4 text-slate-950" />
                          </div>
                          <span className="text-[10px] tracking-tight">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Restaurant Identity & Thermal Receipt Live Preview (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Identity Form Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      'Restaurant Profile & Branch Info'
                    </h3>
                    <p className="text-xs text-slate-500">
                      'Used on Customer Bills, Invoices, and Reports'
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      'Restaurant Name' *
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Barcode Cafe Banani"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      'Tagline / Slogan'
                    </label>
                    <input
                      type="text"
                      value={profileForm.tagline}
                      onChange={e => setProfileForm(prev => ({ ...prev, tagline: e.target.value }))}
                      placeholder="Restaurant POS & Recipe BOM ERP"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      'Branch Address'
                    </label>
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={e => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="House #42, Road #11, Block D, Banani, Dhaka-1213"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      'Hotline / Phone'
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+880 1700-000000"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      'Official Email'
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="banani@barcodecafe.com"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'bn' ? 'BIN / VAT Reg No' : 'BIN / VAT Registration No'}
                    </label>
                    <div className="relative">
                      <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={profileForm.binOrVat}
                        onChange={e => setProfileForm(prev => ({ ...prev, binOrVat: e.target.value }))}
                        placeholder="0029381-01"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      'Currency Symbol'
                    </label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={profileForm.currencySymbol}
                        onChange={e => setProfileForm(prev => ({ ...prev, currencySymbol: e.target.value }))}
                        placeholder="৳"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="submit"
                    id="btn-save-restaurant-profile"
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>'Save Restaurant Profile & Logo'</span>
                  </button>
                </div>
              </div>

              {/* Thermal Receipt Live Mockup Preview Card */}
              <div className="p-5 bg-slate-100 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-700" />
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    'Live Thermal Receipt Header Preview'
                  </h4>
                </div>

                <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl font-mono text-center text-xs text-slate-800 shadow-2xs max-w-sm mx-auto">
                  {profileForm.logoUrl && (
                    <div className="flex justify-center mb-1">
                      <img 
                        src={profileForm.logoUrl} 
                        alt="Receipt Logo" 
                        className="h-8 max-w-[120px] object-contain grayscale"
                      />
                    </div>
                  )}
                  <div className="font-extrabold text-sm uppercase text-slate-900 tracking-wide font-sans">
                    {profileForm.name || 'RESTAURANT POS'}
                  </div>
                  <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                    {profileForm.address || 'House #42, Road #11, Block D, Banani, Dhaka'}
                  </div>
                  <div className="text-[9px] text-slate-500 font-sans">
                    Hotline: {profileForm.phone || '+880 1700-000000'} &bull; VAT Reg: {profileForm.binOrVat || '0029381-01'}
                  </div>
                  <div className="mt-1.5 inline-block px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[9px] font-bold uppercase tracking-wider">
                    PAID CASH MEMO #INV-16001
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'heads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-600">
              Click the <span className="inline-flex items-center font-bold text-blue-700"><Edit3 className="w-3 h-3 mx-0.5" /> Edit</span> button on any item to rename or reassign zones, or use the input box below each card to add new items.
            </p>
          </div>

          {/* 9 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sections.map(sec => {
              const Icon = sec.icon;

              return (
                <div 
                  key={sec.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${sec.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900">{sec.title}</h3>
                          <span className="text-[11px] text-slate-500 font-medium">{sec.items.length} records</span>
                        </div>
                      </div>

                      {justAddedSec === sec.id && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 animate-in fade-in flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Added!</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 mb-3 leading-relaxed">{sec.desc}</p>

                    {/* Items List with Edit & Delete */}
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 mb-4 custom-scrollbar">
                      {sec.items.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 font-medium">
                          No items added yet
                        </div>
                      ) : (
                        sec.items.map((item, idx) => {
                          const isEditingThis = editingItem?.sectionId === sec.id && editingItem.index === idx;
                          const tableObj = sec.id === 'tables' ? sec.tableObjs?.[idx] : null;
                          const currentZone = tableObj?.zone || 'Floor 1';

                          if (isEditingThis) {
                            return (
                              <div key={idx} className="p-2 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingItem.text}
                                    onChange={e => setEditingItem({ ...editingItem, text: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    placeholder="Item name..."
                                    className="flex-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                                  />

                                  {sec.id === 'tables' && (
                                    <select
                                      value={editingItem.extraZone}
                                      onChange={e => setEditingItem({ ...editingItem, extraZone: e.target.value })}
                                      className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                                    >
                                      {allZones.map(z => (
                                        <option key={z} value={z}>{z}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Cancel</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={idx}
                              className="group flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-150 text-slate-800 text-xs font-semibold transition"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <span className="truncate">{item}</span>
                                {sec.id === 'tables' && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black shrink-0">
                                    {currentZone}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(sec.id, idx, item, currentZone)}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition"
                                  title="Edit Item"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(sec.id, idx, item)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition"
                                  title="Delete Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Add New Input */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    {sec.id === 'tables' && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">Assign Zone:</span>
                        <select
                          value={selectedZoneForNewTable}
                          onChange={e => setSelectedZoneForNewTable(e.target.value)}
                          className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                        >
                          {allZones.map(z => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={inputVal[sec.id] || ''}
                        onChange={e => setInputVal(prev => ({ ...prev, [sec.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(sec.id)}
                        placeholder={`Add ${sec.title.toLowerCase()}...`}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdd(sec.id)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart of Accounts Tab */}
      {activeTab === 'coa' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code or account..."
                  value={coaSearch}
                  onChange={e => setCoaSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none w-56"
                />
              </div>

              {/* Type Filters */}
              {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCoaFilter(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    coaFilter === type
                      ? 'bg-slate-900 text-amber-400 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type === 'ALL' ? 'All Types' : type}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleOpenAddCoa}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Account Head</span>
            </button>
          </div>

          {/* Table of Accounts */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">Account Code</th>
                    <th className="py-3 px-4">Account Title / Name</th>
                    <th className="py-3 px-4">Account Type</th>
                    <th className="py-3 px-4">Classification / Category</th>
                    <th className="py-3 px-4 text-right">Balance / Opening (৳)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No accounts match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map(acc => (
                      <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {acc.code}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {acc.name}
                        </td>
                        <td className="py-3 px-4">
                          {getAccountTypeBadge(acc.type)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {acc.category}
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                          ৳ {(acc.balance || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCoa(acc)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Account Head"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCoa(acc)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Account Head"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* COA Add / Edit Modal */}
      {isCoaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingAccount ? 'Edit Account Head' : 'Add New Account Head'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure financial chart of account ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCoaModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCoa} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Code *</label>
                <input
                  type="text"
                  required
                  value={coaForm.code}
                  onChange={e => setCoaForm({ ...coaForm, code: e.target.value })}
                  placeholder="e.g. 6050"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Title / Name *</label>
                <input
                  type="text"
                  required
                  value={coaForm.name}
                  onChange={e => setCoaForm({ ...coaForm, name: e.target.value })}
                  placeholder="e.g. Kitchen Maintenance & Gas"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Type *</label>
                  <select
                    value={coaForm.type}
                    onChange={e => setCoaForm({ ...coaForm, type: e.target.value as AccountType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="ASSET">ASSET (1000)</option>
                    <option value="LIABILITY">LIABILITY (2000)</option>
                    <option value="EQUITY">EQUITY (3000)</option>
                    <option value="REVENUE">REVENUE (4000)</option>
                    <option value="EXPENSE">EXPENSE (5000/6000)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Classification Category</label>
                  <input
                    type="text"
                    value={coaForm.category}
                    onChange={e => setCoaForm({ ...coaForm, category: e.target.value })}
                    placeholder="e.g. Operating Expenses"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Opening Balance (৳)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    value={coaForm.balance}
                    onChange={e => setCoaForm({ ...coaForm, balance: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCoaModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingAccount ? 'Update Account' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission Agents / Delivery Portals Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Strip with Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900">{(data.commissionAgents || []).length} Portals</div>
                <div className="text-xs text-slate-500 font-medium">Registered Commission Agents</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-emerald-700">
                  {((data.commissionAgents || []).filter(a => a.isActive !== false)).length} Active
                </div>
                <div className="text-xs text-slate-500 font-medium">Available for POS Orders</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-bold">Manage & Add Portals</div>
                <div className="text-xs text-slate-400">Foodpanda, Pathao, Foodi, etc.</div>
              </div>
              <button
                type="button"
                onClick={handleOpenAddAgent}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Agent</span>
              </button>
            </div>
          </div>

          {/* Agents Table List */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Commission Agents & Multi-Price Configuration</h3>
                <p className="text-xs text-slate-500">
                  When selected as customer or channel at POS, automatic commission discounts apply and menu items reflect their custom price list.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Agent Name / Portal</th>
                    <th className="py-3 px-4 text-center">Commission (%)</th>
                    <th className="py-3 px-4 text-center">Price Multiplier</th>
                    <th className="py-3 px-4">Contact Person / Phone</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(data.commissionAgents || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No commission agents configured. Click "+ Add Agent" to register Foodpanda, Pathao, Foodi, etc.
                      </td>
                    </tr>
                  ) : (
                    (data.commissionAgents || []).map(agent => (
                      <tr key={agent.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                            <span>{agent.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {agent.id}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black rounded-lg text-xs border border-amber-200">
                            {agent.commissionPercent}% Commission
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold rounded-md text-[11px] border border-blue-200">
                            {agent.priceListMultiplier ? `${agent.priceListMultiplier}x` : '1.0x (Standard)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{agent.contactPerson || 'N/A'}</div>
                          <div className="text-[10px] text-slate-500">{agent.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            agent.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {agent.isActive !== false ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAgent(agent)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Agent & Commission Rate"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAgent(agent)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Agent"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Printers (USB & LAN) Tab */}
      {activeTab === 'printers' && (
        <div className="animate-in fade-in">
          <PrintersConfigView />
        </div>
      )}

      {/* Bill & KOT Print Templates Tab */}
      {activeTab === 'templates' && (
        <div className="animate-in fade-in">
          <PrintTemplatesConfigView />
        </div>
      )}

      {/* Commission Agent Add / Edit Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingAgent ? `Edit ${editingAgent.name}` : 'Add Commission Agent / Delivery Portal'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure portal commission rate and selling price multiplier</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAgentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Agent / Portal Name *</label>
                <input
                  type="text"
                  required
                  value={agentForm.name}
                  onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                  placeholder="e.g. Foodpanda, Pathao, Foodi, HungryNaki"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Commission Rate (%) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={agentForm.commissionPercent}
                      onChange={e => setAgentForm({ ...agentForm, commissionPercent: parseFloat(e.target.value) || 0 })}
                      placeholder="20"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-amber-700 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price Multiplier (e.g. 1.2x)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.0"
                    value={agentForm.priceListMultiplier}
                    onChange={e => setAgentForm({ ...agentForm, priceListMultiplier: parseFloat(e.target.value) || 1.0 })}
                    placeholder="1.20"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Manager / Contact</label>
                  <input
                    type="text"
                    value={agentForm.contactPerson}
                    onChange={e => setAgentForm({ ...agentForm, contactPerson: e.target.value })}
                    placeholder="e.g. Mr. Rafiq"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Helpline / Phone</label>
                  <input
                    type="text"
                    value={agentForm.phone}
                    onChange={e => setAgentForm({ ...agentForm, phone: e.target.value })}
                    placeholder="e.g. +880 17..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="agent-active-toggle"
                  checked={agentForm.isActive}
                  onChange={e => setAgentForm({ ...agentForm, isActive: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="agent-active-toggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Active for POS Order Selection
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingAgent ? 'Update Agent' : 'Save Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* In-App Delete Confirmation Modal (Bypasses browser iframe dialog blocking) */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0 border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold uppercase tracking-wider border border-rose-200">
                    {deleteConfirm.actionType}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1.5 leading-snug">
                  {deleteConfirm.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {deleteConfirm.itemDescription}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConfirm.onConfirm();
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
