import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LiveLogs from "./components/LiveLogs";
import WebcamCapture from "./components/WebcamCapture";
import LiveStream from "./components/LiveStream";
import History from "./pages/History";

type Mode = "broadcast" | "watch";

function MainView() {
  const [mode, setMode] = useState<Mode>("broadcast");

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 flex flex-col items-center">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-6 bg-neutral-900 rounded-lg p-1">
        <button
          onClick={() => setMode("broadcast")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "broadcast"
              ? "bg-emerald-600 text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Broadcast
        </button>
        <button
          onClick={() => setMode("watch")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "watch"
              ? "bg-emerald-600 text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Watch
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 h-[80vh]">
        <div className="flex flex-col items-center justify-center gap-4">
          {mode === "broadcast" ? <WebcamCapture /> : <LiveStream />}
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
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}
