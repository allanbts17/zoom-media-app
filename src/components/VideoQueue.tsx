// src/components/VideoQueue.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import zoomSdk from "@zoom/appssdk";
import { createBot, getVideos, outputMedia, stopMedia } from "@/utils/api";

/** -------------------- Tipos -------------------- */
type VideoItem = {
  name: string;
  publicUrl: string;
  size: number;
  updated?: string;
  duration?: number; // se llena en cliente
};

/** -------------------- Helpers UI -------------------- */
function fmtBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024; i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}
function fmtSec(s?: number) {
  if (!s || !isFinite(s)) return "-";
  const m = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}
/** Lee metadatos sin descargar el video completo */
async function loadDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    const cleanup = () => { v.src = ""; v.remove(); };
    v.onloadedmetadata = () => { const d = v.duration; cleanup(); isFinite(d) ? resolve(d) : reject(new Error("No duration")); };
    v.onerror = () => { cleanup(); reject(new Error("Metadata load error")); };
  });
}
/** fetch seguro para text en errores */
async function safeText(res: Response) {
  try { return await res.text(); } catch { return `${res.status}`; }
}

/** -------------------- Componente -------------------- */
export default function VideoQueue() {
  // Zoom SDK
  const [zReady, setZReady] = useState(false);
  const [meetingCtx, setMeetingCtx] = useState<any>(null);

  // App state
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botId, setBotId] = useState<string>("");
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(false);
  const [busyRow, setBusyRow] = useState<string>("");

  const timerRef = useRef<number | null>(null);

  /** Init Zoom SDK (si estamos dentro de Zoom App) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Si falla (porque estás en navegador normal), lo capturamos y seguimos.
        await zoomSdk.config({
          // Tamaño sugerido si el app se abre en popout
          popoutSize: { width: 960, height: 640 },
          capabilities: [
            "getRunningContext",
            "getMeetingContext",
            "getMeetingUUID",
            "shareApp",
            "openUrl",
          ],
        });
        const ctx = await zoomSdk.getMeetingContext();
        if (!cancelled) {
          setMeetingCtx(ctx);
          setZReady(true);
        }
      } catch {
        // No estás dentro de Zoom o no otorgaste capabilities: no pasa nada, la app igual funciona.
        if (!cancelled) setZReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Cargar lista de videos al montar */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getVideos()
        console.log(data)
        if (!cancelled) setItems(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Error cargando videos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedList = useMemo(
    () => items.filter(v => selected[v.name]),
    [items, selected]
  );

  function toggle(name: string) {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  }

  /** Crear bot y unirlo al meeting */
  async function onCreateBot() {
    setErr("");
    try {
      const url = meetingUrl.trim();
      if (!url) throw new Error("Meeting URL requerido");
      const data = await createBot(url, "Zoom Media Bot");
      setBotId(String(data?.id ?? ""));
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo crear el bot");
    }
  }

  /** Enviar un MP4 público al bot (Output Media) */
  async function sendOutputMedia(url: string) {
    return await outputMedia(botId, url);
  }

  /** Detener media actual */
  async function stopNow() {
    setErr("");
    if (!botId) return;
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    try {
      await stopMedia(botId);
    } catch (e: any) {
      setErr(e?.message ?? "Error deteniendo");
    } finally {
      setPlaying(false);
    }
  }

  /** Reproducir 1 solo */
  async function playSingle(v: VideoItem) {
    if (!botId) { setErr("Crea el bot primero"); return; }
    try {
      setBusyRow(v.name);
      // precarga duración (no imprescindible para single)
      if (v.duration == null) {
        try { v.duration = await loadDuration(v.publicUrl); } catch {}
      }
      await sendOutputMedia(v.publicUrl);
    } catch (e: any) {
      setErr(e?.message ?? "Error reproduciendo");
    } finally {
      setBusyRow("");
    }
  }

  /** Reproducir en cola (secuencial) */
  async function playQueue() {
    setErr("");
    if (!botId) { setErr("Crea el bot primero"); return; }
    if (selectedList.length === 0) { setErr("Selecciona uno o más videos"); return; }
    if (playing) return;

    setPlaying(true);
    try {
      // 1) Asegura duraciones
      for (const v of selectedList) {
        if (v.duration == null) {
          try { v.duration = await loadDuration(v.publicUrl); }
          catch { v.duration = 0; } // fallback mínimo
        }
      }

      // 2) Reproduce secuencialmente
      const bufferMs = 700; // margen por latencia
      for (let i = 0; i < selectedList.length; i++) {
        const v = selectedList[i];
        setBusyRow(v.name);

        await sendOutputMedia(v.publicUrl);

        const waitMs = Math.max(1000, Math.floor((v.duration ?? 0) * 1000) + bufferMs);
        await new Promise<void>((resolve) => {
          timerRef.current = window.setTimeout(resolve, waitMs);
        });

        // Corta antes de pasar al siguiente
        const res = await fetch(`/api/recall/output-media?bot_id=${encodeURIComponent(botId)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await safeText(res));

        setBusyRow("");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Error en cola");
    } finally {
      setBusyRow("");
      setPlaying(false);
      timerRef.current = null;
    }
  }

  /** Compartir la app dentro de Zoom (opcional) */
async function shareMyApp() {
  try {
    // Asegúrate de haber declarado "shareApp" en zoomSdk.config({ capabilities:[ ... ] })
    // y que estés "inMeeting".
    await zoomSdk.shareApp({ action: "start", withSound: true });
  } catch (e: any) {
    const code = e?.code ?? e?.data?.code;
    const msg  = e?.message ?? e?.data?.message ?? "Error al compartir app";

    // Errores comunes documentados:
    // 10023: screen share deshabilitado en el meeting
    // 10024: ya hay un screen share activo
    // 10059: el cliente ya está compartiendo pantalla/otra app
    // 10137: el usuario debe elegir parar el share actual para iniciar uno nuevo
    if (code === 10137 || code === 10059 || code === 10024) {
      // Intento: detener share y volver a empezar
      try {
        await zoomSdk.shareApp({ action: "stop" });
        await zoomSdk.shareApp({ action: "start", withSound: true });
        return;
      } catch (e2) {
        console.warn("No se pudo reiniciar el share:", e2);
      }
    }
    if (code === 10023) {
      alert("El anfitrión deshabilitó el screen share en este meeting.");
      return;
    }
    console.warn("shareApp error:", code, msg, e);
    alert(`No se pudo compartir la app (código ${code ?? "desconocido"}).`);
  }
}

  /** Guardado simple en localStorage (opc) */
  useEffect(() => {
    const m = localStorage.getItem("meetingUrl");
    const b = localStorage.getItem("botId");
    if (m) setMeetingUrl(m);
    if (b) setBotId(b);
  }, []);
  useEffect(() => {
    localStorage.setItem("meetingUrl", meetingUrl);
  }, [meetingUrl]);
  useEffect(() => {
    if (botId) localStorage.setItem("botId", botId);
  }, [botId]);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-3">Zoom Media Controller</h1>

      <div className="rounded-lg border p-3 mb-4 bg-white/5">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="flex-1 min-w-[320px] border rounded px-3 py-2"
            placeholder="Pega el Meeting URL de Zoom"
            value={meetingUrl}
            onChange={e => setMeetingUrl(e.target.value)}
          />
          <button
            className="px-3 py-2 rounded border hover:bg-white/10 disabled:opacity-50"
            onClick={onCreateBot}
            disabled={!meetingUrl.trim()}
            title="Crear bot y unirlo a la reunión"
          >
            {botId ? "Bot listo ✅" : "Crear bot y unir"}
          </button>

          <button
            className="px-3 py-2 rounded border hover:bg-white/10 disabled:opacity-50"
            onClick={shareMyApp}
            disabled={!zReady}
            title="Compartir esta app dentro del meeting (Zoom App)"
          >
            Compartir app
          </button>
        </div>

        {!!botId && (
          <p className="text-sm mt-2">
            Bot ID: <span className="font-mono">{botId}</span>
            {meetingCtx?.meetingUuid && (
              <> · Meeting UUID: <span className="font-mono">{meetingCtx.meetingUuid}</span></>
            )}
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <button
          className="px-3 py-2 rounded border hover:bg-white/10 disabled:opacity-50"
          onClick={playQueue}
          disabled={!botId || playing || selectedList.length === 0}
        >
          Reproducir en cola
        </button>
        <button
          className="px-3 py-2 rounded border hover:bg-white/10 disabled:opacity-50"
          onClick={stopNow}
          disabled={!botId}
        >
          Detener ahora
        </button>
      </div>

      {err && (
        <div className="mb-3 p-2 border border-red-400 text-red-200 rounded bg-red-900/30">
          {String(err)}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/20">
            <tr>
              <th className="text-left p-2 w-10"></th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Tamaño</th>
              <th className="text-left p-2">Duración</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="p-3 text-center text-gray-400">Cargando...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-center text-gray-400">No hay videos .mp4</td></tr>
            )}
            {!loading && items.map(v => (
              <tr key={v.name} className="border-t border-white/10">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={!!selected[v.name]}
                    onChange={() => toggle(v.name)}
                    aria-label={`Seleccionar ${v.name}`}
                  />
                </td>
                <td className="p-2 break-all">{v.name}</td>
                <td className="p-2">{fmtBytes(v.size)}</td>
                <td className="p-2">
                  {v.duration != null ? fmtSec(v.duration) : (
                    <button
                      className="text-blue-300 hover:underline disabled:opacity-50"
                      disabled={busyRow === v.name}
                      onClick={async () => {
                        try {
                          setBusyRow(v.name);
                          v.duration = await loadDuration(v.publicUrl);
                          // refresca la fila
                          setItems(arr => arr.map(x => x.name === v.name ? { ...x, duration: v.duration } : x));
                        } catch {
                          // ignora errores de metadata
                        } finally {
                          setBusyRow("");
                        }
                      }}
                    >
                      calcular
                    </button>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 border rounded disabled:opacity-50"
                      onClick={() => playSingle(v)}
                      disabled={!botId || busyRow === v.name}
                    >
                      {busyRow === v.name ? "..." : "Reproducir"}
                    </button>
                    <a
                      className="px-2 py-1 border rounded hover:bg-white/10"
                      href={v.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir URL
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Tip: “Duración” se calcula con metadatos del video sin descargarlo completo. Puedes precalcular todas
        con el botón “calcular” de cada fila antes de lanzar la cola para temporizar mejor.
      </p>
    </div>
  );
}
