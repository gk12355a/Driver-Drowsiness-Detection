import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Eye, Activity, ShieldAlert, Sliders, Volume2, Mic, CheckCircle2, AlertTriangle, 
  RefreshCw, MapPin, Gauge, BellRing, Compass, Trash2, HardDrive
} from 'lucide-react';
import RiskGauge from './components/RiskGauge';
import BiometricChart from './components/BiometricChart';
import { soundManager } from './utils/sound';

export default function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [telemetry, setTelemetry] = useState({
    ear: 0.28,
    mar: 0.15,
    pitch: 0.0,
    yaw: 0.0,
    roll: 0.0,
    perclos: 0.0,
    closed_duration: 0.0,
    is_closed: false,
    is_yawning: false,
    head_abnormal: false,
    score: 0.0,
    level: "NORMAL",
    level_num: 1,
    color: "#10B981",
    status_text: "SẴN SÀNG GIÁM SÁT",
    can_trigger_sound: false,
    is_cooldown_active: false,
    cooldown_remaining: 0
  });

  const [earHistory, setEarHistory] = useState(new Array(40).fill(0.28));
  const [marHistory, setMarHistory] = useState(new Array(40).fill(0.15));
  const [incidents, setIncidents] = useState([]);
  const [calibration, setCalibration] = useState({ active: false, count: 0, done: false });
  const [voiceAcknowledged, setVoiceAcknowledged] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamIntervalRef = useRef(null);

  const [storageInfo, setStorageInfo] = useState({ snapshot_size_mb: 0, max_size_mb: 100 });
  const [isCleaning, setIsCleaning] = useState(false);

  // Fetch incidents & storage status periodically
  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/status");
      if (res.ok) {
        const data = await res.json();
        if (data.storage) setStorageInfo(data.storage);
      }
    } catch (e) {}
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (e) {
      // Backend may still be loading
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchStatus();
    const interval = setInterval(() => {
      fetchIncidents();
      fetchStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleManualCleanup = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ ảnh snapshot và danh sách sự kiện để giải phóng ổ đĩa không?")) {
      return;
    }
    try {
      setIsCleaning(true);
      const res = await fetch("http://localhost:8000/api/snapshots/cleanup?clear_all=true", { 
        method: "POST" 
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents([]);
        setStorageInfo(prev => ({ ...prev, snapshot_size_mb: 0 }));
        await fetchStatus();
        await fetchIncidents();
        alert(`Đã dọn dẹp sạch sẽ: Xóa thành công ${data.result.deleted_count} file ảnh.`);
      }
    } catch (err) {
      alert("Lỗi khi dọn dẹp bộ nhớ: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  // Handle real-time sound alert and speech assistant
  useEffect(() => {
    if (telemetry.can_trigger_sound) {
      soundManager.playLevelAlert(telemetry.level_num);

      if (telemetry.level_num === 3) {
        soundManager.speak("Tài xế chú ý, bạn đang có dấu hiệu mệt mỏi.");
      } else if (telemetry.level_num === 4) {
        soundManager.speak("Cảnh báo nguy cấp! Hãy dừng xe nghỉ ngơi ngay lập tức!");
      }
    }
  }, [telemetry.can_trigger_sound, telemetry.level_num]);

  // Start / Stop Camera Stream
  const toggleStreaming = async () => {
    if (isStreaming) {
      // Stop
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsStreaming(false);
    } else {
      // Start
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: { ideal: 25 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize WebSocket
        const ws = new WebSocket("ws://localhost:8000/ws/detect");
        wsRef.current = ws;

        ws.onopen = () => {
          setIsStreaming(true);
          // Start capturing frames at ~20-25 FPS (every 45ms)
          streamIntervalRef.current = setInterval(() => {
            if (videoRef.current && canvasRef.current && ws.readyState === WebSocket.OPEN) {
              const canvas = canvasRef.current;
              const video = videoRef.current;
              canvas.width = 320;
              canvas.height = 240;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, 320, 240);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              ws.send(JSON.stringify({ image: dataUrl }));
            }
          }, 45);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.telemetry) {
              setTelemetry(data.telemetry);
              setEarHistory(prev => [...prev.slice(1), data.telemetry.ear]);
              setMarHistory(prev => [...prev.slice(1), data.telemetry.mar]);
            }
            if (data.calibration) {
              setCalibration(data.calibration);
            }
            if (data.event_triggered) {
              fetchIncidents();
            }
          } catch (err) {
            console.error(err);
          }
        };

        ws.onerror = () => setIsStreaming(false);
        ws.onclose = () => setIsStreaming(false);
      } catch (err) {
        alert("Không thể truy cập camera. Vui lòng cấp quyền truy cập camera: " + err.message);
      }
    }
  };

  const handleStartCalibration = async () => {
    try {
      await fetch("http://localhost:8000/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" })
      });
      soundManager.speak("Bắt đầu hiệu chuẩn mắt và khuôn mặt. Vui lòng nhìn thẳng trong ba giây.");
    } catch (e) {
      alert("Lỗi kết nối máy chủ");
    }
  };

  const handleVoiceConfirm = () => {
    setVoiceAcknowledged(true);
    soundManager.speak("Đã ghi nhận tài xế tỉnh táo. Chúc bạn thượng lộ bình an.");
    setTimeout(() => setVoiceAcknowledged(false), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header - Optimized for Mobile & Desktop */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                Driver Drowsiness Detection
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Hệ thống phát hiện ngủ gật theo thời gian thực (EAR, MAR, Head Pose & PERCLOS)
              </p>
            </div>
          </div>

          {/* Global Controls & Status */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-start sm:justify-end">
            {telemetry.is_cooldown_active && (
              <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[11px] sm:text-xs flex items-center gap-1.5 animate-pulse">
                <BellRing className="w-3.5 h-3.5" />
                <span>Cooldown: {telemetry.cooldown_remaining}s</span>
              </div>
            )}

            <button
              onClick={handleStartCalibration}
              disabled={!isStreaming || calibration.active}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                calibration.active
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 animate-pulse'
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200 disabled:opacity-50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{calibration.active ? `Hiệu chuẩn (${calibration.count}/75)` : 'Hiệu chuẩn 75F'}</span>
            </button>

            <button
              onClick={toggleStreaming}
              className={`flex-1 sm:flex-initial px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                isStreaming
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/30'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/30'
              }`}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isStreaming ? 'Dừng Giám Sát' : 'Bật Camera Cabin'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 max-w-[1600px] w-full mx-auto">
        
        {/* Left Col: Real-time Video Cabin & Landmarks (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center aspect-[4/3] sm:aspect-[4/3] max-h-[420px] sm:max-h-[500px]">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${!isStreaming ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!isStreaming && (
              <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mb-3 sm:mb-4">
                  <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-300">Camera Cabin Chưa Kích Hoạt</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mt-1">
                  Nhấn nút "Bật Camera Cabin" để kích hoạt mô hình AI nhận diện mốc khuôn mặt và giám sát tình trạng tài xế.
                </p>
              </div>
            )}

            {/* In-Video Overlay Badges */}
            {isStreaming && (
              <>
                <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 flex flex-col gap-1.5 sm:gap-2">
                  <div className="px-2 sm:px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-xs font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>FPS: 25-30</span>
                  </div>
                  <div className="px-2 sm:px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-xs font-mono">
                    P: {telemetry.pitch}° | Y: {telemetry.yaw}° | R: {telemetry.roll}°
                  </div>
                </div>

                {/* Alarm banner in video if Level >= 3 */}
                {telemetry.level_num >= 3 && (
                  <div className="absolute bottom-2.5 sm:bottom-4 left-2.5 sm:left-4 right-2.5 sm:right-4 p-2.5 sm:p-3 rounded-xl bg-red-600/90 backdrop-blur-md text-white font-bold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xl animate-bounce">
                    <div className="flex items-center gap-2 text-center sm:text-left">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span>{telemetry.status_text}</span>
                    </div>
                    <button
                      onClick={handleVoiceConfirm}
                      className="px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-black shadow hover:bg-slate-100 shrink-0 w-full sm:w-auto"
                    >
                      Tôi Vẫn Tỉnh Táo!
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Biometrics Chart */}
          <BiometricChart
            earHistory={earHistory}
            marHistory={marHistory}
            earThreshold={0.20}
          />
        </div>

        {/* Right Col: Risk Gauge, Telemetry, Voice Assistant, SOS Log (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-5">
          
          {/* Risk Gauge Card */}
          <RiskGauge
            score={telemetry.score}
            level={telemetry.level}
            color={telemetry.color}
            statusText={telemetry.status_text}
          />

          {/* Detailed Metric Cards (Grid 2x2) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Độ Mở Mắt (EAR)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${telemetry.is_closed ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {telemetry.ear.toFixed(3)}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500">≥ 0.20</span>
              </div>
              <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400">
                Nhắm: <span className="font-semibold text-white">{telemetry.closed_duration.toFixed(1)}s</span>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Độ Mở Miệng (MAR)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${telemetry.is_yawning ? 'text-amber-400' : 'text-purple-400'}`}>
                  {telemetry.mar.toFixed(3)}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500">Ngáp: ≥ 0.55</span>
              </div>
              <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400">
                Trạng thái: <span className="font-semibold text-white">{telemetry.is_yawning ? 'Đang ngáp' : 'Bình thường'}</span>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Chỉ Số PERCLOS (30s)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${telemetry.perclos >= 35 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {telemetry.perclos.toFixed(1)}%
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500">Nguy cơ: ≥ 40%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, telemetry.perclos)}%` }}
                />
              </div>
            </div>

            <div className="p-3 sm:p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tư Thế Đầu (Head Pose)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${telemetry.head_abnormal ? 'text-amber-400' : 'text-blue-400'}`}>
                  {Math.abs(telemetry.pitch).toFixed(0)}°
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500">Gục: ≥ 20°</span>
              </div>
              <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
                Góc: <span className="font-semibold text-white">{telemetry.head_abnormal ? 'Lệch / Gục đầu' : 'Nhìn thẳng'}</span>
              </div>
            </div>
          </div>

          {/* Interactive AI Voice Assistant Box */}
          <div className="p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Trợ Lý Giọng Nói AI (Voice Check)</h4>
                <p className="text-[10px] sm:text-[11px] text-slate-400">Tự động hỏi thăm khi nguy cơ tăng & nhận phản hồi rảnh tay</p>
              </div>
            </div>
            <button
              onClick={handleVoiceConfirm}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Xác Nhận Tỉnh Táo</span>
            </button>
          </div>

          {/* SOS Incident Log / Web Admin View */}
          <div className="flex-1 p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col min-h-[160px]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 sm:mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px] sm:text-xs uppercase font-bold text-slate-300">Nhật Ký Sự Kiện SOS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-cyan-400" />
                  {storageInfo.snapshot_size_mb} MB / {storageInfo.max_size_mb} MB
                </span>
                <button
                  onClick={handleManualCleanup}
                  disabled={isCleaning}
                  title="Dọn dẹp snapshot cũ giải phóng bộ nhớ"
                  className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isCleaning ? 'Đang dọn...' : 'Dọn dẹp'}</span>
                </button>
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {incidents.length} sự kiện
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[180px] space-y-2 pr-1">
              {incidents.length === 0 ? (
                <div className="text-center py-5 sm:py-6 text-xs text-slate-500">
                  Chưa ghi nhận sự kiện buồn ngủ khẩn cấp nào.
                </div>
              ) : (
                incidents.slice().reverse().map((inc) => (
                  <div key={inc.id} className="p-2 sm:p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                      {inc.snapshot_base64 && (
                        <img
                          src={inc.snapshot_base64}
                          alt="Snapshot"
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded object-cover border border-slate-700 shrink-0"
                        />
                      )}
                      <div>
                        <div className="font-semibold text-rose-400 text-[11px] sm:text-xs">{inc.id} — {inc.level}</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-400">{inc.timestamp} • Điểm: {inc.score}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                        {inc.lat.toFixed(2)}, {inc.lng.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
