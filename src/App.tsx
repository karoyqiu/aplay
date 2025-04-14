import { convertFileSrc } from '@tauri-apps/api/core';
import { ProgressBarStatus, getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, LogOut, Pause, Play, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDebounceCallback, useEventListener, useHover, useLocalStorage } from 'usehooks-ts';

import '@/App.css';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const appWindow = getCurrentWindow();

const pad = (value: number, maxLength = 2) => value.toString().padStart(maxLength, '0');

const nts = (seconds: number) => {
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 60 / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

type RecentPlay = {
  url: string;
  ts: number;
};

function App() {
  const [canPlay, setCanPlay] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [cues, setCues] = useState<string[]>([]);
  const [justRun, setJustRun] = useState(true);
  const [recent, setRecent, removeRecent] = useLocalStorage<RecentPlay | null>('recent', null);
  const root = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLTrackElement>(null);

  const saveRecent = useDebounceCallback(
    (url: string, ts: number) => {
      setRecent({ url, ts });
    },
    500,
    { maxWait: 1000 },
  );

  // @ts-expect-error
  const isHover = useHover(root);

  useEventListener(
    'cuechange',
    () => {
      if (track.current) {
        const actives = track.current.track.activeCues;
        const lines: string[] = [];

        if (actives) {
          for (const cue of actives) {
            if (cue instanceof VTTCue) {
              lines.push(cue.text);
            }
          }
        }

        setCues(lines);
      }
    },
    // @ts-expect-error
    track,
  );

  return (
    <div
      ref={root}
      className={cn(
        'flex h-screen w-screen flex-col p-2 transition-colors duration-200',
        isHover ? 'bg-background/80' : 'bg-background/50',
      )}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) {
          appWindow.startDragging();
        }
      }}
    >
      {justRun && recent?.url ? (
        <Button
          className="my-auto"
          onClick={() => {
            if (track.current) {
              track.current.src = `${recent.url}.vtt`;
            }

            if (player.current) {
              player.current.src = recent.url;
              player.current.currentTime = Math.max(0, recent.ts - 5);
              player.current.play();
            }
          }}
        >
          <RefreshCw />
          Resume last play
        </Button>
      ) : (
        <div className="my-auto flex flex-col items-center text-xl">
          {cues.map((cue) => (
            <p key={cue}>{cue}</p>
          ))}
        </div>
      )}
      <div className={cn('flex items-center gap-2', !isHover && 'hidden')}>
        <ButtonGroup variant="outline" size="icon">
          <Button
            onClick={async () => {
              if (player.current && track.current) {
                const filename = await open({
                  filters: [
                    { extensions: ['mp3', 'wav'], name: 'Audio files' },
                    { extensions: ['vtt'], name: 'WebVTT files' },
                  ],
                });

                if (filename) {
                  if (filename.endsWith('.vtt')) {
                    track.current.src = convertFileSrc(filename);
                  } else {
                    player.current.src = convertFileSrc(filename);
                    track.current.src = `${player.current.src}.vtt`;
                    await player.current.play();
                    await appWindow.setProgressBar({
                      status: ProgressBarStatus.Normal,
                      progress: 0,
                    });
                  }
                }
              }
            }}
          >
            <FolderOpen />
          </Button>
          <Button
            disabled={!canPlay}
            onClick={() => {
              if (playing) {
                player.current?.pause();
              } else {
                player.current?.play();
              }
            }}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
        </ButtonGroup>
        <span className="shrink-0 font-mono text-sm">
          {`${nts(currentTime)} / ${nts(duration)}`}
        </span>
        <Slider
          max={duration || 1}
          value={[currentTime]}
          disabled={!canPlay}
          onValueChange={([value]) => {
            setSeeking(true);
            setCurrentTime(value);
          }}
          onValueCommit={([value]) => {
            if (player.current) {
              player.current.currentTime = value;
            }

            setSeeking(false);
          }}
        />
        <Button
          variant="destructive"
          size="icon"
          onClick={() => {
            saveRecent.flush();
            appWindow.close();
          }}
        >
          <LogOut />
        </Button>
      </div>
      <audio
        className="hidden"
        ref={player}
        onCanPlay={() => setCanPlay(true)}
        onPlay={() => {
          setPlaying(true);
          setJustRun(false);
          appWindow.setProgressBar({ status: ProgressBarStatus.Normal });
        }}
        onPause={() => {
          setPlaying(false);
          appWindow.setProgressBar({ status: ProgressBarStatus.Paused });
        }}
        onEnded={() => {
          saveRecent.cancel();
          removeRecent();
          appWindow.setProgressBar({ status: ProgressBarStatus.None });
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!seeking) {
            const ts = e.currentTarget.currentTime;
            setCurrentTime(ts);
            saveRecent(e.currentTarget.src, ts);
            appWindow.setProgressBar({
              progress: Math.round((ts * 100) / duration),
            });
          }
        }}
        crossOrigin="anonymous"
      >
        <track default ref={track} kind="subtitles" srcLang="zh" />
      </audio>
    </div>
  );
}

export default App;
