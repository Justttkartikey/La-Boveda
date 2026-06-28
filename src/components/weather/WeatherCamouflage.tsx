import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchWeather, generateSimulatedWeather } from '../../services/weather';
import type { WeatherData } from '../../services/weather';
import { WeatherAnimations } from './WeatherAnimations';
import {
  Sun,
  Cloud,
  CloudRain,
  Wind,
  Droplets,
  Search,
  RefreshCw,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const WeatherCamouflage: React.FC = () => {
  const { entryGesture, defaultCity, setScreen } = useAuth();
  const [cityInput, setCityInput] = useState('');
  const [cityQuery, setCityQuery] = useState(defaultCity);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  // Gesture refs
  const lastTempClickRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);

  // Fetch weather on query change and set up periodic refresh (every 10 minutes)
  useEffect(() => {
    const loadWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWeather(cityQuery);
        setWeather(data);
      } catch (err) {
        // Fallback to simulated weather
        setWeather(generateSimulatedWeather(cityQuery));
      } finally {
        setLoading(false);
      }
    };
    loadWeather();

    const interval = setInterval(loadWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cityQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setCityQuery(cityInput.trim());
    setCityInput('');
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(cityQuery);
      setWeather(data);
    } catch (err) {
      setWeather(generateSimulatedWeather(cityQuery));
    } finally {
      setLoading(false);
    }
  };

  // Triggers the hidden authentication PIN screen
  const triggerPinScreen = () => {
    // Clear any timers
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    // Instantly transition screen state to PIN authentication
    setScreen('pin');
  };

  // Gesture Handlers
  const handleTempClick = () => {
    if (entryGesture !== 'double-tap-temp') return;
    const now = Date.now();
    if (now - lastTempClickRef.current < 350) {
      triggerPinScreen();
    }
    lastTempClickRef.current = now;
  };

  const handleCityTouchStart = () => {
    if (entryGesture !== 'long-press-city') return;
    longPressTimerRef.current = window.setTimeout(() => {
      triggerPinScreen();
    }, 2000); // 2 second hold
  };

  const handleCityTouchEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleIconClick = () => {
    if (entryGesture !== 'tap-icon') return;
    triggerPinScreen();
  };

  // Helper to map conditions to icons
  const getWeatherIcon = (condition: string, size = 48) => {
    switch (condition) {
      case 'Sunny':
        return <Sun size={size} className="text-yellow-400 animate-pulse" />;
      case 'Rainy':
      case 'Stormy':
        return <CloudRain size={size} className="text-blue-400" />;
      case 'Cloudy':
        return <Cloud size={size} className="text-gray-300" />;
      default:
        return <Wind size={size} className="text-teal-300" />;
    }
  };

  // Helper to style background based on weather
  const getWeatherBg = (condition: string) => {
    switch (condition) {
      case 'Sunny':
        return 'from-sky-900/60 to-zinc-950';
      case 'Rainy':
      case 'Stormy':
        return 'from-slate-900/80 to-zinc-950';
      case 'Cloudy':
        return 'from-zinc-800/60 to-zinc-950';
      default:
        return 'from-cyan-950/60 to-zinc-950';
    }
  };

  if (!weather) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-zinc-500" size={32} />
          <span className="text-sm font-medium tracking-widest text-zinc-500">CARGANDO CLIMA...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-screen flex-col items-center justify-between p-6 bg-gradient-to-b ${getWeatherBg(weather.condition)} text-white overflow-hidden transition-all duration-1000 select-none font-sans`}>
      {/* Background Weather Canvas Animation */}
      <WeatherAnimations condition={weather.condition} />

      {/* Header Search & Refresh */}
      <header className="relative z-10 w-full max-w-lg flex items-center justify-between gap-4 mt-2">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <input
            type="text"
            placeholder="Search city..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-black/30 border border-white/10 rounded-full focus:outline-none focus:border-white/30 transition-all placeholder-white/40"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
        </form>

        <button
          onClick={handleRefresh}
          className="p-2.5 bg-black/30 border border-white/10 rounded-full hover:bg-white/10 focus:outline-none transition-all active:scale-95"
          title="Refresh weather"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Main Info Card */}
      <main className="relative z-10 w-full max-w-lg flex flex-col items-center justify-center flex-1 my-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={weather.city}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            {/* City Title with Long Press Gesture */}
            <h1
              onTouchStart={handleCityTouchStart}
              onTouchEnd={handleCityTouchEnd}
              onMouseDown={handleCityTouchStart}
              onMouseUp={handleCityTouchEnd}
              onMouseLeave={handleCityTouchEnd}
              className="text-4xl font-extrabold tracking-tight font-display drop-shadow cursor-default active:scale-98 select-none select-none touch-none"
              title="City Name"
            >
              {weather.city}
            </h1>

            {/* Condition Icon with Tap Gesture */}
            <div
              onClick={handleIconClick}
              className="my-6 p-6 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-2xl active:scale-95 cursor-pointer select-none"
            >
              {getWeatherIcon(weather.condition, 72)}
            </div>

            {/* Temperature with Double Tap Gesture */}
            <div
              onClick={handleTempClick}
              className="text-7xl font-extralight tracking-tighter font-display mb-1 select-none cursor-default active:scale-98"
            >
              {weather.temp}°
            </div>

            <p className="text-lg font-light text-white/70 mb-8 tracking-wide">
              {weather.condition}
            </p>

            {/* Secondary Widgets */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md shadow">
                <Droplets className="text-blue-300" size={20} />
                <div className="text-left">
                  <p className="text-xs text-white/50 uppercase tracking-widest">Humedad</p>
                  <p className="text-sm font-semibold">{weather.humidity}%</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md shadow">
                <Wind className="text-teal-300" size={20} />
                <div className="text-left">
                  <p className="text-xs text-white/50 uppercase tracking-widest">Viento</p>
                  <p className="text-sm font-semibold">{weather.windSpeed} km/h</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md shadow">
                <Sunrise className="text-amber-400" size={20} />
                <div className="text-left">
                  <p className="text-xs text-white/50 uppercase tracking-widest">Amanecer</p>
                  <p className="text-sm font-semibold">{weather.sunrise}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md shadow">
                <Sunset className="text-orange-400" size={20} />
                <div className="text-left">
                  <p className="text-xs text-white/50 uppercase tracking-widest">Atardecer</p>
                  <p className="text-sm font-semibold">{weather.sunset}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer 5-Day Forecast Card */}
      <footer className="relative z-10 w-full max-w-lg bg-black/25 border border-white/5 rounded-3xl p-5 backdrop-blur-md shadow-2xl">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4 text-left">
          Pronóstico de 5 Días
        </h2>
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {weather.forecast.map((f, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 py-1">
              <span className="text-xs text-white/60 font-medium mb-2">{f.day}</span>
              <div className="mb-2 p-1.5 bg-white/5 rounded-full">
                {getWeatherIcon(f.condition, 20)}
              </div>
              <span className="text-xs font-semibold">{f.temp}°</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};
