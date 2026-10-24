import React, { useState, useEffect } from 'react';
import { X, Sliders, Volume2, Monitor, Eye, RotateCcw } from 'lucide-react';
import { CameraViewMode } from '../3d/CricketStadiumScene.js';

export interface GameSettings {
  graphicsQuality: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  shadowsEnabled: boolean;
  crowdDensity: 'off' | 'low' | 'high';
  masterVolume: number; // 0-100
  crowdVolume: number; // 0-100
  sfxVolume: number; // 0-100
  defaultCameraMode: CameraViewMode;
  cameraFov: number; // 45-75
  bowlingSensitivity: number; // 1-10
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: 'HIGH',
  shadowsEnabled: true,
  crowdDensity: 'high',
  masterVolume: 80,
  crowdVolume: 70,
  sfxVolume: 85,
  defaultCameraMode: 'BROADCAST',
  cameraFov: 50,
  bowlingSensitivity: 5
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySettings: (settings: GameSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onApplySettings }) => {
  const [activeTab, setActiveTab] = useState<'GRAPHICS' | 'AUDIO' | 'CAMERA' | 'INPUT'>('GRAPHICS');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem('cricket2026_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('cricket2026_settings', JSON.stringify(settings));
    onApplySettings(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('cricket2026_settings', JSON.stringify(DEFAULT_SETTINGS));
    onApplySettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl glass-panel p-6 rounded-3xl border border-white/15 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-black text-white">Game Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 py-3 border-b border-white/10 overflow-x-auto text-xs font-bold">
          {(['GRAPHICS', 'AUDIO', 'CAMERA', 'INPUT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'GRAPHICS' && <Monitor className="w-3.5 h-3.5" />}
              {tab === 'AUDIO' && <Volume2 className="w-3.5 h-3.5" />}
              {tab === 'CAMERA' && <Eye className="w-3.5 h-3.5" />}
              {tab === 'INPUT' && <Sliders className="w-3.5 h-3.5" />}
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="py-5 space-y-4 text-xs flex-1 min-h-[220px]">
          {/* GRAPHICS TAB */}
          {activeTab === 'GRAPHICS' && (
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                  Visual Quality Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setSettings({ ...settings, graphicsQuality: q })}
                      className={`py-2 rounded-xl font-bold border transition-all ${
                        settings.graphicsQuality === q
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                  Crowd Density
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['off', 'low', 'high'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => setSettings({ ...settings, crowdDensity: density })}
                      className={`py-2 rounded-xl font-bold border uppercase transition-all ${
                        settings.crowdDensity === density
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-white/10">
                <span className="font-semibold text-slate-300">Dynamic Stadium Shadows</span>
                <button
                  onClick={() => setSettings({ ...settings, shadowsEnabled: !settings.shadowsEnabled })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    settings.shadowsEnabled ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                      settings.shadowsEnabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* AUDIO TAB */}
          {activeTab === 'AUDIO' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-300">Master Volume</span>
                  <span className="font-mono text-amber-400">{settings.masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.masterVolume}
                  onChange={(e) => setSettings({ ...settings, masterVolume: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-300">Stadium Crowd & Applause</span>
                  <span className="font-mono text-emerald-400">{settings.crowdVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.crowdVolume}
                  onChange={(e) => setSettings({ ...settings, crowdVolume: Number(e.target.value) })}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-300">Willow Bat-on-Ball Sound FX</span>
                  <span className="font-mono text-sky-400">{settings.sfxVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.sfxVolume}
                  onChange={(e) => setSettings({ ...settings, sfxVolume: Number(e.target.value) })}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* CAMERA TAB */}
          {activeTab === 'CAMERA' && (
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                  Default Camera Perspective
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(['BROADCAST', 'BATTING', 'BOWLING', 'FIELD_SIDE', 'SPECTATOR', 'REPLAY'] as CameraViewMode[]).map(
                    (cam) => (
                      <button
                        key={cam}
                        onClick={() => setSettings({ ...settings, defaultCameraMode: cam })}
                        className={`py-2 px-2.5 rounded-xl font-bold border text-xs transition-all ${
                          settings.defaultCameraMode === cam
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                            : 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {cam.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-300">Camera Field of View (FOV)</span>
                  <span className="font-mono text-amber-400">{settings.cameraFov}°</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="75"
                  value={settings.cameraFov}
                  onChange={(e) => setSettings({ ...settings, cameraFov: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* INPUT TAB */}
          {activeTab === 'INPUT' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-300">Bowling Target Sensitivity</span>
                  <span className="font-mono text-emerald-400">{settings.bowlingSensitivity} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.bowlingSensitivity}
                  onChange={(e) =>
                    setSettings({ ...settings, bowlingSensitivity: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-400 italic">
                Tip: Controls can also be adjusted on-the-fly during matches via the bottom HUD.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
