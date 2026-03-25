import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

const CookingTimer = () => {
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [inputMinutes, setInputMinutes] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setRunning(false);
            playAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, remaining]);

  const playAlarm = () => {
    try {
      const ctx = new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 1500);
    } catch {}
  };

  const startTimer = () => {
    const mins = parseInt(inputMinutes);
    if (!mins || mins <= 0) return;
    const secs = mins * 60;
    setTotalSeconds(secs);
    setRemaining(secs);
    setRunning(true);
    setInputMinutes("");
  };

  const togglePause = () => setRunning(!running);

  const reset = () => {
    setRunning(false);
    setRemaining(0);
    setTotalSeconds(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;

  if (totalSeconds === 0) {
    return (
      <div className="flex items-center gap-2 pt-2 border-t border-border mt-4">
        <Timer className="h-4 w-4 text-muted-foreground" />
        <Input
          type="number"
          placeholder="Minutes"
          value={inputMinutes}
          onChange={(e) => setInputMinutes(e.target.value)}
          className="w-24 h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && startTimer()}
        />
        <Button size="sm" variant="outline" onClick={startTimer} className="h-8">
          <Play className="h-3 w-3 mr-1" /> Start
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-border mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className={`text-2xl font-mono font-bold ${remaining === 0 ? "text-destructive animate-pulse" : "text-foreground"}`}>
            {formatTime(remaining)}
          </span>
          {remaining === 0 && <span className="text-sm text-destructive font-medium">Time's up!</span>}
        </div>
        <div className="flex gap-1">
          {remaining > 0 && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={togglePause}>
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default CookingTimer;
