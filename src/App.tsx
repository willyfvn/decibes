import { BrowserRouter, Routes, Route } from "react-router-dom";
import LiveLogs from "./components/LiveLogs";
import WebcamCapture from "./components/WebcamCapture";
import LiveStream from "./components/LiveStream";
import History from "./pages/History";
import Recording from "./pages/Recording";

function MainView() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 h-[80vh]">
        <div className="flex flex-col items-center justify-center gap-4">
          <WebcamCapture />
        </div>
        <LiveLogs />
      </div>
    </div>
  );
}

function WatchView() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 h-[80vh]">
        <div className="flex flex-col items-center justify-center gap-4">
          <LiveStream />
        </div>
        <LiveLogs />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainView />} />
        <Route path="/watch" element={<WatchView />} />
        <Route path="/history" element={<History />} />
        <Route path="/recording/:id" element={<Recording />} />
      </Routes>
    </BrowserRouter>
  );
}
