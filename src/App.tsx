import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, LogOut, Play } from 'lucide-react';
import { useRef } from 'react';

import '@/App.css';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Slider } from '@/components/ui/slider';

const appWindow = getCurrentWindow();

function App() {
  const player = useRef<HTMLAudioElement>(null);

  return (
    <div
      className="bg-primary/30 h-screen w-screen p-2"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) {
          appWindow.startDragging();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <ButtonGroup variant="outline" size="icon">
          <Button
            onClick={async () => {
              const filename = await open({
                filters: [{ extensions: ['mp3', 'wav'], name: 'Audio files' }],
              });
            }}
          >
            <FolderOpen />
          </Button>
          <Button>
            <Play />
          </Button>
        </ButtonGroup>
        <span className="shrink-0 font-mono text-sm">0:00 / 0:00</span>
        <Slider />
        <Button variant="destructive" size="icon" onClick={() => appWindow.close()}>
          <LogOut />
        </Button>
      </div>
      <audio className="hidden" ref={player} />
    </div>
  );
}

export default App;
