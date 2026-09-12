import React, { useEffect, useState } from 'react';
import { RoutineDetail } from '../types';
import { deleteRoutine, fetchRoutine, runRoutineNow, updateRoutine } from '../services/api';
import { IconClose } from './Icons';
import { DatePicker } from './DatePicker';

interface RoutineDrawerProps {
  isOpen: boolean;
  routineId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export const RoutineDrawer: React.FC<RoutineDrawerProps> = ({ isOpen, routineId, onClose, onChanged }) => {
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [justTriggered, setJustTriggered] = useState(false);

  useEffect(() => {
    if (!isOpen || !routineId) return;
    setLoading(true);
    setErrorMsg('');
    fetchRoutine(routineId)
      .then((r) => {
        setRoutine(r);
        setName(r.name);
        setPrompt(r.prompt);
        setSchedule(r.schedule);
      })
      .catch(() => setErrorMsg('Não foi possível carregar a rotina.'))
      .finally(() => setLoading(false));
  }, [isOpen, routineId]);

  if (!isOpen) return null;

  const isDirty = !!routine && (name !== routine.name || prompt !== routine.prompt || schedule !== routine.schedule);
  const isActive = routine?.status === 'active';

  const handleToggleActive = async () => {
    if (!routine) return;
    const nextStatus = isActive ? 'paused' : 'active';
    setRoutine({ ...routine, status: nextStatus });
    try {
      await updateRoutine(routine.id, { status: nextStatus });
      onChanged();
    } catch {
      setRoutine({ ...routine, status: routine.status });
      setErrorMsg('Não foi possível atualizar o status.');
    }
  };

  const handleSave = async () => {
    if (!routine || !isDirty) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const updated = await updateRoutine(routine.id, { name, prompt, schedule });
      setRoutine({ ...routine, ...updated });
      onChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível salvar a rotina.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestRun = async () => {
    if (!routine) return;
    setRunning(true);
    setErrorMsg('');
    try {
      await runRoutineNow(routine.id);
      const refreshed = await fetchRoutine(routine.id);
      setRoutine(refreshed);
      setJustTriggered(true);
      window.setTimeout(() => setJustTriggered(false), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível executar a rotina agora.');
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!routine) return;
    if (!window.confirm(`Excluir a rotina "${routine.name}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await deleteRoutine(routine.id);
      onChanged();
      onClose();
    } catch {
      setErrorMsg('Não foi possível excluir a rotina.');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="dev-drawer-overlay" onClick={onClose} />
      <aside className="routine-drawer">
        <div className="dev-drawer-header">
          <span className="dev-drawer-title">Rotina</span>
          <button className="btn-dev-close" onClick={onClose} title="Fechar">
            <IconClose size={14} />
          </button>
        </div>

        {loading ? (
          <div className="dev-empty" style={{ padding: '16px 20px' }}>Carregando…</div>
        ) : !routine ? (
          <div className="dev-empty" style={{ padding: '16px 20px' }}>{errorMsg || 'Rotina não encontrada.'}</div>
        ) : (
          <div className="routine-drawer-content">
            {errorMsg && <div className="form-error" style={{ marginTop: 0 }}>{errorMsg}</div>}

            <div className="routine-toolbar">
              <label className="routine-toggle">
                <input type="checkbox" checked={isActive} onChange={handleToggleActive} />
                <span className="routine-toggle-track"><span className="routine-toggle-thumb" /></span>
                <span>{isActive ? 'Ativa' : 'Pausada'}</span>
              </label>
              <div className="routine-toolbar-actions">
                <button type="button" className="routine-btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Excluindo…' : 'Excluir'}
                </button>
                <button type="button" className="routine-btn-primary" onClick={handleTestRun} disabled={running}>
                  {running ? 'Executando…' : justTriggered ? 'Enviado' : 'Testar agora'}
                </button>
              </div>
            </div>

            <label className="routine-field">
              <span className="studio-label">Nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>

            <label className="routine-field">
              <span className="studio-label">Instrução</span>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={500} />
            </label>

            <div className="routine-field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="studio-label" style={{ margin: 0 }}>Quando rodar</span>
                <DatePicker
                  triggerLabel="Escolher data"
                  placement="bottom"
                  align="right"
                  onInsert={(formatted) => {
                    setSchedule(formatted);
                  }}
                />
              </div>
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                maxLength={120}
                placeholder="Ex: 15/10/2026 às 14:00 ou Todo dia às 09:00"
              />
            </div>

            {isDirty && (
              <button type="button" className="routine-btn-primary" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            )}

            <div className="routine-section-title">Histórico de execução</div>
            {routine.runs.length === 0 ? (
              <p className="dev-empty">Nenhuma execução ainda.</p>
            ) : (
              <div className="routine-runs-list">
                {routine.runs.map((run) => (
                  <div key={run.id} className="routine-run-row">
                    <span>{new Date(run.triggered_at).toLocaleString('pt-BR')}</span>
                    <span className="routine-run-status">{run.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default RoutineDrawer;
