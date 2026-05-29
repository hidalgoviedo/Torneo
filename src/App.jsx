import { useState, useEffect } from "react";

const ROSTER = [
  { name: "Portero",          number: 1,  position: "POR" },
  { name: "Defensa 1",        number: 2,  position: "DEF" },
  { name: "Defensa 2",        number: 3,  position: "DEF" },
  { name: "Defensa 3",        number: 4,  position: "DEF" },
  { name: "Defensa 4",        number: 5,  position: "DEF" },
  { name: "Centrocampista 1", number: 6,  position: "MED" },
  { name: "Centrocampista 2", number: 7,  position: "MED" },
  { name: "Centrocampista 3", number: 8,  position: "MED" },
  { name: "Delantero 1",      number: 9,  position: "DEL" },
  { name: "Delantero 2",      number: 10, position: "DEL" },
  { name: "Delantero 3",      number: 11, position: "DEL" },
];

const MATCH_DURATION = 30;
const posColors = { POR: "#f59e0b", DEF: "#3b82f6", MED: "#10b981", DEL: "#ef4444" };
const initStats = () => ({ goals: 0, assists: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0 });
const buildPlayers = () => ROSTER.map((p, i) => ({ id: i + 1, ...p, stats: initStats(), totalStats: initStats() }));

const calcMinutes = (intervals, matchDuration) =>
  intervals.reduce((acc, seg) => {
    const outAt = seg.out ?? matchDuration;
    return acc + Math.max(0, outAt - seg.in);
  }, 0);

// ── localStorage helpers ──
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export default function App() {
  const [view, setView] = useState("squad");
  const [players, setPlayers] = useState(() => load("torneo_players", buildPlayers()));
  const [matches, setMatches] = useState(() => load("torneo_matches", []));
  const [currentMatch, setCurrentMatch] = useState(() => load("torneo_currentMatch", null));
  const [newMatchForm, setNewMatchForm] = useState({ rival: "", date: "", location: "" });
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", position: "DEL" });
  const [activeMatchTab, setActiveMatchTab] = useState("lineup");
  const [eventForm, setEventForm] = useState({ type: "goal", playerId: "", minute: "", assistId: "" });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [subForm, setSubForm] = useState({ outId: "", inId: "", minute: "" });

  // ── persist to localStorage on every change ──
  useEffect(() => { save("torneo_players", players); }, [players]);
  useEffect(() => { save("torneo_matches", matches); }, [matches]);
  useEffect(() => { save("torneo_currentMatch", currentMatch); }, [currentMatch]);

  const resetAll = () => {
    const fresh = buildPlayers();
    setPlayers(fresh);
    setMatches([]);
    setCurrentMatch(null);
    setShowResetConfirm(false);
    save("torneo_players", fresh);
    save("torneo_matches", []);
    save("torneo_currentMatch", null);
    setView("stats");
  };

  const saveEditPlayer = () => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === editingPlayer ? { ...p, name: editForm.name, number: Number(editForm.number), position: editForm.position } : p
      )
    );
    setEditingPlayer(null);
  };

  const addPlayer = () => {
    if (!newPlayer.name || !newPlayer.number) return;
    const id = Date.now();
    setPlayers((prev) => [...prev, { id, ...newPlayer, number: parseInt(newPlayer.number), stats: initStats(), totalStats: initStats() }]);
    setNewPlayer({ name: "", number: "", position: "DEL" });
    setShowAddPlayer(false);
  };

  const removePlayer = (id) => setPlayers((prev) => prev.filter((p) => p.id !== id));

  const liveMatch = matches.find((m) => m.id === currentMatch) || null;

  const startMatch = () => {
    if (!newMatchForm.rival) return;
    const match = {
      id: Date.now(),
      rival: newMatchForm.rival,
      date: newMatchForm.date || new Date().toLocaleDateString("es-ES"),
      location: newMatchForm.location,
      events: [],
      score: { us: 0, them: 0 },
      status: "live",
      lineup: {},
    };
    setMatches((prev) => [...prev, match]);
    setCurrentMatch(match.id);
    setNewMatchForm({ rival: "", date: "", location: "" });
    setShowNewMatch(false);
    setActiveMatchTab("lineup");
    setView("match");
  };

  const toggleStarter = (playerId) => {
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== currentMatch) return m;
        const lineup = { ...m.lineup };
        if (lineup[playerId]) { delete lineup[playerId]; }
        else { lineup[playerId] = [{ in: 0, out: null }]; }
        return { ...m, lineup };
      })
    );
  };

  const registerSub = () => {
    const { outId, inId, minute } = subForm;
    if (!outId || !inId || !minute) return;
    const min = parseInt(minute);
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== currentMatch) return m;
        const lineup = JSON.parse(JSON.stringify(m.lineup));
        if (lineup[outId]) {
          const last = lineup[outId][lineup[outId].length - 1];
          if (last && last.out === null) last.out = min;
        }
        if (!lineup[inId]) lineup[inId] = [];
        lineup[inId].push({ in: min, out: null });
        const event = {
          id: Date.now(), type: "sub",
          outId: parseInt(outId), outName: players.find((p) => p.id === parseInt(outId))?.name,
          inId: parseInt(inId), inName: players.find((p) => p.id === parseInt(inId))?.name,
          minute: min,
        };
        return { ...m, lineup, events: [...m.events, event] };
      })
    );
    setSubForm({ outId: "", inId: "", minute: "" });
  };

  const addEvent = () => {
    if (eventForm.type !== "goal_them" && !eventForm.playerId) return;
    const player = players.find((p) => p.id === parseInt(eventForm.playerId));
    const assistPlayer = eventForm.assistId ? players.find((p) => p.id === parseInt(eventForm.assistId)) : null;
    const minute = eventForm.minute || "?";
    const event = {
      id: Date.now(), type: eventForm.type,
      playerId: player?.id || null, playerName: player?.name || "", playerNumber: player?.number || "",
      minute, assistId: assistPlayer?.id || null, assistName: assistPlayer?.name || null,
    };
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== currentMatch) return m;
        const newScore = { ...m.score };
        if (event.type === "goal") newScore.us++;
        if (event.type === "goal_them") newScore.them++;
        return { ...m, events: [...m.events, event], score: newScore };
      })
    );
    setPlayers((prev) =>
      prev.map((p) => {
        let s = { ...p.stats };
        if (p.id === player?.id) {
          if (event.type === "goal") s.goals++;
          if (event.type === "yellow") s.yellowCards++;
          if (event.type === "red") s.redCards++;
        }
        if (assistPlayer && p.id === assistPlayer.id && event.type === "goal") s.assists++;
        return { ...p, stats: s };
      })
    );
    setEventForm({ type: "goal", playerId: "", minute: "", assistId: "" });
  };

  const finishMatch = () => {
    const m = liveMatch;
    if (!m) return;
    const minuteMap = {};
    Object.entries(m.lineup).forEach(([pid, segs]) => {
      minuteMap[parseInt(pid)] = calcMinutes(segs, MATCH_DURATION);
    });
    setMatches((prev) => prev.map((x) => (x.id === currentMatch ? { ...x, status: "finished", minuteMap } : x)));
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        totalStats: {
          goals: p.totalStats.goals + p.stats.goals,
          assists: p.totalStats.assists + p.stats.assists,
          yellowCards: p.totalStats.yellowCards + p.stats.yellowCards,
          redCards: p.totalStats.redCards + p.stats.redCards,
          minutesPlayed: p.totalStats.minutesPlayed + (minuteMap[p.id] || 0),
        },
        stats: initStats(),
      }))
    );
    setCurrentMatch(null);
    setView("stats");
  };

  const onField = liveMatch
    ? Object.entries(liveMatch.lineup).filter(([, segs]) => segs[segs.length - 1]?.out === null).map(([id]) => parseInt(id))
    : [];

  const sortedByGoals = [...players].sort((a, b) => b.totalStats.goals - a.totalStats.goals);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf0", fontFamily: "'Barlow Condensed', 'Barlow', sans-serif", fontSize: "15px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e1a; }
        ::-webkit-scrollbar-thumb { background: #2a3050; border-radius: 2px; }
        .nav-btn { background: none; border: none; color: #7a8099; font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; padding: 10px 16px; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .nav-btn.active { color: #5ee7a0; border-bottom-color: #5ee7a0; }
        .nav-btn:hover { color: #c8cce0; }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-green { background: #5ee7a0; color: #0a0e1a; }
        .btn-green:hover { background: #7aedb5; }
        .btn-red { background: #ef4444; color: #fff; }
        .btn-red:hover { background: #f87171; }
        .btn-outline { background: transparent; border: 1px solid #2a3050; color: #7a8099; }
        .btn-outline:hover { border-color: #5ee7a0; color: #5ee7a0; }
        .btn-sm { padding: 5px 12px; font-size: 11px; }
        .card { background: #131929; border: 1px solid #1e2840; border-radius: 10px; overflow: hidden; }
        .player-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #1a2235; transition: background 0.15s; }
        .player-row:last-child { border-bottom: none; }
        .player-row:hover { background: #1a2235; }
        input, select { background: #0d1220; border: 1px solid #2a3050; color: #e8eaf0; border-radius: 6px; padding: 8px 12px; font-family: inherit; font-size: 14px; width: 100%; transition: border-color 0.2s; }
        input:focus, select:focus { outline: none; border-color: #5ee7a0; }
        .stat-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 22px; border-radius: 4px; font-size: 12px; font-weight: 700; padding: 0 6px; }
        .event-chip { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: #0d1220; border-radius: 6px; border-left: 3px solid; font-size: 13px; margin-bottom: 6px; }
        .score-block { background: linear-gradient(135deg, #131929, #1a2235); border: 1px solid #2a3050; border-radius: 12px; padding: 20px 32px; text-align: center; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.2s infinite; display: inline-block; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }
        .tab { cursor: pointer; padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #7a8099; transition: all 0.2s; }
        .tab.active { background: #1e2840; color: #5ee7a0; }
        .tab:hover:not(.active) { color: #c8cce0; }
        .player-toggle { cursor: pointer; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #2a3050; background: #0d1220; transition: all 0.18s; display: flex; align-items: center; gap: 8px; }
        .player-toggle.on { border-color: #5ee7a0; background: #0d1f16; }
      `}</style>

      <div style={{ background: "#0d1220", borderBottom: "1px solid #1e2840", padding: "0 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 26 }}>⚽</span>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "#fff", textTransform: "uppercase" }}>Torneo Stats</div>
                <div style={{ fontSize: 11, color: "#5ee7a0", letterSpacing: 1.5, textTransform: "uppercase" }}>Panel del Entrenador</div>
              </div>
            </div>
            {liveMatch && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e0a0a", border: "1px solid #ef4444", borderRadius: 6, padding: "5px 12px" }}>
                <span className="live-dot" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", letterSpacing: 1 }}>EN VIVO</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {["squad", "match", "stats"].map((v) => (
              <button key={v} className={`nav-btn ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                {v === "squad" ? "👥 Plantilla" : v === "match" ? "🏟️ Partido" : "📊 Estadísticas"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>

        {view === "squad" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>
                Plantilla — {players.length} jugadores
              </div>
              <button className="btn btn-green btn-sm" onClick={() => setShowAddPlayer(true)}>+ Añadir</button>
            </div>

            {showAddPlayer && (
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#5ee7a0", marginBottom: 12, textTransform: "uppercase" }}>Nuevo Jugador</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px", gap: 8, marginBottom: 10 }}>
                  <input placeholder="Nombre" value={newPlayer.name} onChange={(e) => setNewPlayer((p) => ({ ...p, name: e.target.value }))} />
                  <input placeholder="Nº" type="number" value={newPlayer.number} onChange={(e) => setNewPlayer((p) => ({ ...p, number: e.target.value }))} />
                  <select value={newPlayer.position} onChange={(e) => setNewPlayer((p) => ({ ...p, position: e.target.value }))}>
                    <option value="POR">Portero</option>
                    <option value="DEF">Defensa</option>
                    <option value="MED">Medio</option>
                    <option value="DEL">Delantero</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-green btn-sm" onClick={addPlayer}>Guardar</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowAddPlayer(false)}>Cancelar</button>
                </div>
              </div>
            )}

            <div className="card">
              {["POR", "DEF", "MED", "DEL"].map((pos) => {
                const group = players.filter((p) => p.position === pos);
                if (!group.length) return null;
                const label = { POR: "Porteros", DEF: "Defensas", MED: "Mediocampistas", DEL: "Delanteros" }[pos];
                return (
                  <div key={pos}>
                    <div style={{ padding: "8px 16px", background: "#0d1220", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: posColors[pos] }}>{label}</div>
                    {group.map((p) => (
                      <div key={p.id} className="player-row">
                        {editingPlayer === p.id ? (
                          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 60px 90px", gap: 6 }}>
                            <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                            <input type="number" value={editForm.number} onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))} />
                            <select value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}>
                              <option value="POR">POR</option><option value="DEF">DEF</option><option value="MED">MED</option><option value="DEL">DEL</option>
                            </select>
                          </div>
                        ) : (
                          <>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: posColors[pos] + "22", border: `1.5px solid ${posColors[pos]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: posColors[pos] }}>{p.number}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: "#e8eaf0" }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: "#7a8099" }}>⚽ {p.totalStats.goals} · 🅰️ {p.totalStats.assists} · 🟨 {p.totalStats.yellowCards} · 🟥 {p.totalStats.redCards} · ⏱ {p.totalStats.minutesPlayed}'</div>
                            </div>
                          </>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          {editingPlayer === p.id ? (
                            <><button className="btn btn-green btn-sm" onClick={saveEditPlayer}>✓</button><button className="btn btn-outline btn-sm" onClick={() => setEditingPlayer(null)}>✕</button></>
                          ) : (
                            <><button className="btn btn-outline btn-sm" onClick={() => { setEditingPlayer(p.id); setEditForm({ name: p.name, number: p.number, position: p.position }); }}>✏️</button><button className="btn btn-outline btn-sm" style={{ color: "#ef4444", borderColor: "#ef444455" }} onClick={() => removePlayer(p.id)}>🗑</button></>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "match" && (
          <div>
            {!liveMatch ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>Partidos</div>
                  <button className="btn btn-green btn-sm" onClick={() => setShowNewMatch(true)}>+ Nuevo Partido</button>
                </div>

                {showNewMatch && (
                  <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#5ee7a0", marginBottom: 12, textTransform: "uppercase" }}>Nuevo Partido</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      <input placeholder="Rival *" value={newMatchForm.rival} onChange={(e) => setNewMatchForm((f) => ({ ...f, rival: e.target.value }))} />
                      <input placeholder="Fecha (ej: 26/05/2025)" value={newMatchForm.date} onChange={(e) => setNewMatchForm((f) => ({ ...f, date: e.target.value }))} />
                      <input placeholder="Campo / Lugar" value={newMatchForm.location} onChange={(e) => setNewMatchForm((f) => ({ ...f, location: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-green btn-sm" onClick={startMatch}>▶ Iniciar</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowNewMatch(false)}>Cancelar</button>
                    </div>
                  </div>
                )}

                {matches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#7a8099" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏟️</div>
                    <div style={{ fontWeight: 600 }}>No hay partidos registrados</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Crea el primer partido del torneo</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...matches].reverse().map((m) => (
                      <div key={m.id} className="card" style={{ padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 17, fontWeight: 700, color: "#fff" }}>Nuestro Equipo vs {m.rival}</div>
                            <div style={{ fontSize: 12, color: "#7a8099", marginTop: 2 }}>{m.date}{m.location ? ` · ${m.location}` : ""}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 28, fontWeight: 800, color: "#fff" }}>{m.score.us} — {m.score.them}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: m.status === "live" ? "#ef4444" : "#7a8099" }}>{m.status === "live" ? "EN VIVO" : "FINALIZADO"}</div>
                          </div>
                        </div>
                        {m.status === "live" && (
                          <button className="btn btn-green btn-sm" style={{ marginTop: 12 }} onClick={() => { setCurrentMatch(m.id); setActiveMatchTab("lineup"); }}>▶ Continuar</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="score-block" style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#7a8099", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                    {liveMatch.date}{liveMatch.location ? ` · ${liveMatch.location}` : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#5ee7a0", marginBottom: 4 }}>Nuestro equipo</div>
                      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 56, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{liveMatch.score.us}</div>
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 28, fontWeight: 300, color: "#2a3050" }}>—</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#ef4444", marginBottom: 4 }}>{liveMatch.rival}</div>
                      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 56, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{liveMatch.score.them}</div>
                    </div>
                  </div>
                  <button className="btn btn-red btn-sm" style={{ marginTop: 14 }} onClick={finishMatch}>■ Finalizar Partido</button>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                  {["lineup", "sub", "events", "register"].map((t) => (
                    <div key={t} className={`tab ${activeMatchTab === t ? "active" : ""}`} onClick={() => setActiveMatchTab(t)}>
                      {t === "lineup" ? "👥 Titulares" : t === "sub" ? "🔄 Cambios" : t === "events" ? "📋 Eventos" : "➕ Registrar"}
                    </div>
                  ))}
                </div>

                {activeMatchTab === "lineup" && (
                  <div className="card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#5ee7a0", marginBottom: 4, textTransform: "uppercase" }}>Jugadores que empiezan</div>
                    <div style={{ fontSize: 12, color: "#7a8099", marginBottom: 14 }}>Toca un jugador para marcarlo como titular.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {players.map((p) => {
                        const isOn = !!liveMatch.lineup[p.id];
                        return (
                          <div key={p.id} className={`player-toggle ${isOn ? "on" : ""}`} onClick={() => toggleStarter(p.id)}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: posColors[p.position] + "22", border: `1.5px solid ${posColors[p.position]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: posColors[p.position] }}>{p.number}</div>
                            <div style={{ flex: 1, fontWeight: 600, color: isOn ? "#e8eaf0" : "#7a8099", fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: posColors[p.position] }}>{p.position}</div>
                            {isOn && <span style={{ fontSize: 16 }}>✅</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: "#7a8099" }}>{Object.keys(liveMatch.lineup).length} titular(es)</div>
                  </div>
                )}

                {activeMatchTab === "sub" && (
                  <div className="card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#5ee7a0", marginBottom: 4, textTransform: "uppercase" }}>Registrar Cambio</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Sale del campo</div>
                        <select value={subForm.outId} onChange={(e) => setSubForm((f) => ({ ...f, outId: e.target.value }))}>
                          <option value="">— Jugador que sale —</option>
                          {players.filter((p) => onField.includes(p.id)).map((p) => (<option key={p.id} value={p.id}>#{p.number} {p.name}</option>))}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Entra al campo</div>
                        <select value={subForm.inId} onChange={(e) => setSubForm((f) => ({ ...f, inId: e.target.value }))}>
                          <option value="">— Jugador que entra —</option>
                          {players.filter((p) => !onField.includes(p.id)).map((p) => (<option key={p.id} value={p.id}>#{p.number} {p.name}</option>))}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Minuto</div>
                        <input type="number" placeholder="Ej: 15" value={subForm.minute} onChange={(e) => setSubForm((f) => ({ ...f, minute: e.target.value }))} style={{ width: 100 }} />
                      </div>
                      <button className="btn btn-green" onClick={registerSub}>🔄 Confirmar Cambio</button>
                    </div>
                  </div>
                )}

                {activeMatchTab === "register" && (
                  <div className="card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#5ee7a0", marginBottom: 14, textTransform: "uppercase" }}>Registrar Evento</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Tipo de evento</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {[
                            { value: "goal", label: "⚽ Gol (nuestro)", color: "#5ee7a0" },
                            { value: "goal_them", label: "⚽ Gol (rival)", color: "#ef4444" },
                            { value: "yellow", label: "🟨 Amarilla", color: "#f59e0b" },
                            { value: "red", label: "🟥 Roja", color: "#ef4444" },
                          ].map((opt) => (
                            <button key={opt.value} onClick={() => setEventForm((f) => ({ ...f, type: opt.value }))}
                              style={{ background: eventForm.type === opt.value ? opt.color + "22" : "#0d1220", border: `1.5px solid ${eventForm.type === opt.value ? opt.color : "#2a3050"}`, borderRadius: 6, padding: "6px 12px", color: eventForm.type === opt.value ? opt.color : "#7a8099", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {eventForm.type !== "goal_them" && (
                        <div>
                          <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>{eventForm.type === "goal" ? "Goleador" : "Jugador"}</div>
                          <select value={eventForm.playerId} onChange={(e) => setEventForm((f) => ({ ...f, playerId: e.target.value }))}>
                            <option value="">— Seleccionar jugador —</option>
                            {players.map((p) => (<option key={p.id} value={p.id}>#{p.number} {p.name} ({p.position})</option>))}
                          </select>
                        </div>
                      )}
                      {eventForm.type === "goal" && (
                        <div>
                          <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Asistencia (opcional)</div>
                          <select value={eventForm.assistId} onChange={(e) => setEventForm((f) => ({ ...f, assistId: e.target.value }))}>
                            <option value="">— Sin asistencia —</option>
                            {players.filter((p) => p.id !== parseInt(eventForm.playerId)).map((p) => (<option key={p.id} value={p.id}>#{p.number} {p.name}</option>))}
                          </select>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 11, color: "#7a8099", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Minuto</div>
                        <input type="number" placeholder="Ej: 12" value={eventForm.minute} onChange={(e) => setEventForm((f) => ({ ...f, minute: e.target.value }))} style={{ width: 100 }} />
                      </div>
                      <button className="btn btn-green" onClick={addEvent}>Registrar Evento</button>
                    </div>
                  </div>
                )}

                {activeMatchTab === "events" && (
                  <div className="card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#fff", marginBottom: 12, textTransform: "uppercase" }}>Eventos del Partido</div>
                    {liveMatch.events.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 0", color: "#7a8099", fontSize: 13 }}>Sin eventos registrados aún</div>
                    ) : (
                      [...liveMatch.events].reverse().map((ev) => {
                        const cfgMap = { goal: { icon: "⚽", color: "#5ee7a0" }, goal_them: { icon: "⚽", color: "#ef4444" }, yellow: { icon: "🟨", color: "#f59e0b" }, red: { icon: "🟥", color: "#ef4444" }, sub: { icon: "🔄", color: "#a78bfa" } };
                        const cfg = cfgMap[ev.type] || { icon: "•", color: "#7a8099" };
                        return (
                          <div key={ev.id} className="event-chip" style={{ borderLeftColor: cfg.color }}>
                            <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                            <div style={{ flex: 1 }}>
                              {ev.type === "sub" ? (
                                <span style={{ color: "#e8eaf0" }}><span style={{ color: "#ef4444" }}>▼ {ev.outName}</span>{" / "}<span style={{ color: "#5ee7a0" }}>▲ {ev.inName}</span></span>
                              ) : (
                                <span style={{ fontWeight: 600, color: "#e8eaf0" }}>
                                  {ev.type === "goal_them" ? liveMatch.rival : ev.playerName}
                                  {ev.assistName && <span style={{ color: "#7a8099", fontSize: 12 }}> · Asist: {ev.assistName}</span>}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: "#7a8099" }}>{ev.minute !== "?" ? `${ev.minute}'` : "—"}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === "stats" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>Estadísticas del Torneo</div>
              <button className="btn btn-outline btn-sm" style={{ color: "#ef4444", borderColor: "#ef444455" }} onClick={() => setShowResetConfirm(true)}>🗑 Reiniciar</button>
            </div>

            {showResetConfirm && (
              <div className="card" style={{ padding: 16, marginBottom: 16, border: "1px solid #ef444455", background: "#1e0a0a" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>¿Reiniciar todas las estadísticas?</div>
                <div style={{ fontSize: 13, color: "#7a8099", marginBottom: 14 }}>Se borrarán todos los partidos y stats. Los jugadores se conservarán.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-red btn-sm" onClick={resetAll}>Sí, reiniciar</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowResetConfirm(false)}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Partidos", value: matches.filter((m) => m.status === "finished").length, icon: "🏟️" },
                { label: "Goles", value: players.reduce((s, p) => s + p.totalStats.goals, 0), icon: "⚽" },
                { label: "Asist.", value: players.reduce((s, p) => s + p.totalStats.assists, 0), icon: "🅰️" },
              ].map((c) => (
                <div key={c.label} className="card" style={{ padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 24 }}>{c.icon}</div>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 32, fontWeight: 800, color: "#5ee7a0", lineHeight: 1.1 }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: "#7a8099", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>{c.label}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ padding: "12px 16px", background: "#0d1220", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#5ee7a0", borderBottom: "1px solid #1e2840" }}>Tabla de Jugadores</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e2840" }}>
                      {["#", "Jugador", "⚽", "🅰️", "🟨", "🟥", "⏱"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#7a8099", textAlign: h === "Jugador" ? "left" : "center", letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByGoals.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #131929" }}>
                        <td style={{ padding: "9px 10px", fontSize: 12, color: "#7a8099", textAlign: "center" }}>{i + 1}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: posColors[p.position] + "22", border: `1.5px solid ${posColors[p.position]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: posColors[p.position], flexShrink: 0 }}>{p.number}</div>
                            <div>
                              <div style={{ fontWeight: 600, color: "#e8eaf0", fontSize: 13 }}>{p.name}</div>
                              <div style={{ fontSize: 10, color: posColors[p.position] }}>{p.position}</div>
                            </div>
                          </div>
                        </td>
                        {[
                          { v: p.totalStats.goals, c: "#5ee7a0" },
                          { v: p.totalStats.assists, c: "#10b981" },
                          { v: p.totalStats.yellowCards, c: "#f59e0b" },
                          { v: p.totalStats.redCards, c: "#ef4444" },
                          { v: p.totalStats.minutesPlayed, c: "#a78bfa", fmt: (x) => `${x}'` },
                        ].map(({ v, c, fmt }, idx) => (
                          <td key={idx} style={{ padding: "9px 10px", textAlign: "center" }}>
                            <span className="stat-badge" style={{ background: v > 0 ? c + "22" : "transparent", color: v > 0 ? c : "#2a3050" }}>
                              {fmt ? fmt(v) : v}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {matches.length > 0 && (
              <div className="card">
                <div style={{ padding: "12px 16px", background: "#0d1220", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#5ee7a0", borderBottom: "1px solid #1e2840" }}>Historial de Partidos</div>
                {matches.map((m) => (
                  <div key={m.id} style={{ padding: "12px 16px", borderBottom: "1px solid #1a2235", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#e8eaf0", fontSize: 14 }}>vs {m.rival}</div>
                      <div style={{ fontSize: 11, color: "#7a8099", marginTop: 2 }}>{m.date}{m.location ? ` · ${m.location}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 22, fontWeight: 800, color: m.score.us > m.score.them ? "#5ee7a0" : m.score.us < m.score.them ? "#ef4444" : "#f59e0b" }}>
                        {m.score.us} — {m.score.them}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: m.score.us > m.score.them ? "#5ee7a0" : m.score.us < m.score.them ? "#ef4444" : "#f59e0b" }}>
                        {m.score.us > m.score.them ? "Victoria" : m.score.us < m.score.them ? "Derrota" : "Empate"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
