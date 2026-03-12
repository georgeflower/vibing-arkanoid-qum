import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Settings, Volume2, Monitor, Gamepad2, RotateCcw } from "lucide-react";
import { soundManager } from "@/utils/sounds";
import type { GameState } from "@/types/game";
import type { QualityLevel } from "@/hooks/useAdaptiveQuality";
import {
  useGameSettings,
  RESOLUTION_PRESETS,
  type GameSettings as GameSettingsType,
} from "@/hooks/useGameSettings";

interface SettingsDialogProps {
  gameState?: GameState;
  setGameState?: React.Dispatch<React.SetStateAction<GameState>>;
  /** External trigger — when provided the dialog opens/closes via this prop */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide trigger button (when opened externally) */
  hideTrigger?: boolean;
}

type TabId = "general" | "video" | "sound";

const QUALITY_LEVELS: { value: QualityLevel; label: string; description: string }[] = [
  { value: "potato", label: "🥔 Potato", description: "For ancient hardware — 50% resolution, no effects" },
  { value: "low", label: "Low", description: "Minimal effects, 75% resolution" },
  { value: "medium", label: "Medium", description: "Balanced visuals & performance" },
  { value: "high", label: "High", description: "Full effects, maximum quality" },
];

export const SettingsDialog = ({
  gameState,
  setGameState,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  hideTrigger,
}: SettingsDialogProps) => {
  const { settings, updateSettings, resetSoundDefaults, resetVideoDefaults, resetGeneralDefaults } =
    useGameSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const [wasPlaying, setWasPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const trackNames = soundManager.getTrackNames();

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const handleOpenChange = (isOpen: boolean) => {
    if (isControlled) {
      externalOnOpenChange?.(isOpen);
    } else {
      setInternalOpen(isOpen);
    }

    if (isOpen) {
      if (gameState === "playing" && setGameState) {
        setWasPlaying(true);
        setGameState("paused");
      }
    } else {
      if (wasPlaying && setGameState) {
        setGameState("playing");
        setWasPlaying(false);
      }
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Gamepad2 className="h-3.5 w-3.5" /> },
    { id: "video", label: "Video", icon: <Monitor className="h-3.5 w-3.5" /> },
    { id: "sound", label: "Sound", icon: <Volume2 className="h-3.5 w-3.5" /> },
  ];

  const renderGeneralTab = () => (
    <div className="space-y-5">
      {/* Tutorial */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Show Tutorials
        </Label>
        <Switch
          checked={settings.tutorialEnabled}
          onCheckedChange={(v) => updateSettings({ tutorialEnabled: v })}
        />
      </div>

      {/* Rapture / Nectarine shout-out */}
      <div
        className="mt-6 p-3 rounded-lg border"
        style={{
          borderColor: "hsl(200, 70%, 40%)",
          backgroundColor: "hsl(220, 30%, 14%)",
        }}
      >
        <p
          className="retro-pixel-text text-[10px] leading-relaxed"
          style={{ color: "hsl(200, 70%, 70%)" }}
        >
          🎵 <em>Greetings to 🇩🇪Rapture from Nectarine Demoscene Radio — keeping the scene alive
          since 2002! If you know, you know.</em> 🎵
        </p>
        <p
          className="retro-pixel-text text-[9px] mt-2 opacity-60"
          style={{ color: "hsl(200, 70%, 60%)" }}
        >
          nectarine.demoscene.net — the soundtrack of our youth 💾
        </p>
      </div>

      {/* Reset */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          soundManager.playMenuClick();
          resetGeneralDefaults();
        }}
        onMouseEnter={() => soundManager.playMenuHover()}
        className="w-full mt-2 border-muted-foreground/30 text-muted-foreground retro-pixel-text text-[10px]"
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Reset General to Default
      </Button>
    </div>
  );

  const renderVideoTab = () => (
    <div className="space-y-4">
      {/* Quality */}
      <div className="space-y-2">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Quality Preset
        </Label>
        <RadioGroup
          value={settings.qualityLevel}
          onValueChange={(v) => {
            soundManager.playMenuClick();
            updateSettings({ qualityLevel: v as QualityLevel });
          }}
          className="space-y-1.5"
        >
          {QUALITY_LEVELS.map((q) => (
            <div key={q.value} className="flex items-start space-x-2">
              <RadioGroupItem value={q.value} id={`q-${q.value}`} className="mt-0.5" />
              <div className="flex flex-col">
                <Label
                  htmlFor={`q-${q.value}`}
                  className="cursor-pointer retro-pixel-text text-xs"
                  style={{ color: "hsl(0, 0%, 85%)" }}
                >
                  {q.label}
                </Label>
                <span
                  className="retro-pixel-text text-[9px]"
                  style={{ color: "hsl(0, 0%, 55%)" }}
                >
                  {q.description}
                </span>
              </div>
            </div>
          ))}
        </RadioGroup>
        <p
          className="retro-pixel-text text-[9px] mt-1"
          style={{ color: "hsl(0, 0%, 50%)" }}
        >
          Press <strong>Q</strong> to cycle quality • <strong>Shift+Q</strong> toggle auto
        </p>
      </div>

      {/* CRT */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          CRT Scanline Effect
        </Label>
        <Switch
          checked={settings.crtEnabled}
          onCheckedChange={(v) => updateSettings({ crtEnabled: v })}
        />
      </div>

      {/* FPS Overlay */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Show FPS Overlay
        </Label>
        <Switch
          checked={settings.showFpsOverlay}
          onCheckedChange={(v) => updateSettings({ showFpsOverlay: v })}
        />
      </div>

      {/* Quality indicator */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Show Quality Indicator
        </Label>
        <Switch
          checked={settings.showQualityIndicator}
          onCheckedChange={(v) => updateSettings({ showQualityIndicator: v })}
        />
      </div>

      {/* Resolution */}
      <div className="space-y-2">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Canvas Resolution
        </Label>
        <select
          value={settings.canvasResolution}
          onChange={(e) => {
            soundManager.playMenuClick();
            updateSettings({ canvasResolution: e.target.value });
          }}
          className="w-full rounded-md border px-3 py-2 text-xs retro-pixel-text"
          style={{
            backgroundColor: "hsl(220, 25%, 14%)",
            borderColor: "hsl(200, 70%, 40%)",
            color: "hsl(0, 0%, 85%)",
          }}
        >
          {RESOLUTION_PRESETS.map((r) => (
            <option key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>
              {r.label}
            </option>
          ))}
        </select>
        <p
          className="retro-pixel-text text-[9px]"
          style={{ color: "hsl(0, 0%, 50%)" }}
        >
          Lower resolutions improve performance on slower hardware
        </p>
      </div>

      {/* Reset */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          soundManager.playMenuClick();
          resetVideoDefaults();
        }}
        onMouseEnter={() => soundManager.playMenuHover()}
        className="w-full mt-2 border-muted-foreground/30 text-muted-foreground retro-pixel-text text-[10px]"
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Reset Video to Default
      </Button>
    </div>
  );

  const renderSoundTab = () => (
    <div className="space-y-5">
      {/* Music toggle + volume */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
            Music
          </Label>
          <Switch
            checked={settings.musicEnabled}
            onCheckedChange={(v) => updateSettings({ musicEnabled: v })}
          />
        </div>
        <div className="space-y-1">
          <Label className="retro-pixel-text text-[10px]" style={{ color: "hsl(0, 0%, 65%)" }}>
            Music Volume: {settings.musicVolume}%
          </Label>
          <Slider
            value={[settings.musicVolume]}
            onValueChange={([v]) => updateSettings({ musicVolume: v })}
            min={0}
            max={100}
            step={5}
            disabled={!settings.musicEnabled}
            className="w-full"
          />
        </div>
      </div>

      {/* SFX toggle + volume */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
            Sound Effects
          </Label>
          <Switch
            checked={settings.sfxEnabled}
            onCheckedChange={(v) => updateSettings({ sfxEnabled: v })}
          />
        </div>
        <div className="space-y-1">
          <Label className="retro-pixel-text text-[10px]" style={{ color: "hsl(0, 0%, 65%)" }}>
            SFX Volume: {settings.sfxVolume}%
          </Label>
          <Slider
            value={[settings.sfxVolume]}
            onValueChange={([v]) => updateSettings({ sfxVolume: v })}
            min={0}
            max={100}
            step={5}
            disabled={!settings.sfxEnabled}
            className="w-full"
          />
        </div>
      </div>

      {/* Track selector */}
      <div className="space-y-2">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Select Song
        </Label>
        <RadioGroup
          value={settings.currentTrack.toString()}
          onValueChange={(v) => {
            const idx = parseInt(v);
            updateSettings({ currentTrack: idx });
            soundManager.setCurrentTrack(idx);
          }}
          disabled={!settings.musicEnabled}
          className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1"
        >
          {trackNames.map((name, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={index.toString()} id={`st-${index}`} />
              <Label
                htmlFor={`st-${index}`}
                className={`cursor-pointer retro-pixel-text text-[10px] ${!settings.musicEnabled ? "opacity-50" : ""}`}
                style={{ color: "hsl(0, 0%, 85%)" }}
              >
                {name}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Reset */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          soundManager.playMenuClick();
          resetSoundDefaults();
        }}
        onMouseEnter={() => soundManager.playMenuHover()}
        className="w-full mt-2 border-muted-foreground/30 text-muted-foreground retro-pixel-text text-[10px]"
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Reset Sound to Default
      </Button>
    </div>
  );

  const content = (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col amiga-box">
      <DialogHeader>
        <DialogTitle
          className="retro-pixel-text text-sm flex items-center gap-2"
          style={{ color: "hsl(0, 0%, 85%)" }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </DialogTitle>
      </DialogHeader>

      {/* Tab bar */}
      <div className="flex gap-1 border-b pb-2" style={{ borderColor: "hsl(200, 70%, 30%)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              soundManager.playMenuClick();
              setActiveTab(tab.id);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md retro-pixel-text text-[10px] transition-colors ${
              activeTab === tab.id
                ? "border-b-2"
                : "opacity-60 hover:opacity-90"
            }`}
            style={{
              color: activeTab === tab.id ? "hsl(200, 70%, 70%)" : "hsl(0, 0%, 60%)",
              borderColor: activeTab === tab.id ? "hsl(200, 70%, 50%)" : "transparent",
              backgroundColor: activeTab === tab.id ? "hsl(220, 25%, 18%)" : "transparent",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-1">
        {activeTab === "general" && renderGeneralTab()}
        {activeTab === "video" && renderVideoTab()}
        {activeTab === "sound" && renderSoundTab()}
      </div>
    </DialogContent>
  );

  if (hideTrigger) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="amiga-box hover:bg-muted/50 transition-colors"
          onMouseEnter={() => soundManager.playMenuHover()}
        >
          <Settings className="h-5 w-5" style={{ color: "hsl(0, 0%, 85%)" }} />
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
};
