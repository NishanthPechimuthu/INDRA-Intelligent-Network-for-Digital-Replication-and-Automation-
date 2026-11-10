import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { issuesFor, programsFor } from '../data/productionSelectors.js';
import {
  decideProgramVersion,
  programDownloadUrl,
  registerProgramVersion,
  uploadProgramFile,
} from '../data/actions.js';
import { hasPermission } from '../data/accessControl.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
  TextInput,
  formatDateTime,
  LoadingBlock,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { MachineStateDot, ProgramStatus } from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

/**
 * Machine program control.
 *
 * Revision control lives in PostgreSQL: an approved version is immutable, and a
 * new version must be registered instead. Program payloads are private storage
 * objects; downloads are signed on demand and audited.
 */
export default function ProgrammerDashboardPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [selected, setSelected] = useState(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState('');
  const [form, setForm] = useState({ changeSummary: '', revisionNotes: '', productionOrderId: '', file: null, submitForReview: true });

  const programs = useMemo(() => (data && context ? programsFor(data, context) : []), [data, context]);
  const issues = useMemo(() => (data && context ? issuesFor(data, context) : []), [data, context]);
  const assignedMachines = (data?.machines || []).filter((machine) => programs.some((program) => program.machineId === machine.id));
  const allVersions = programs.flatMap((program) => program.versions.map((version) => ({ ...version, program })));
  const pendingReview = allVersions.filter((version) => version.status === 'in_review');
  const approved = allVersions.filter((version) => version.status === 'approved');
  const canManage = hasPermission(context?.permissions, 'programs.manage');
  const canApprove = hasPermission(context?.permissions, 'programs.approve');

  async function submitVersion() {
    if (!selected) return;
    if (!form.changeSummary.trim()) {
      notify('Describe what changed in this revision.', 'error');
      return;
    }
    setBusy(true);
    let uploaded = null;
    if (form.file) {
      const upload = await uploadProgramFile({
        file: form.file,
        organizationId: context.scope.organizationId,
        machineId: selected.machineId,
        programId: selected.id,
      });
      if (upload.error) {
        setBusy(false);
        notify(`Upload failed: ${upload.error.message}`, 'error');
        return;
      }
      uploaded = upload.data;
    }
    const result = await registerProgramVersion({
      programId: selected.id,
      changeSummary: form.changeSummary.trim(),
      revisionNotes: form.revisionNotes.trim() || null,
      productionOrderId: form.productionOrderId || null,
      storagePath: uploaded?.storagePath || null,
      fileName: uploaded?.fileName || null,
      mimeType: uploaded?.mimeType || null,
      sizeBytes: uploaded?.sizeBytes || null,
    });
    setBusy(false);
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    notify(`Version ${result.data?.version ?? 'registered'} created. The approved version stays live until this one is approved.`);
    setVersionsOpen(false);
    setForm({ changeSummary: '', revisionNotes: '', productionOrderId: '', file: null, submitForReview: true });
    await workspace.refresh();
  }

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    const result = await decideProgramVersion(decision.id, decision.decision, notes);
    setBusy(false);
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    notify(`Version ${decision.version} ${decision.decision}.`);
    setDecision(null);
    setNotes('');
    await workspace.refresh();
  }

  async function download(version) {
    const result = await programDownloadUrl(version.id, version.storagePath);
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    notify('Signed download link created. The access was written to the audit log.');
    window.open(result.data.url, '_blank', 'noopener');
  }

  if (!context) return null;
  if (!data) return <div className="pt-page"><LoadingBlock rows={4} label="Loading machine programs" /></div>;

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Production', 'Programmer']}
        eyebrow="MACHINE PROGRAM CONTROL"
        title="Programmer workspace"
        description="Register program versions, attach test evidence and route them for review. Approved payloads are immutable and audited."
        actions={
          <Button variant="secondary" icon="History" onClick={() => navigate('/activity')}>Audit trail</Button>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Assigned machines" value={assignedMachines.length} icon="Zap" footnote={`${programs.length} program records`} />
        <StatCard label="Awaiting review" value={pendingReview.length} icon="Timer" tone={pendingReview.length ? 'warn' : 'default'} footnote="Versions in technical review" />
        <StatCard label="Approved versions" value={approved.length} icon="BadgeCheck" tone="lime" footnote="Live production payloads" />
        <StatCard label="Machine issues" value={issues.filter((issue) => !['closed', 'resolved'].includes(issue.status)).length} icon="AlertTriangle" footnote="Reported by operators" />
      </section>

      <Card title="Assigned machines" subtitle="Controller, current version and program status">
        {assignedMachines.length ? (
          <div className="pt-machine-grid">
            {assignedMachines.map((machine) => {
              const machinePrograms = programs.filter((program) => program.machineId === machine.id);
              return (
                <div key={machine.id} className="pt-machine-card">
                  <div className="pt-machine-card-head">
                    <span className="pt-machine-icon"><Icon name="Zap" size={16} /></span>
                    <div>
                      <strong>{machine.name}</strong>
                      <small className="pt-mono">{machine.assetTag} · {machine.manufacturer} {machine.model}</small>
                    </div>
                    <MachineStateDot state={machine.status} />
                  </div>
                  <div className="pt-machine-programs">
                    {machinePrograms.map((program) => (
                      <button key={program.id} type="button" className="pt-program-row" onClick={() => { setSelected(program); setVersionsOpen(true); }}>
                        <span>
                          <strong className="pt-mono">{program.programNumber}</strong>
                          <small>{program.name} · v{program.currentVersion || 0}</small>
                        </span>
                        <ProgramStatus status={program.status} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="Zap" title="No machines assigned" description="Machines become available here once they carry a program record and you hold programs.read." />
        )}
      </Card>

      <Card title="Revision history" subtitle="Every version, its author and its approval state">
        {allVersions.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead>
                <tr><th>Program</th><th>Version</th><th>Change</th><th>Author</th><th>Status</th><th>Approved</th><th>Evidence</th><th /></tr>
              </thead>
              <tbody>
                {allVersions.map((version) => (
                  <tr key={version.id}>
                    <td><strong className="pt-mono">{version.program.programNumber}</strong><small className="pt-muted">{version.program.name}</small></td>
                    <td className="pt-mono">v{version.version}</td>
                    <td><span className="pt-change-summary">{version.changeSummary}</span>{version.revisionNotes ? <small className="pt-muted">{version.revisionNotes}</small> : null}</td>
                    <td>{version.author?.fullName || '—'}</td>
                    <td><ProgramStatus status={version.status} /></td>
                    <td>{version.approver ? <span>{version.approver.fullName}<small className="pt-muted">{version.approvedAt ? formatDateTime(version.approvedAt) : ''}</small></span> : <span className="pt-muted">—</span>}</td>
                    <td>{version.storagePath ? <Button size="sm" variant="ghost" icon="Download" onClick={() => download(version)}>Signed link</Button> : <span className="pt-muted">Metadata only</span>}</td>
                    <td>
                      {canApprove && ['in_review', 'draft'].includes(version.status) && version.createdByEmployeeId !== context.employeeId ? (
                        <div className="pt-row-actions">
                          <Button size="sm" icon="Check" onClick={() => { setDecision({ ...version, decision: 'approved' }); setNotes(''); }}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setDecision({ ...version, decision: 'rejected' }); setNotes(''); }}>Reject</Button>
                        </div>
                      ) : version.createdByEmployeeId === context.employeeId && version.status === 'approved' ? (
                        <Badge tone="neutral">Author cannot re-approve</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="FileCheck2" title="No program versions" description="Register the first version from an assigned machine." />
        )}
      </Card>

      <Card title="Programming errors" subtitle="Technical issues raised against your machines">
        {issues.length ? (
          <div className="pt-mini-table">
            {issues.slice(0, 6).map((issue) => (
              <div key={issue.id} className="pt-mini-row">
                <div>
                  <strong>{issue.category}</strong>
                  <small>{issue.description}</small>
                </div>
                <div className="pt-mini-row-tags">
                  <StatusBadge status={issue.status} />
                  <Badge tone="neutral">{formatDateTime(issue.occurredAt)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="CheckCircle2" title="No open programming issues" description="Issues reported against your machines appear here for review." />
        )}
      </Card>

      <Modal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        title={selected ? `${selected.programNumber} · ${selected.name}` : 'Program'}
        description="Registering a version never overwrites the approved payload."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVersionsOpen(false)}>Close</Button>
            {canManage ? <Button icon="Upload" onClick={submitVersion} disabled={busy}>{busy ? 'Registering…' : 'Register version'}</Button> : null}
          </>
        }
      >
        {selected ? (
          <div className="pt-program-modal">
            <div className="pt-program-summary">
              <span><small>Machine</small><strong>{selected.machine?.name || '—'}</strong></span>
              <span><small>Controller</small><strong>{selected.controllerType || '—'}</strong></span>
              <span><small>Current version</small><strong>v{selected.currentVersion || 0}</strong></span>
              <span><small>Owner</small><strong>{data.employees.find((employee) => employee.id === selected.ownerEmployeeId)?.fullName || '—'}</strong></span>
            </div>

            <ol className="pt-version-timeline">
              {selected.versions.map((version) => (
                <li key={version.id} className={`pt-version pt-version-${version.status}`}>
                  <span className="pt-version-dot" />
                  <div className="pt-version-body">
                    <div className="pt-version-head">
                      <strong>v{version.version} · {version.changeSummary}</strong>
                      <ProgramStatus status={version.status} />
                    </div>
                    <small className="pt-muted">
                      {version.author?.fullName || 'Unknown author'} · {version.submittedAt ? formatDateTime(version.submittedAt) : 'not submitted'}
                      {version.approver ? ` · approved by ${version.approver.fullName}` : ''}
                    </small>
                    {version.decisionNotes ? <p className="pt-version-notes">{version.decisionNotes}</p> : null}
                  </div>
                </li>
              ))}
            </ol>

            {canManage ? (
              <div className="pt-form-grid pt-new-version">
                <Field label="Change summary" required className="pt-form-span" hint="Required. Stored with the version and shown to the reviewer.">
                  <TextInput value={form.changeSummary} onChange={(event) => setForm({ ...form, changeSummary: event.target.value })} placeholder="Reduced depth of cut on the interrupted pass" />
                </Field>
                <Field label="Revision notes" className="pt-form-span">
                  <Textarea rows={2} value={form.revisionNotes} onChange={(event) => setForm({ ...form, revisionNotes: event.target.value })} placeholder="Tested on three pieces; cycle time reduced 9%." />
                </Field>
                <Field label="Production order">
                  <Select value={form.productionOrderId} onChange={(event) => setForm({ ...form, productionOrderId: event.target.value })}>
                    <option value="">Not linked</option>
                    {(data.productionOrders || []).map((order) => <option key={order.id} value={order.id}>{order.orderNo}</option>)}
                  </Select>
                </Field>
                <Field label="Program file" hint="Private bucket. Executable payloads are readable only with programs.read.">
                  <input
                    type="file"
                    className="pt-file-input"
                    onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })}
                  />
                </Field>
              </div>
            ) : (
              <p className="pt-muted pt-small"><Icon name="LockKeyhole" size={13} /> Your roles grant read-only access to program records.</p>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.decision === 'approved' ? 'Approve program version' : 'Reject program version'}
        description={decision ? `v${decision.version} of ${decision.program.programNumber} · authored by ${decision.author?.fullName || 'programmer'}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
            <Button variant={decision?.decision === 'approved' ? 'primary' : 'danger'} icon={decision?.decision === 'approved' ? 'Check' : 'X'} onClick={submitDecision} disabled={busy}>
              {busy ? 'Recording…' : decision?.decision === 'approved' ? 'Approve version' : 'Reject version'}
            </Button>
          </>
        }
      >
        <div className="pt-decision-form">
          <p className="pt-muted pt-small">
            <Icon name="ShieldCheck" size={13} /> Independent review is enforced: the author of a version cannot approve it.
          </p>
          <Field label="Decision notes" hint="Record the verification evidence used.">
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Verified on three pieces against drawing AX-114 rev C." />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
