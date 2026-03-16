import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LiveLogs from "./components/LiveLogs";
import WebcamCapture from "./components/WebcamCapture";
import LiveStream from "./components/LiveStream";
import History from "./pages/History";
import Recording from "./pages/Recording";
import Session from "./pages/Session";

function MainView() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <div className="flex justify-end mb-4">
          <Link
            to="/watch"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 transition-colors"
          >
            Watch Broadcast
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 h-[80vh]">
          <div className="flex flex-col items-center justify-center gap-4">
            <WebcamCapture />
          </div>
          <LiveLogs />
        </div>
      </div>
    </div>
  );
}

function WatchView() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 md:h-[80vh]">
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
        <Route path="/session/:sessionId" element={<Session />} />
      </Routes>
    </BrowserRouter>
  );
}
