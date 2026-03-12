import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Settings, Volume2, Monitor, RotateCcw, Save } from "lucide-react";
import { soundManager } from "@/utils/sounds";
import type { GameState } from "@/types/game";
import type { QualityLevel } from "@/hooks/useAdaptiveQuality";
import {
  useGameSettings,
  RESOLUTION_PRESETS,
  SOUND_DEFAULTS,
  VIDEO_DEFAULTS,
  type GameSettings as GameSettingsType,
} from "@/hooks/useGameSettings";

interface SettingsDialogProps {
  gameState?: GameState;
  setGameState?: React.Dispatch<React.SetStateAction<GameState>>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  /** Called when settings opens from pause menu — hides the pause overlay */
  onPauseMenuHide?: () => void;
  /** Called when settings closes — re-shows the pause overlay */
  onPauseMenuShow?: () => void;
  /** Called after settings are saved with the full settings object */
  onSettingsSaved?: (settings: GameSettingsType) => void;
}

type TabId = "video" | "sound";

// CRT is disabled for potato and low quality
const CRT_DISABLED_QUALITIES: QualityLevel[] = ["potato", "low"];

const QUALITY_LEVELS: { value: QualityLevel; label: string; description: string }[] = [
  {
    value: "potato",
    label: "🥔 Kartoffel",
    description: "For Rapture; RAPTURION the CENTURION of PENTURIONS — it's powered by a po-ta-to!",
  },
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
  onPauseMenuHide,
  onPauseMenuShow,
  onSettingsSaved,
}: SettingsDialogProps) => {
  const { settings, updateSettings, saveSettings, resetSoundDefaults, resetVideoDefaults } = useGameSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("video");

  // Draft state — changes apply to draft, only committed on Save
  const [draft, setDraft] = useState<GameSettingsType>({ ...settings });

  const trackNames = soundManager.getTrackNames();

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const updateDraft = (partial: Partial<GameSettingsType>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      // Auto-uncheck CRT when selecting quality that doesn't support it
      if (partial.qualityLevel && CRT_DISABLED_QUALITIES.includes(partial.qualityLevel)) {
        next.crtEnabled = false;
      }
      return next;
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Snapshot current settings as draft
      setDraft({ ...settings });
      onPauseMenuHide?.();
    } else {
      // Closing without save — discard draft, revert settings to last saved
      updateSettings(settings); // no-op but ensures state consistency
      onPauseMenuShow?.();
    }

    if (isControlled) {
      externalOnOpenChange?.(isOpen);
    } else {
      setInternalOpen(isOpen);
    }
  };

  const handleSave = () => {
    // Commit draft to real settings and persist
    updateSettings(draft);
    saveSettings(draft);
    onSettingsSaved?.(draft);
    soundManager.playMenuClick();

    // Close dialog
    if (isControlled) {
      externalOnOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
    onPauseMenuShow?.();
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "video", label: "Video", icon: <Monitor className="h-3.5 w-3.5" /> },
    { id: "sound", label: "Sound", icon: <Volume2 className="h-3.5 w-3.5" /> },
  ];

  const renderVideoTab = () => (
    <div className="space-y-4">
      {/* Quality */}
      <div className="space-y-2">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Quality Preset
        </Label>
        <RadioGroup
          value={draft.qualityLevel}
          onValueChange={(v) => {
            soundManager.playMenuClick();
            updateDraft({ qualityLevel: v as QualityLevel });
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
                <span className="retro-pixel-text text-[9px]" style={{ color: "hsl(0, 0%, 55%)" }}>
                  {q.description}
                </span>
              </div>
            </div>
          ))}
        </RadioGroup>
        <p className="retro-pixel-text text-[9px] mt-1" style={{ color: "hsl(0, 0%, 50%)" }}>
          Press <strong>Q</strong> to cycle quality • <strong>Shift+Q</strong> toggle auto
        </p>
      </div>

      {/* CRT */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          CRT Scanline Effect
        </Label>
        <Switch
          checked={draft.crtEnabled}
          onCheckedChange={(v) => updateDraft({ crtEnabled: v })}
          disabled={CRT_DISABLED_QUALITIES.includes(draft.qualityLevel)}
        />
      </div>
      {CRT_DISABLED_QUALITIES.includes(draft.qualityLevel) && (
        <p className="retro-pixel-text text-[8px]" style={{ color: "hsl(0, 60%, 55%)" }}>
          CRT is disabled at this quality level
        </p>
      )}

      {/* FPS Overlay */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Show FPS Overlay
        </Label>
        <Switch checked={draft.showFpsOverlay} onCheckedChange={(v) => updateDraft({ showFpsOverlay: v })} />
      </div>

      {/* Quality indicator */}
      <div className="flex items-center justify-between">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Show Quality Indicator
        </Label>
        <Switch
          checked={draft.showQualityIndicator}
          onCheckedChange={(v) => updateDraft({ showQualityIndicator: v })}
        />
      </div>

      {/* Resolution */}
      <div className="space-y-2">
        <Label className="retro-pixel-text text-xs" style={{ color: "hsl(0, 0%, 85%)" }}>
          Canvas Resolution
        </Label>
        <select
          value={draft.canvasResolution}
          onChange={(e) => {
            soundManager.playMenuClick();
            updateDraft({ canvasResolution: e.target.value });
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
        <p className="retro-pixel-text text-[9px]" style={{ color: "hsl(0, 0%, 50%)" }}>
          Lower resolutions improve performance on slower hardware
        </p>
      </div>

      {/* Reset */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          soundManager.playMenuClick();
          setDraft((prev) => ({ ...prev, ...VIDEO_DEFAULTS }));
        }}
        onMouseEnter={() => soundManager.playMenuHover()}
        className="w-full mt-2 border-muted-foreground/30 text-muted-foreground retro-pixel-text text-[10px]"
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Reset Video to Default
      </Button>

      {/* Rapture / Nectarine shout-out */}
      <div
        className="mt-4 p-3 rounded-lg border"
        style={{
          borderColor: "hsl(200, 70%, 40%)",
          backgroundColor: "hsl(220, 30%, 14%)",
        }}
      >
        <p className="retro-pixel-text text-[10px] leading-relaxed" style={{ color: "hsl(200, 70%, 70%)" }}>
          🎵 <em>Greetings to Nectarine Demoscene Radio — keeping the scene alive since 2002! </em> 🎵
        </p>
        <p className="retro-pixel-text text-[9px] mt-2 opacity-60" style={{ color: "hsl(200, 70%, 60%)" }}>
          nectarine.demoscene.net — the soundtrack of our youth 💾
        </p>
      </div>
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
          <Switch checked={draft.musicEnabled} onCheckedChange={(v) => updateDraft({ musicEnabled: v })} />
        </div>
        <div className="space-y-1">
          <Label className="retro-pixel-text text-[10px]" style={{ color: "hsl(0, 0%, 65%)" }}>
            Music Volume: {draft.musicVolume}%
          </Label>
          <Slider
            value={[draft.musicVolume]}
            onValueChange={([v]) => updateDraft({ musicVolume: v })}
            min={0}
            max={100}
            step={5}
            disabled={!draft.musicEnabled}
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
          <Switch checked={draft.sfxEnabled} onCheckedChange={(v) => updateDraft({ sfxEnabled: v })} />
        </div>
        <div className="space-y-1">
          <Label className="retro-pixel-text text-[10px]" style={{ color: "hsl(0, 0%, 65%)" }}>
            SFX Volume: {draft.sfxVolume}%
          </Label>
          <Slider
            value={[draft.sfxVolume]}
            onValueChange={([v]) => updateDraft({ sfxVolume: v })}
            min={0}
            max={100}
            step={5}
            disabled={!draft.sfxEnabled}
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
          value={draft.currentTrack.toString()}
          onValueChange={(v) => {
            const idx = parseInt(v);
            updateDraft({ currentTrack: idx });
            soundManager.setCurrentTrack(idx);
          }}
          disabled={!draft.musicEnabled}
          className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1"
        >
          {trackNames.map((name, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={index.toString()} id={`st-${index}`} />
              <Label
                htmlFor={`st-${index}`}
                className={`cursor-pointer retro-pixel-text text-[10px] ${!draft.musicEnabled ? "opacity-50" : ""}`}
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
          setDraft((prev) => ({ ...prev, ...SOUND_DEFAULTS }));
        }}
        onMouseEnter={() => soundManager.playMenuHover()}
        className="w-full mt-2 border-muted-foreground/30 text-muted-foreground retro-pixel-text text-[10px]"
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Reset Sound to Default
      </Button>
    </div>
  );

  const content = (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col amiga-box z-[300]">
      <DialogHeader>
        <DialogTitle className="retro-pixel-text text-sm flex items-center gap-2" style={{ color: "hsl(0, 0%, 85%)" }}>
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
              activeTab === tab.id ? "border-b-2" : "opacity-60 hover:opacity-90"
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
        {activeTab === "video" && renderVideoTab()}
        {activeTab === "sound" && renderSoundTab()}
      </div>

      {/* Save button */}
      <div className="pt-2 border-t" style={{ borderColor: "hsl(200, 70%, 30%)" }}>
        <Button
          onClick={handleSave}
          onMouseEnter={() => soundManager.playMenuHover()}
          className="w-full bg-green-600 hover:bg-green-700 text-white retro-pixel-text text-xs py-2"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" /> SAVE SETTINGS
        </Button>
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
