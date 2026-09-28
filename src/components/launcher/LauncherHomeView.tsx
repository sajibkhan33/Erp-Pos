import React, { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ActiveTab } from '../../types';
import logo4 from '../../image/logo4.png';
import { 
  UtensilsCrossed, 
  BookOpen, 
  Boxes, 
  ShoppingCart, 
  Wallet, 
  Users, 
  BarChart3, 
  Sliders, 
  Sparkles, 
  Power, 
  PlusCircle, 
  Flame, 
  Lock, 
  Search,
  Clock,
  Receipt,
  ChefHat,
  Sun,
  Moon,
  ArrowRightLeft
} from 'lucide-react';

export const LauncherHomeView: React.FC<{ onOpenAiAssistant?: () => void }> = ({
  onOpenAiAssistant
}) => {
  const { 
    data, 
    navigateTo, 
    setActiveTab, 
    setPosView, 
    currentUser, 
    logout, 
    canAccessTab, 
    language,
    setActiveModule,
    setIsStartSessionModalOpen,
    businessDay,
    endSession
  } = useRestaurant();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setCurrentDateTime(`${dateStr} • ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  const handleTileClick = (tab: ActiveTab, subNav?: string, moduleId?: string, customAction?: () => void) => {
    if (customAction) {
      customAction();
      return;
    }
    // Only Live POS ('pos') strictly requires an active shift session
    if (tab === 'pos') {
      if (!data.session?.isActive) {
        return; // Strictly locked until shift is opened from Day Start (Shift 1)
      }
    }
    if (!canAccessTab(tab)) {
      alert(`Access Restricted: Your role (${currentUser?.role}) does not have permission to access ${tab}.`);
      return;
    }
    if (moduleId && setActiveModule) {
      setActiveModule(moduleId);
    }
    if (subNav) {
      navigateTo(tab, subNav, moduleId);
    } else {
      setActiveTab(tab);
      if (tab === 'pos') {
        setPosView('floor');
      }
    }
  };

  const isWaiter = currentUser?.role === 'WAITER';
  const isChef = currentUser?.role === 'CHEF';

  const tiles = [
    // Open/Close Shift tile is only for Cashier, Manager, and Admin. Waiter and Chef do not manage register shifts.
    ...(!isWaiter && !isChef ? [{
      id: 'open-shift',
      title: !businessDay?.isOpen 
        ? 'Day Start (Shift 1)' 
        : data.session?.isActive 
          ? 'Handover / Day End' 
          : 'Start Shift 2',
      titleBn: !businessDay?.isOpen 
        ? 'Start Business Day (Shift 1)' 
        : data.session?.isActive 
          ? 'Shift Handover / Day End' 
          : 'Start Shift 2',
      icon: !businessDay?.isOpen ? Sun : data.session?.isActive ? Power : Moon,
      action: () => {
        if (data.session?.isActive) {
          endSession();
        } else {
          setIsStartSessionModalOpen(true);
        }
      },
      tab: 'pos' as ActiveTab,
    }] : []),
    {
      id: 'sales-pos',
      title: 'Sales & POS',
      
      icon: UtensilsCrossed,
      action: () => {
        if (!data.session?.isActive) {
          return;
        }
        handleTileClick('pos', undefined, 'sales-pos');
      },
      tab: 'pos' as ActiveTab,
    },
    {
      id: 'sales-invoices',
      title: 'Sales Invoices & Memos',
      
      icon: Receipt,
      action: () => handleTileClick('sales', undefined, 'sales-pos'),
      tab: 'sales' as ActiveTab,
    },
    {
      id: 'inventory',
      title: 'Inventory & Stock',
      
      icon: Boxes,
      action: () => handleTileClick('inventory', undefined, 'inventory'),
      tab: 'inventory' as ActiveTab,
    },
    {
      id: 'purchases',
      title: 'Purchases & Vendors',
      
      icon: ShoppingCart,
      action: () => handleTileClick('purchases', undefined, 'purchases'),
      tab: 'purchases' as ActiveTab,
    },
    {
      id: 'accounts',
      title: 'Accounts & Finance',
      
      icon: Wallet,
      action: () => handleTileClick('expenses', undefined, 'accounts'),
      tab: 'expenses' as ActiveTab,
    },
    {
      id: 'hr',
      title: 'HR & Staff Management',
      
      icon: Users,
      action: () => handleTileClick('hr', undefined, 'hr'),
      tab: 'hr' as ActiveTab,
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      
      icon: BarChart3,
      action: () => handleTileClick('reports', undefined, 'reports'),
      tab: 'reports' as ActiveTab,
    },
    {
      id: 'admin',
      title: 'Master Setup & Admin',
      
      icon: Sliders,
      action: () => handleTileClick('heads', undefined, 'admin'),
      tab: 'heads' as ActiveTab,
    }
  ];

  // Filter tiles strictly authorized for current logged in user (ignoring shift state for visibility so tiles show with locked status)
  const authorizedTiles = tiles.filter(tile => {
    if (!tile.tab) return true;
    if (tile.id === 'open-shift') return true;
    return canAccessTab(tile.tab, true);
  });

  const filteredTiles = authorizedTiles.filter(tile => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tile.title.toLowerCase().includes(q) ||
      (tile.titleBn && tile.titleBn.toLowerCase().includes(q))
    );
  });

  const count = filteredTiles.length;

  const getGridClasses = () => {
    if (count === 1) {
      return 'w-full max-w-md mx-auto my-auto flex justify-center h-2/3';
    }
    if (count === 2) {
      return 'grid grid-cols-1 sm:grid-cols-2 gap-x-2.5 sm:gap-x-3 lg:gap-x-3.5 gap-y-[2px] sm:gap-y-[3px] w-full h-full max-h-[500px] my-auto';
    }
    if (count === 3) {
      return 'grid grid-cols-1 sm:grid-cols-3 gap-x-2.5 sm:gap-x-3 lg:gap-x-3.5 gap-y-[2px] sm:gap-y-[3px] w-full h-full max-h-[400px] my-auto';
    }
    if (count === 4) {
      return 'grid grid-cols-2 md:grid-cols-3 gap-x-2.5 sm:gap-x-3 lg:gap-x-3.5 gap-y-[2px] sm:gap-y-[3px] w-full h-full my-auto';
    }
    return 'grid grid-cols-2 md:grid-cols-3 gap-x-2.5 sm:gap-x-3 lg:gap-x-3.5 gap-y-[2px] sm:gap-y-[3px] w-full h-full my-auto';
  };

  const getCardClasses = () => {
    if (count === 1) {
      return 'w-full h-full min-h-[180px] p-6 sm:p-10 flex flex-col items-center justify-center rounded-none';
    }
    if (count === 2) {
      return 'w-full h-full min-h-[150px] p-4 sm:p-6 flex flex-col items-center justify-center rounded-none';
    }
    return 'w-full h-full min-h-0 p-2 sm:p-3 md:p-4 lg:p-5 2xl:p-8 flex flex-col items-center justify-center rounded-none';
  };

  const getIconSize = () => {
    if (count === 1) return 'w-16 h-16 sm:w-20 sm:h-20';
    if (count === 2) return 'w-12 h-12 sm:w-16 sm:h-16';
    return 'w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 lg:w-12 lg:h-12 2xl:w-16 2xl:h-16 3xl:w-20 3xl:h-20';
  };

  const getTextSize = () => {
    if (count === 1) return 'text-xl sm:text-2xl md:text-3xl mt-3';
    if (count === 2) return 'text-lg sm:text-xl md:text-2xl mt-2.5';
    return 'text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl 3xl:text-3xl mt-1 sm:mt-1.5 lg:mt-2';
  };

  return (
    <div className="h-screen max-h-screen bg-white flex flex-col justify-between select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-11 sm:h-14 bg-white shrink-0 z-20 flex items-center border-b border-slate-100 relative">
        <div className="w-full max-w-[1920px] mx-auto px-2.5 sm:px-5 lg:px-6 flex items-center justify-between gap-2 relative">
          {/* Left empty spacer for flex alignment balance */}
          <div className="flex-1 hidden sm:block" />

          {/* Center: Logo + Slash + Restaurant Branch Name */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 min-w-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <img 
              src={logo4} 
              alt="Logo" 
              className="h-6 sm:h-9 md:h-10 w-auto object-contain select-none shrink-0" 
            />
            <span className="text-slate-300 font-normal text-xs sm:text-base select-none shrink-0">/</span>
            <span className="font-extrabold text-xs sm:text-sm md:text-base text-slate-800 tracking-wider uppercase select-none truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md">
              {data.restaurantProfile?.name || 'RESTAURANT POS'}
            </span>
          </div>

          {/* Right: Real-time Live Clock */}
          <div className="flex items-center justify-end shrink-0 sm:flex-1">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[9.5px] xs:text-[11px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
              <span>{currentDateTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Touch Grid Container */}
      <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 flex flex-col pt-0.5 pb-1 sm:pb-1.5">

        {/* Dynamic Centered Grid Layout */}
        <div className={getGridClasses()}>
          {filteredTiles.map((tile) => {
            const Icon = tile.icon;

            return (
              <button
                key={tile.id}
                id={`launch-tile-${tile.id}`}
                onClick={tile.action}
                className={`relative group flex flex-col items-center justify-center text-center rounded-none 
                  bg-gradient-to-br from-[#004b9b] via-[#002652] to-[#000000] hover:from-[#005bb8] hover:via-[#00336d] hover:to-[#040812] border border-blue-900/30 hover:border-blue-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_0_30px_rgba(0,102,255,0.25),0_4px_16px_rgba(0,75,155,0.35)]
                  text-white active:brightness-90 transition-all duration-300 cursor-pointer overflow-hidden 
                  ${getCardClasses()}`}
              >
                {/* 1. Ambient Radial Spotlight (Top-Left Sapphire Glow) */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-300" 
                  style={{
                    background: 'radial-gradient(circle at 15% 15%, rgba(0, 114, 255, 0.45) 0%, rgba(0, 75, 155, 0.2) 45%, transparent 75%)'
                  }} 
                />

                {/* 2. Deep Obsidian Black Vignette (Bottom-Right Depth) */}
                <div 
                  className="absolute inset-0 pointer-events-none" 
                  style={{
                    background: 'radial-gradient(circle at 85% 85%, rgba(0, 0, 0, 0.95) 0%, rgba(2, 6, 23, 0.5) 55%, transparent 100%)'
                  }} 
                />

                {/* 3. Refined Diagonal Split Glass Overlay (Matching Signature Angle with Ultra-Crisp Glass Definition) */}
                <div 
                  className="absolute inset-0 pointer-events-none" 
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 49.5%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.38) 100%)'
                  }} 
                />

                {/* 4. Interactive Light Sweep Shimmer on Hover (Internal Lighting Animation - No Card Movement) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="w-1/3 h-full -skew-x-25 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -translate-x-full group-hover:translate-x-[450%] transition-transform duration-1000 ease-out" />
                </div>

                {/* 5. Main Centered Icon with Ambient Backlight Glow & Hover Scale-up */}
                <div className="relative z-10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200 ease-out">
                  <div className="absolute w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-400/20 blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none" />
                  <Icon 
                    className={`${getIconSize()} text-white group-hover:text-blue-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] transition-all duration-200`} 
                    strokeWidth={1.8} 
                  />
                </div>

                {/* 6. Main Centered Title (No Shifting/Movement) */}
                <div className={`relative z-10 font-bold tracking-wide text-white group-hover:text-blue-50 text-center leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] transition-colors duration-200 ${getTextSize()}`}>
                  {language === 'bn' && tile.titleBn ? tile.titleBn : tile.title}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Bottom Bar with Power/Logout Button */}
      <footer className="h-9 sm:h-10 bg-white shrink-0 z-20">
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 h-full flex items-center justify-end">
          <div className="flex items-center p-0.5 bg-white border border-slate-200 rounded-sm shadow-2xs">
            {/* Power / Logout Button */}
            <button
              id="btn-launcher-logout"
              onClick={logout}
              title="Log Out"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-red-600 hover:bg-red-800 active:scale-95 text-white flex items-center justify-center transition cursor-pointer"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
