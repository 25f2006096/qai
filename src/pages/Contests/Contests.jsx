import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { getContest, getContestLeaderboard, getContestProblem, getContests, getMyContestRating, submitContestProblem } from '../../services/quantumApi.js';
import AITutor from '../../components/ai/AITutor.jsx';
import CircuitBuilder from '../CircuitBuilder/CircuitBuilder.jsx';

const templates = {
  qiskit: 'from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2)\n# Add gates\nqc.measure_all()',
  pennylane: 'import pennylane as qml\n\n@qml.qnode(None)\ndef circuit():\n    # Add gates\n    return qml.counts()',
  cirq: 'import cirq\n\nqubits = [cirq.LineQubit(i) for i in range(2)]\ncircuit = cirq.Circuit()\n# Add gates',
};

export default function Contests() {
  const { contestId, problemId } = useParams();
  return problemId ? <Problem contestId={contestId} problemId={problemId} /> : contestId ? <Detail contestId={contestId} /> : <List />;
}

function List() {
  const [contests, setContests] = useState([]); const [rating, setRating] = useState(null); const [error, setError] = useState('');
  useEffect(() => { getContests().then(r => setContests(r.contests || [])).catch(e => setError(e.message)); getMyContestRating().then(r => setRating(r.rating)).catch(() => {}); }, []);
  return <Page title="🏁 Quantum Contests" subtitle="Solve secure coding and circuit-building challenges.">
    {rating && <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 28, alignItems: 'center' }}><div><small style={{ color: 'var(--text-muted)' }}>Contest rating</small><div style={{ fontSize: '1.6rem', color: 'var(--accent)', fontWeight: 800 }}>{rating.current_rating}</div></div><div><small style={{ color: 'var(--text-muted)' }}>Rated contests</small><div style={{ fontWeight: 700 }}>{rating.contests_participated}</div></div></div>}
    {error && <Error text={error} />}
    {['live', 'upcoming', 'ended'].map(status => <section key={status} style={{ marginBottom: 28 }}><h3 style={{ marginBottom: 12 }}>{status[0].toUpperCase() + status.slice(1)}</h3><div className="grid grid-2">{contests.filter(c => c.status === status).map(c => <div className="card" key={c.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3>{c.title}</h3><span className={`tag ${status === 'live' ? 'tag-success' : 'tag-info'}`}>{status}</span></div><p style={{ color: 'var(--text-secondary)' }}>{c.description}</p><p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{c.problem_count} problem(s) · {status === 'upcoming' ? `Starts: ${new Date(c.start_time).toLocaleString()} · Ends: ${new Date(c.end_time).toLocaleString()}` : status === 'live' ? `Ends: ${new Date(c.end_time).toLocaleString()}` : `Ended: ${new Date(c.end_time).toLocaleString()}`}</p><Link className="btn btn-primary btn-sm" to={`/contests/${c.id}`}>Open contest</Link></div>)}</div>{!contests.filter(c => c.status === status).length && <div className="card" style={{ color: 'var(--text-muted)' }}>No {status} contests.</div>}</section>)}<AITutor /></Page>;
}

function Detail({ contestId }) {
  const [data, setData] = useState(null); const [board, setBoard] = useState([]); const [error, setError] = useState('');
  useEffect(() => { getContest(contestId).then(setData).catch(e => setError(e.message)); getContestLeaderboard(contestId).then(r => setBoard(r.leaderboard || [])).catch(() => {}); }, [contestId]);
  if (error) return <Page title="Contests"><Error text={error} /></Page>;
  if (!data) return <Page title="Contests"><div className="card">Loading contest…</div></Page>;
  return <Page title={data.contest.title} subtitle={data.contest.description}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}><Link className="btn btn-secondary btn-sm" to="/contests">← All contests</Link><span style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}><strong>Timeline:</strong> {new Date(data.contest.start_time).toLocaleString()} – {new Date(data.contest.end_time).toLocaleString()}</span></div><div className="grid grid-2" style={{ marginTop: 18 }}><div className="card"><h3>Problems</h3>{data.problems.map((p, i) => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border-glass)' }}><div><strong>{i + 1}. {p.title}</strong><div style={{ marginTop: 6 }}><span className="tag tag-info">{p.contest_type === 'coding' ? 'Coding' : 'Circuit-building'}</span> <small>{p.qubit_budget} qubits · {p.gate_budget || '—'} gates</small></div></div><Link className="btn btn-primary btn-sm" to={`/contests/${contestId}/problems/${p.id}`}>Solve</Link></div>)}</div><Board rows={board} /></div><AITutor /></Page>;
}

function Problem({ contestId, problemId }) {
  const [problem, setProblem] = useState(null), [framework, setFramework] = useState('qiskit'), [code, setCode] = useState(templates.qiskit), [ops, setOps] = useState([]), [result, setResult] = useState(null), [error, setError] = useState(''), [submitting, setSubmitting] = useState(false);
  useEffect(() => { getContestProblem(contestId, problemId).then(r => { setProblem(r.problem); if (r.problem.framework) { setFramework(r.problem.framework); setCode(templates[r.problem.framework] || templates.qiskit); } }).catch(e => setError(e.message)); }, [contestId, problemId]);
  if (!problem) return <Page title="Contest problem">{error ? <Error text={error} /> : <div className="card">Loading problem…</div>}</Page>;
  const submit = async () => { setError(''); setSubmitting(true); try { setResult(await submitContestProblem(contestId, problemId, problem.contest_type === 'coding' ? { submission_type: 'code', framework, code } : { submission_type: 'ops', ops })); } catch (e) { setError(e.message); } finally { setSubmitting(false); } };
  return <Page title={problem.title} subtitle={problem.statement}><Link className="btn btn-secondary btn-sm" to={`/contests/${contestId}`}>← Contest</Link><div style={{ margin: '16px 0' }}><span className="tag tag-info">{problem.contest_type === 'coding' ? 'Coding' : 'Circuit-building'}</span> <span className="tag tag-accent">{problem.qubit_budget} qubits</span> {problem.gate_budget && <span className="tag tag-warning">{problem.gate_budget} gates max</span>}</div><div className="explainer-tabs" style={{ marginBottom: 16 }}><button className="explainer-tab active">{problem.contest_type === 'coding' ? '💻 Code' : '⚡ Circuit'}</button></div>{problem.contest_type === 'coding' ? <div className="card"><div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{Object.keys(templates).map(f => <button key={f} onClick={() => { setFramework(f); setCode(templates[f]); }} className={`btn btn-sm ${framework === f ? 'btn-primary' : 'btn-secondary'}`}>{f}</button>)}</div><Editor height="430px" language="python" theme="vs-dark" value={code} onChange={v => setCode(v || '')} options={{ minimap: { enabled: true }, lineNumbers: 'on', fontSize: 13, automaticLayout: true }} /></div> : <div className="card"><CircuitBuilder embedded initialQubits={problem.qubit_budget} gateBudget={problem.gate_budget} onOpsChange={setOps} /></div>}<div style={{ marginTop: 16 }}><button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Scoring…' : 'Submit solution'}</button></div>{error && <Error text={error} />}{result && <Result data={result} />}<AITutor /></Page>;
}

function Result({ data }) { const s = data.submission; const reward = data.reward; return <div className="card" style={{ marginTop: 16 }}><h3>Submission result</h3><div className="grid grid-3" style={{ marginTop: 12 }}>{[['Correctness', s.correctness_score], ['Efficiency', s.efficiency_score], ['Fidelity', s.fidelity_score], ['Total', s.total_score]].map(([name, value]) => <div key={name}><small style={{ color: 'var(--text-muted)' }}>{name}</small><div style={{ color: 'var(--accent)', fontWeight: 800 }}>{(Number(value) * 100).toFixed(1)}%</div></div>)}</div><p style={{ color: 'var(--text-secondary)', fontSize: '.82rem' }}>Rank: {data.rank || '—'}. {data.fidelity_status === 'queued' && 'Best passing submissions are queued for hardware fidelity verification.'}</p>{reward?.awarded && <p className="tag tag-success" role="status">✓ Accepted solution reward: +{reward.xp_awarded} XP</p>}{reward && !reward.awarded && <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>This qualifying solution was already rewarded; XP was not duplicated.</p>}</div>; }
function Board({ rows }) { return <div className="card"><h3>Leaderboard</h3>{rows.length ? rows.map((r, i) => <div key={r.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-glass)' }}><span>#{i + 1} {r.display_name}</span><strong>{Number(r.total_score_sum).toFixed(3)}</strong></div>) : <p style={{ color: 'var(--text-muted)' }}>No submissions yet.</p>}</div>; }
function Error({ text }) { return <div className="card" style={{ marginTop: 16, color: 'var(--danger)' }}>{text}</div>; }
function Page({ title, subtitle, children }) { return <div className="page fade-in"><div className="page-header"><h1 className="page-title">{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{children}</div>; }
