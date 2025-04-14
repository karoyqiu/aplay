import { getCurrentWindow } from '@tauri-apps/api/window';

import '@/App.css';
import { Button } from '@/components/ui/button';

const appWindow = getCurrentWindow();

function App() {
  return (
    <div
      className="bg-primary/30 h-screen w-screen"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) {
          appWindow.startDragging();
        }
      }}
    >
      <Button>This is a button</Button>
    </div>
  );
}

export default App;
