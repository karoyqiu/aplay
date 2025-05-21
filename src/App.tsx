import { convertFileSrc } from '@tauri-apps/api/core';
import { basename, dirname, join } from '@tauri-apps/api/path';
import { ProgressBarStatus, getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { FolderOpen, LogOut, Pause, Play, RefreshCw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  useDebounceCallback,
  useEventCallback,
  useEventListener,
  useHover,
  useLocalStorage,
} from 'usehooks-ts';

import '@/App.css';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const appWindow = getCurrentWindow();
const audioExtensions = ['mp3', 'wav'];

const isAudioFile = (filename: string) =>
  audioExtensions.some((ext) => filename.endsWith(`.${ext}`));

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
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLTrackElement>(null);
  const currentFileIndex = allFiles.indexOf(filename);

  const saveRecent = useDebounceCallback(
    (url: string, ts: number, d: number) => {
      setCurrentTime(ts);
      setRecent({ url, ts });
      appWindow.setProgressBar({
        progress: Math.round((ts * 100) / d),
      });
    },
    500,
    { leading: true, maxWait: 1000 },
  );

  const readAllFiles = async (filename: string) => {
    const dir = await dirname(filename);
    const entries = await readDir(dir, {});
    const files = entries.filter((e) => e.isFile && isAudioFile(e.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    setAllFiles(await Promise.all(files.map((file) => join(dir, file.name))));
  };

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

  const openFile = useEventCallback(async () => {
    if (player.current && track.current) {
      const filename = await open({
        filters: [
          { extensions: audioExtensions, name: 'Audio files' },
          { extensions: ['vtt'], name: 'WebVTT files' },
        ],
      });

      if (filename) {
        if (filename.endsWith('.vtt')) {
          setFilename(filename.slice(0, -4));
        } else {
          setFilename(filename);
          await appWindow.setProgressBar({
            status: ProgressBarStatus.Normal,
            progress: 0,
          });
        }

        setCues([]);
        await readAllFiles(filename);
      }
    }
  });

  const playPause = useEventCallback(() => {
    if (playing) {
      player.current?.pause();
    } else {
      player.current?.play();
    }
  });

  const previous = () => {
    if (currentFileIndex > 0) {
      setFilename(allFiles[currentFileIndex - 1]);
    }
  };

  const next = () => {
    if (currentFileIndex >= 0 && currentFileIndex < allFiles.length - 1) {
      setFilename(allFiles[currentFileIndex + 1]);
    }
  };

  useEventListener('keydown', (e) => {
    switch (e.key) {
      case 'o':
        if (e.ctrlKey) {
          openFile();
        }
        break;

      case ' ':
        playPause();
        break;

      case '[':
        previous();
        break;

      case ']':
        next();
        break;

      case 'ArrowLeft':
        if (canPlay && player.current) {
          player.current.currentTime = Math.max(0, player.current.currentTime - 5);
        }
        break;

      case 'ArrowRight':
        if (canPlay && player.current) {
          player.current.currentTime = Math.min(
            player.current.duration,
            player.current.currentTime + 5,
          );
        }
        break;

      default:
        console.log('Keydown', e.key);
        break;
    }
  });

  useEffect(() => {
    basename(filename)
      .then((base) => {
        setTitle(base);
        setCues([base]);
        appWindow.setTitle(`${base} - aPlay`);
      })
      .catch(() => {});
  }, [filename]);

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
      <span className={cn('text-muted-foreground text-xs', !isHover && 'hidden')}>{title}</span>
      {justRun && recent?.url ? (
        <Button
          className="my-auto"
          onClick={() => {
            setFilename(recent.url);
            readAllFiles(recent.url);

            if (player.current) {
              player.current.currentTime = Math.max(0, recent.ts - 5);
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
          <Button onClick={openFile}>
            <FolderOpen />
          </Button>
          <Button disabled={!canPlay} onClick={playPause}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button disabled={currentFileIndex <= 0} onClick={previous}>
            <SkipBack />
          </Button>
          <Button
            disabled={currentFileIndex < 0 || currentFileIndex >= allFiles.length - 1}
            onClick={next}
          >
            <SkipForward />
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
        src={convertFileSrc(filename)}
        autoPlay
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
          next();
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!seeking) {
            saveRecent(filename, e.currentTarget.currentTime, duration);
          }
        }}
        crossOrigin="anonymous"
      >
        <track
          default
          ref={track}
          src={convertFileSrc(`${filename}.vtt`)}
          kind="subtitles"
          srcLang="zh"
        />
      </audio>
    </div>
  );
}

export default App;
