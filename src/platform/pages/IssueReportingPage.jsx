import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import {
  issuesFor,
  materialRequestsFor,
  safetyIncidentsFor,
  toolDamageFor,
} from '../data/productionSelectors.js';
import { submitMaterialRequest, submitTechnicalIssue, submitToolDamage, setIssueStatus, uploadEvidence } from '../data/actions.js';
import { hasPermission } from '../data/accessControl.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  StatCard,
  Tabs,
  TextInput,
  Textarea,
  formatDateTime,
  LoadingBlock,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { FieldHint, IssueStatus, SeverityPill } from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const TABS = [
  { id: 'technical', label: 'Technical' },
  { id: 'tool', label: 'Tool damage' },
  { id: 'material', label: 'Material' },
  { id: 'safety', label: 'Safety' },
];

const UNITS = ['pcs', 'kg', 'g', 'l', 'm', 'mm'];

/**
 * Operator issue reporting.
 *
 * Each workflow writes its own record plus, where an approval is needed, a row in
 * the shared requests/approvals workflow. Safety reporting separates operational
 * facts from clinical detail: the restricted section only appears when the
 * database returned it for a holder of safety.medical.read.
 */
export default function IssueReportingPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [tab, setTab] = useState('technical');
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState(null);

  const issues = useMemo(() => (data && context ? issuesFor(data, context) : []), [data, context]);
  const toolReports = useMemo(() => (data && context ? toolDamageFor(data, context) : []), [data, context]);
  const materialRequests = useMemo(() => (data ? materialRequestsFor(data) : []), [data]);
  const incidents = useMemo(() => (data && context ? safetyIncidentsFor(data, context) : []), [data, context]);
  const canReport = hasPermission(context?.permissions, 'production.issues.create');
  const canReportSafety = hasPermission(context?.permissions, 'safety.report');
  const canManageIssues = hasPermission(context?.permissions, 'production.issues.manage');

  const [technical, setTechnical] = useState({ machineId: '', category: '', description: '', severity: 'medium', machineState: 'down', downtimeMinutes: '', productionImpact: '', occurredAt: '' });
  const [tool, setTool] = useState({ toolId: '', damageCategory: '', damagedQuantity: '', description: '', productionImpact: '' });
  const [material, setMaterial] = useState({ materialId: '', requiredQuantity: '', unit: '', availableQuantity: '', requiredBy: '', productionOrderId: '', reason: '', specification: '' });
  const [safety, setSafety] = useState({ incidentAt: '', category: 'near_miss', severity: 'medium', workstationId: '', operationalSummary: '', immediateAction: '', workStopped: false, lostTimeHours: '', affectedEmployeeId: '' });

  const selectedMaterial = data?.materials?.find((item) => item.id === material.materialId) || null;

  async function fileEvidence() {
    if (!evidence) return null;
    const upload = await uploadEvidence({ file: evidence, organizationId: context.scope.organizationId, employeeId: context.employeeId });
    if (upload.error) {
      notify(`Evidence upload failed: ${upload.error.message}`, 'error');
      return undefined;
    }
    return upload.data.id;
  }

  async function reportTechnical(event) {
    event.preventDefault();
    if (!technical.machineId || technical.description.trim().length < 5) {
      return notify('Choose the machine and describe the fault.', 'error');
    }
    setBusy(true);
    const evidenceDocumentId = await fileEvidence();
    if (evidenceDocumentId === undefined) { setBusy(false); return null; }
    const result = await submitTechnicalIssue({
      ...technical,
      downtimeMinutes: Number(technical.downtimeMinutes || 0),
      occurredAt: technical.occurredAt ? new Date(technical.occurredAt).toISOString() : new Date().toISOString(),
      evidenceDocumentId,
    });
    setBusy(false);
    if (result.error) return notify(result.error.message, 'error');
    notify('Technical issue reported. The machine is marked down and the supervisor notified.');
    setTechnical({ machineId: '', category: '', description: '', severity: 'medium', machineState: 'down', downtimeMinutes: '', productionImpact: '', occurredAt: '' });
    setEvidence(null);
    await workspace.refresh();
    return null;
  }

  async function reportTool(event) {
    event.preventDefault();
    if (!tool.toolId || Number(tool.damagedQuantity) <= 0) return notify('Choose the tool and enter the damaged quantity.', 'error');
    setBusy(true);
    const evidenceDocumentId = await fileEvidence();
    if (evidenceDocumentId === undefined) { setBusy(false); return; }
    const result = await submitToolDamage({ ...tool, damagedQuantity: Number(tool.damagedQuantity), evidenceDocumentId });
    setBusy(false);
    if (result.error) return notify(result.error.message, 'error');
    notify('Tool damage reported.');
    setTool({ toolId: '', damageCategory: '', damagedQuantity: '', description: '', productionImpact: '' });
    setEvidence(null);
    await workspace.refresh();
  }

  async function requestMaterial(event) {
    event.preventDefault();
    if (!material.materialId || Number(material.requiredQuantity) <= 0) return notify('Choose the material and quantity required.', 'error');
    setBusy(true);
    const result = await submitMaterialRequest({
      ...material,
      requiredQuantity: Number(material.requiredQuantity),
      availableQuantity: material.availableQuantity === '' ? null : Number(material.availableQuantity),
      requiredBy: material.requiredBy ? new Date(material.requiredBy).toISOString() : null,
      unit: selectedMaterial?.unit,
    });
    setBusy(false);
    if (result.error) return notify(result.error.message, 'error');
    notify('Material requirement submitted for approval.');
    setMaterial({ materialId: '', requiredQuantity: '', unit: '', availableQuantity: '', requiredBy: '', productionOrderId: '', reason: '', specification: '' });
    await workspace.refresh();
  }

  async function reportSafety(event) {
    event.preventDefault();
    if (safety.operationalSummary.trim().length < 10) return notify('Describe what happened (operational facts only).', 'error');
    setBusy(true);
    if (!data) { setBusy(false); return; }
    // Safety incidents are written through the table with RLS; clinical detail is
    // added separately by authorised occupational-health staff.
    const { supabase } = await import('../supabaseClient.js');
    const evidenceDocumentId = await fileEvidence();
    if (evidenceDocumentId === undefined) { setBusy(false); return; }
    if (!supabase) {
      setBusy(false);
      return notify('Safety reporting requires the connected Supabase environment.', 'error');
    }
    const { error } = await supabase.from('safety_incidents').insert({
      plant_id: context.scope.plantId,
      department_id: context.scope.departmentId,
      workstation_id: safety.workstationId || null,
      affected_employee_id: safety.affectedEmployeeId || context.employeeId,
      reported_by_employee_id: context.employeeId,
      incident_at: safety.incidentAt ? new Date(safety.incidentAt).toISOString() : new Date().toISOString(),
      category: safety.category,
      severity: safety.severity,
      operational_summary: safety.operationalSummary,
      immediate_action: safety.immediateAction || null,
      work_stopped: Boolean(safety.workStopped),
      lost_time_hours: safety.lostTimeHours === '' ? null : Number(safety.lostTimeHours),
      evidence_document_id: evidenceDocumentId,
    });
    setBusy(false);
    if (error) return notify(error.message, 'error');
    notify('Safety incident recorded. Clinical detail is restricted to occupational health.');
    setSafety({ incidentAt: '', category: 'near_miss', severity: 'medium', workstationId: '', operationalSummary: '', immediateAction: '', workStopped: false, lostTimeHours: '', affectedEmployeeId: '' });
    setEvidence(null);
    await workspace.refresh();
  }

  async function progressIssue(issue, status) {
    const result = await setIssueStatus(issue.id, status);
    if (result.error) notify(result.error.message, 'error');
    else {
      notify(`Issue ${status}.`);
      await workspace.refresh();
    }
  }

  if (!context) return null;
  if (!data) return <div className="pt-page"><LoadingBlock rows={4} label="Loading operational data" /></div>;

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Operations', 'Issue reporting']}
        eyebrow="OPERATOR REPORTING"
        title="Report an issue"
        description="Technical faults, tool damage, material shortages and safety events each keep their own record and route."
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Open technical" value={issues.filter((issue) => !['resolved', 'closed'].includes(issue.status)).length} icon="AlertTriangle" tone={issues.some((issue) => issue.status === 'open') ? 'warn' : 'default'} footnote="Machine faults" />
        <StatCard label="Tool reports" value={toolReports.length} icon="Wrench" footnote="Damage recorded" />
        <StatCard label="Material requests" value={materialRequests.length} icon="Box" footnote="Through the approval workflow" />
        <StatCard label="Safety events" value={incidents.length} icon="ShieldAlert" footnote="Operational view only" />
      </section>

      <Card title="New report" subtitle="Only the tab you submit creates a record">
        <Tabs active={tab} onChange={setTab} tabs={TABS} />

        {tab === 'technical' ? (
          <form className="pt-form-grid" onSubmit={reportTechnical}>
            <Field label="Machine" required>
              <Select value={technical.machineId} onChange={(event) => setTechnical({ ...technical, machineId: event.target.value })} required>
                <option value="">Choose a machine</option>
                {(data.machines || []).map((machine) => <option key={machine.id} value={machine.id}>{machine.name} · {machine.assetTag}</option>)}
              </Select>
            </Field>
            <Field label="Issue category" required>
              <TextInput value={technical.category} onChange={(event) => setTechnical({ ...technical, category: event.target.value })} placeholder="Hydraulic pressure / spindle vibration" required />
            </Field>
            <Field label="Severity">
              <Select value={technical.severity} onChange={(event) => setTechnical({ ...technical, severity: event.target.value })}>
                {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Machine state">
              <Select value={technical.machineState} onChange={(event) => setTechnical({ ...technical, machineState: event.target.value })}>
                {['running', 'idle', 'down', 'maintenance', 'setup', 'offline'].map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Occurrence time">
              <TextInput type="datetime-local" value={technical.occurredAt} onChange={(event) => setTechnical({ ...technical, occurredAt: event.target.value })} />
            </Field>
            <Field label="Downtime (minutes)">
              <TextInput type="number" min="0" value={technical.downtimeMinutes} onChange={(event) => setTechnical({ ...technical, downtimeMinutes: event.target.value })} />
            </Field>
            <Field label="Description" required className="pt-form-span">
              <Textarea rows={3} value={technical.description} onChange={(event) => setTechnical({ ...technical, description: event.target.value })} placeholder="Coolant pressure dropped below 2 bar during roughing." required />
            </Field>
            <Field label="Production impact" className="pt-form-span">
              <TextInput value={technical.productionImpact} onChange={(event) => setTechnical({ ...technical, productionImpact: event.target.value })} placeholder="Half shift of axle housings deferred." />
            </Field>
            <Field label="Photograph or video" className="pt-form-span">
              <input type="file" className="pt-file-input" accept="image/*,video/mp4,application/pdf" onChange={(event) => setEvidence(event.target.files?.[0] || null)} />
            </Field>
            <div className="pt-form-span pt-form-actions">
              <FieldHint icon="Zap">Reporting a fault marks the machine down immediately.</FieldHint>
              <Button type="submit" icon="Send" disabled={busy || !canReport}>{busy ? 'Reporting…' : 'Report technical issue'}</Button>
            </div>
          </form>
        ) : null}

        {tab === 'tool' ? (
          <form className="pt-form-grid" onSubmit={reportTool}>
            <Field label="Tool" required>
              <Select value={tool.toolId} onChange={(event) => setTool({ ...tool, toolId: event.target.value })} required>
                <option value="">Choose a tool</option>
                {(data.tools || []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
              </Select>
            </Field>
            <Field label="Damage category" required>
              <TextInput value={tool.damageCategory} onChange={(event) => setTool({ ...tool, damageCategory: event.target.value })} placeholder="Chipping / breakage / wear" required />
            </Field>
            <Field label="Damaged quantity" required>
              <TextInput type="number" min="1" value={tool.damagedQuantity} onChange={(event) => setTool({ ...tool, damagedQuantity: event.target.value })} required />
            </Field>
            <Field label="Description" required>
              <TextInput value={tool.description} onChange={(event) => setTool({ ...tool, description: event.target.value })} placeholder="Insert edge chipped on interrupted cut." required />
            </Field>
            <Field label="Production impact" className="pt-form-span">
              <TextInput value={tool.productionImpact} onChange={(event) => setTool({ ...tool, productionImpact: event.target.value })} />
            </Field>
            <Field label="Photograph" className="pt-form-span">
              <input type="file" className="pt-file-input" accept="image/*" onChange={(event) => setEvidence(event.target.files?.[0] || null)} />
            </Field>
            <div className="pt-form-span pt-form-actions">
              <FieldHint icon="Wrench">The tool's declared unit is applied automatically.</FieldHint>
              <Button type="submit" icon="Send" disabled={busy || !canReport}>{busy ? 'Reporting…' : 'Report tool damage'}</Button>
            </div>
          </form>
        ) : null}

        {tab === 'material' ? (
          <form className="pt-form-grid" onSubmit={requestMaterial}>
            <Field label="Material" required>
              <Select
                value={material.materialId}
                onChange={(event) => {
                  const item = data.materials.find((row) => row.id === event.target.value);
                  setMaterial({ ...material, materialId: event.target.value, unit: item?.unit || '', specification: item?.specification || '', availableQuantity: item ? String(item.stockQuantity ?? '') : '' });
                }}
                required
              >
                <option value="">Choose a material</option>
                {(data.materials || []).map((item) => <option key={item.id} value={item.id}>{item.name} · stock {Number(item.stockQuantity).toLocaleString()} {item.unit}</option>)}
              </Select>
            </Field>
            <Field label="Unit" hint="Restricted to the material's declared unit.">
              <Select value={material.unit} onChange={(event) => setMaterial({ ...material, unit: event.target.value })} aria-label="Unit">
                {UNITS.map((unit) => <option key={unit} value={unit} disabled={selectedMaterial && unit !== selectedMaterial.unit}>{unit}</option>)}
              </Select>
            </Field>
            <Field label="Required quantity" required>
              <TextInput type="number" min="0" step="0.001" value={material.requiredQuantity} onChange={(event) => setMaterial({ ...material, requiredQuantity: event.target.value })} required />
            </Field>
            <Field label="Available quantity">
              <TextInput type="number" min="0" step="0.001" value={material.availableQuantity} onChange={(event) => setMaterial({ ...material, availableQuantity: event.target.value })} />
            </Field>
            <Field label="Required by">
              <TextInput type="datetime-local" value={material.requiredBy} onChange={(event) => setMaterial({ ...material, requiredBy: event.target.value })} />
            </Field>
            <Field label="Production order">
              <Select value={material.productionOrderId} onChange={(event) => setMaterial({ ...material, productionOrderId: event.target.value })}>
                <option value="">Not linked</option>
                {(data.productionOrders || []).map((order) => <option key={order.id} value={order.id}>{order.orderNo}</option>)}
              </Select>
            </Field>
            <Field label="Reason" className="pt-form-span">
              <Textarea rows={2} value={material.reason} onChange={(event) => setMaterial({ ...material, reason: event.target.value })} placeholder="M8 bolts exhausted before the bracket lot could restart." />
            </Field>
            <div className="pt-form-span pt-form-actions">
              <FieldHint icon="Send">Material requirements create a request in the shared approval workflow.</FieldHint>
              <Button type="submit" icon="Send" disabled={busy}>{busy ? 'Submitting…' : 'Request material'}</Button>
            </div>
          </form>
        ) : null}

        {tab === 'safety' ? (
          canReportSafety ? (
            <form className="pt-form-grid" onSubmit={reportSafety}>
              <Field label="Incident time">
                <TextInput type="datetime-local" value={safety.incidentAt} onChange={(event) => setSafety({ ...safety, incidentAt: event.target.value })} />
              </Field>
              <Field label="Category" required>
                <Select value={safety.category} onChange={(event) => setSafety({ ...safety, category: event.target.value })}>
                  {['injury', 'near_miss', 'first_aid', 'exposure', 'equipment_safety', 'environmental', 'other'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
                </Select>
              </Field>
              <Field label="Severity">
                <Select value={safety.severity} onChange={(event) => setSafety({ ...safety, severity: event.target.value })}>
                  {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </Field>
              <Field label="Workstation">
                <Select value={safety.workstationId} onChange={(event) => setSafety({ ...safety, workstationId: event.target.value })}>
                  <option value="">Not specified</option>
                  {(data.workstations || []).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                </Select>
              </Field>
              <Field label="Operational summary" required className="pt-form-span" hint="Operational facts only — no diagnosis or treatment detail.">
                <Textarea rows={3} value={safety.operationalSummary} onChange={(event) => setSafety({ ...safety, operationalSummary: event.target.value })} placeholder="Coolant hose detached while the guard was open; area made safe." required />
              </Field>
              <Field label="Immediate action" className="pt-form-span">
                <TextInput value={safety.immediateAction} onChange={(event) => setSafety({ ...safety, immediateAction: event.target.value })} placeholder="Machine isolated, hose clamp replaced." />
              </Field>
              <Field label="Lost time (hours)">
                <TextInput type="number" min="0" step="0.25" value={safety.lostTimeHours} onChange={(event) => setSafety({ ...safety, lostTimeHours: event.target.value })} />
              </Field>
              <Field label="Work stopped">
                <Select value={safety.workStopped ? 'yes' : 'no'} onChange={(event) => setSafety({ ...safety, workStopped: event.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </Field>
              <Field label="Supporting document" className="pt-form-span">
                <input type="file" className="pt-file-input" onChange={(event) => setEvidence(event.target.files?.[0] || null)} />
              </Field>
              <div className="pt-form-span pt-form-actions">
                <FieldHint icon="LockKeyhole">Clinical detail is stored separately and visible only to occupational health and HR.</FieldHint>
                <Button type="submit" icon="Send" disabled={busy}>{busy ? 'Recording…' : 'Report safety incident'}</Button>
              </div>
            </form>
          ) : (
            <EmptyState icon="ShieldCheck" title="Safety reporting restricted" description="Your roles do not include safety reporting." />
          )
        ) : null}
      </Card>

      <div className="pt-report-layout">
        <Card title="Reported technical issues" subtitle="Faults raised by you or your team">
          {issues.length ? (
            <div className="pt-table-scroll">
              <table className="pt-table">
                <thead><tr><th>Category</th><th>Machine</th><th>Severity</th><th>Downtime</th><th>Status</th><th>Reported</th><th /></tr></thead>
                <tbody>
                  {issues.map((issue) => {
                    const machine = data.machines.find((item) => item.id === issue.machineId);
                    return (
                      <tr key={issue.id}>
                        <td><strong>{issue.category}</strong><small className="pt-muted">{issue.description}</small></td>
                        <td>{machine?.name || '—'}</td>
                        <td><SeverityPill severity={issue.severity} /></td>
                        <td>{issue.downtimeMinutes} min</td>
                        <td><IssueStatus status={issue.status} /></td>
                        <td>{formatDateTime(issue.occurredAt)}</td>
                        <td>
                          {canManageIssues && issue.status !== 'closed' ? (
                            <Select value={issue.status} onChange={(event) => progressIssue(issue, event.target.value)} aria-label={`Status for ${issue.category}`}>
                              {['open', 'acknowledged', 'in_progress', 'resolved', 'closed'].map((value) => <option key={value} value={value}>{value}</option>)}
                            </Select>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="CheckCircle2" title="No technical issues" description="Faults reported against machines appear here." />}
        </Card>

        <aside className="pt-report-aside">
          <Card title="Tool damage" subtitle="Reported against the tooling register">
            {toolReports.length ? (
              <div className="pt-mini-table">
                {toolReports.map((report) => (
                  <div key={report.id} className="pt-mini-row">
                    <div><strong>{report.toolName}</strong><small>{Number(report.damagedQuantity)} {report.unit} · {report.damageCategory}</small></div>
                    <Badge tone={report.status === 'open' ? 'amber' : 'lime'}>{report.status}</Badge>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="Wrench" title="No tool damage reported" />}
          </Card>

          <Card title="Safety incidents" subtitle="Operational information only">
            {incidents.length ? (
              <div className="pt-safety-list">
                {incidents.map((incident) => (
                  <div key={incident.id} className="pt-safety-row">
                    <div className="pt-safety-head">
                      <Badge tone="violet">{String(incident.category).replaceAll('_', ' ')}</Badge>
                      <SeverityPill severity={incident.severity} />
                      <Badge tone="neutral">{String(incident.status).replaceAll('_', ' ')}</Badge>
                    </div>
                    <p>{incident.operationalSummary}</p>
                    <small className="pt-muted">{formatDateTime(incident.incidentAt)}{incident.lostTimeHours != null ? ` · ${incident.lostTimeHours}h lost time` : ''}</small>
                    {incident.detailAvailable ? (
                      <details className="pt-medical-detail">
                        <summary><Icon name="LockKeyhole" size={12} /> Restricted occupational-health detail</summary>
                        <dl>
                          <div><dt>Injury</dt><dd>{incident.detail?.injuryType || '—'}</dd></div>
                          <div><dt>Body part</dt><dd>{incident.detail?.bodyPart || '—'}</dd></div>
                          <div><dt>Treatment</dt><dd>{incident.detail?.treatmentGiven || '—'}</dd></div>
                          <div><dt>Fit to work</dt><dd>{incident.detail?.fitToWork || '—'}</dd></div>
                          <div><dt>Restrictions</dt><dd>{incident.detail?.restrictions || '—'}</dd></div>
                        </dl>
                        <p className="pt-muted pt-small">{incident.detail?.medicalNarrative}</p>
                      </details>
                    ) : (
                      <small className="pt-muted pt-medical-note"><Icon name="LockKeyhole" size={12} /> Medical detail is restricted to occupational health and HR.</small>
                    )}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="ShieldAlert" title="No safety incidents" description="Operational safety records in your scope appear here." />}
          </Card>

          <Card title="Material requests" subtitle="Shared approval workflow">
            {materialRequests.length ? (
              <div className="pt-mini-table">
                {materialRequests.map((row) => (
                  <div key={row.requestId} className="pt-mini-row">
                    <div><strong>{row.material?.name || 'Material'}</strong><small>{Number(row.requiredQuantity).toLocaleString()} {row.unit} · {row.material?.stockQuantity != null ? `${Number(row.material.stockQuantity).toLocaleString()} in stock` : 'stock unknown'}</small></div>
                    <Badge tone={row.request?.status === 'approved' ? 'lime' : row.request?.status === 'rejected' ? 'red' : 'amber'}>{row.request?.status || 'submitted'}</Badge>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="Box" title="No material requests" />}
          </Card>
        </aside>
      </div>
    </div>
  );
}
