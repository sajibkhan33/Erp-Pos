import React, { useState, useEffect } from 'react';
import { useRestaurant, DEFAULT_USERS } from '../../context/RestaurantContext';
import { AppUser } from '../../types';
import Bg from '../../image/bg7.png';
import logo4 from '../../image/logo4.png';


interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { 
    data, 
    login, 
    loginByPin,
    language, 
    setLanguage 
  } = useRestaurant();

  const userList: AppUser[] = (data.users && data.users.length > 0) ? data.users : DEFAULT_USERS;
  const activeUsers = userList.filter(u => u.isActive !== false);

  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const restaurantProfile = data.restaurantProfile || {
    name: 'Barcode Cafe',
    tagline: 'TAKING TECHNOLOGY FORWARD'
  };

  // Handle Numpad Press
  const handleNumpadPress = (digit: string) => {
    setErrorMessage('');
    if (pin.length < 8) {
      setPin(prev => prev + digit);
    }
  };

  const handleNumpadClear = () => {
    setErrorMessage('');
    setPin('');
  };

  // Handle PIN Login Submission
  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!pin.trim()) {
      setErrorMessage(
        language === 'bn' 
          ? 'Please enter PIN' 
          : 'Please enter PIN'
      );
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      let success = false;
      if (loginByPin) {
        success = loginByPin(pin.trim());
      }
      if (!success) {
        const matched = activeUsers.find(u => (u.pinOrPassword || '').trim() === pin.trim());
        if (matched) {
          success = login(matched.username, pin.trim());
        }
      }

      setIsLoading(false);

      if (success) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(
          language === 'bn' 
            ? 'Incorrect PIN!' 
            : 'Access Denied! Incorrect PIN.'
        );
      }
    }, 150);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (/^[0-9]$/.test(e.key)) {
        handleNumpadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleNumpadBackspace();
      } else if (e.key === 'Escape') {
        handleNumpadClear();
      } else if (e.key === 'Enter') {
        handleLoginSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleNumpadBackspace = () => {
    setErrorMessage('');
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full overflow-y-auto relative flex flex-col justify-between select-none font-sans text-slate-800 bg-neutral-900">
      {/* Background Still Image */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <img
          src={Bg}
          alt="Login Background"
          className="w-full h-full object-cover scale-105 translate-y-[2%] origin-top"
        />
      </div>
      

      {/* Main Center Area */}
      <main className="flex-1 flex items-center justify-center relative px-4">
        {/* Center PIN Touch Pad Box */}
        <div className="w-full max-w-[280px] sm:max-w-[320px] flex flex-col items-center">
          {/* Logo & Tagline Header */}
          <div className="w-full flex flex-col items-center justify-center text-center mb-2.5">
            <div className="flex items-center justify-center">
              <img 
                src={logo4} 
                alt="BD HOSTT Logo" 
                className="h-20 object-contain drop-shadow-xs" 
              />
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-white uppercase leading-none -mt-[7px]">
              RESTAURANT POS &amp; RECIPE BOM ERP
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="w-full">
            {/* PIN Display Input Box */}
            <div className="w-full bg-white/95 border border-slate-300 rounded-[2px] h-12 flex items-center justify-center px-4 shadow-xs mb-1">
              {pin.length === 0 ? (
                <span className="text-slate-400 text-xs sm:text-sm font-medium tracking-wide">
                  Enter PIN
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  {Array.from({ length: pin.length }).map((_, i) => (
                    <span key={i} className="w-3 h-3 rounded-full bg-slate-800" />
                  ))}
                </div>
              )}
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="text-center text-[11px] font-bold text-rose-600 py-0.5 animate-in fade-in">
                {errorMessage}
              </div>
            )}

            {/* 3x4 Touch Keypad matching reference layout */}
            <div className="grid grid-cols-3 gap-1 mt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleNumpadPress(digit)}
                  className="h-11 sm:h-12 bg-white/95 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-base sm:text-lg font-bold text-slate-800 flex items-center justify-center cursor-pointer transition select-none shadow-2xs rounded-[2px]"
                >
                  {digit}
                </button>
              ))}

              {/* Clear Button (Red) */}
              <button
                type="button"
                onClick={handleNumpadClear}
                className="h-11 sm:h-12 bg-[#e53935] hover:bg-[#d32f2f] active:bg-[#c62828] text-white text-xs sm:text-sm font-bold flex items-center justify-center cursor-pointer transition select-none shadow-2xs rounded-[2px]"
              >
                Clear
              </button>

              {/* 0 Button */}
              <button
                type="button"
                onClick={() => handleNumpadPress('0')}
                className="h-11 sm:h-12 bg-white/95 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-base sm:text-lg font-bold text-slate-800 flex items-center justify-center cursor-pointer transition select-none shadow-2xs rounded-[2px]"
              >
                0
              </button>

              {/* Login Button (Green) */}
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 sm:h-12 bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#144717] text-white text-xs sm:text-sm font-bold flex items-center justify-center cursor-pointer transition select-none shadow-2xs rounded-[2px] disabled:opacity-50"
              >
                {isLoading ? '...' : 'Login'}
              </button>
            </div>

            {/* Exit Button below keypad */}
            <button
              type="button"
              onClick={handleNumpadClear}
              className="w-full mt-1 h-10 sm:h-11 bg-white/95 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 text-sm sm:text-base font-bold flex items-center justify-center cursor-pointer transition select-none shadow-2xs rounded-[2px]"
            >
              Exit
            </button>
          </form>
        </div>
      </main>

      <div className="h-8" />
    </div>
  );
};

