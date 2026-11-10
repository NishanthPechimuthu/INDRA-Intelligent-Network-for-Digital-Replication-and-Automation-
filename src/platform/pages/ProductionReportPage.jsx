import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import {
  defectsByReason,
  productionOrderRows,
  productFor,
  reportingSummary,
  reportsForEmployee,
  reportsForScope,
  summariseReports,
  tasksForEmployee,
} from '../data/productionSelectors.js';
import { hasPermission } from '../data/accessControl.js';
import { submitProductionReport, uploadEvidence } from '../data/actions.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  StatCard,
  TextInput,
  Textarea,
  Progress,
  formatDateTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { FieldHint } from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const UNIT_OPTIONS = ['pcs', 'kg', 'g', 'l', 'm', 'mm'];

function nowLocal(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Production entry.
 *
 * Total produced is derived as good + rejected so an entry can never double
 * count. Rework is captured as a subset of rejects, matching the SQL constraint.
 * Materials are restricted to their declared unit.
 */
export default function ProductionReportPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [form, setForm] = useState({
    productionOrderId: '',
    taskId: '',
    workstationId: '',
    machineId: '',
    productId: '',
    batchNo: '',
    shiftId: '',
    startedAt: nowLocal(-120),
    endedAt: nowLocal(0),
    goodPieces: '',
    rejectedPieces: '',
    reworkPieces: '',
    downtimeMinutes: '',
    downtimeReason: '',
    remarks: '',
  });
  const [materials, setMaterials] = useState([]);

  const canReport = hasPermission(context?.permissions, 'production.reports.create');
  const orders = useMemo(() => productionOrderRows(data).filter((order) => !['completed', 'cancelled'].includes(order.status)), [data]);
  const order = orders.find((item) => item.id === form.productionOrderId) || null;
  const product = order ? productFor(data, order) : null;
  const myTasks = useMemo(() => (data && context ? tasksForEmployee(data, context.employeeId) : []), [data, context]);
  const orderTasks = myTasks.filter((task) => !order || task.productionOrderId === order.id);
  const canReadAll = hasPermission(context?.permissions, 'production.reports.read');
  const reports = useMemo(() => (data && context ? (canReadAll ? reportsForScope(data, context) : reportsForEmployee(data, context.employeeId)) : []), [data, context, canReadAll]);
  const summary = useMemo(() => summariseReports(reports), [reports]);
  const view = useMemo(() => reportingSummary(data, reports), [data, reports]);
  const defectReasons = useMemo(() => defectsByReason(reports), [reports]);
  const today = new Date().toISOString().slice(0, 10);
  const todaySummary = summariseReports(reports.filter((report) => report.workDate === today));

  const good = Number(form.goodPieces || 0);
  const rejected = Number(form.rejectedPieces || 0);
  const rework = Number(form.reworkPieces || 0);
  const total = good + rejected;
  const reworkInvalid = rework > rejected;

  function set(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'productionOrderId') {
        const selected = orders.find((item) => item.id === value);
        next.productId = selected?.productId || '';
        next.batchNo = selected?.batchNo || '';
        next.taskId = '';
        next.workstationId = '';
        next.machineId = '';
      }
      if (field === 'taskId') {
        const task = myTasks.find((item) => item.id === value);
        if (task) {
          next.workstationId = task.workstationId || '';
          next.machineId = task.machineId || '';
        }
      }
      return next;
    });
  }

  function addMaterial() {
    setMaterials((current) => [...current, { materialId: '', quantity: '', unit: '' }]);
  }

  function updateMaterial(index, patch) {
    setMaterials((current) => current.map((row, position) => {
      if (position !== index) return row;
      const next = { ...row, ...patch };
      if (patch.materialId) {
        const material = data.materials.find((item) => item.id === patch.materialId);
        next.unit = material?.unit || '';
      }
      return next;
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.productionOrderId) return notify('Select the production order.', 'error');
    if (total <= 0) return notify('Enter the quantities produced.', 'error');
    if (reworkInvalid) return notify('Rework pieces cannot exceed rejected pieces.', 'error');
    if (new Date(form.endedAt) < new Date(form.startedAt)) return notify('End time must be after the start time.', 'error');
    setBusy(true);
    let evidenceDocumentId = null;
    if (evidence) {
      const upload = await uploadEvidence({
        file: evidence,
        organizationId: context.scope.organizationId,
        employeeId: context.employeeId,
      });
      if (upload.error) {
        setBusy(false);
        return notify(`Evidence upload failed: ${upload.error.message}`, 'error');
      }
      evidenceDocumentId = upload.data.id;
    }
    const result = await submitProductionReport({
      productionOrderId: form.productionOrderId,
      taskId: form.taskId || null,
      workstationId: form.workstationId || null,
      machineId: form.machineId || null,
      productId: form.productId || product?.id || null,
      batchNo: form.batchNo || null,
      shiftId: form.shiftId || null,
      shiftCode: data.shifts?.find((shift) => shift.id === form.shiftId)?.code || null,
      workDate: form.startedAt.slice(0, 10),
      startedAt: new Date(form.startedAt).toISOString(),
      endedAt: new Date(form.endedAt).toISOString(),
      totalProduced: total,
      goodPieces: good,
      rejectedPieces: rejected,
      reworkPieces: rework,
      downtimeMinutes: Number(form.downtimeMinutes || 0),
      downtimeReason: form.downtimeReason || null,
      remarks: form.remarks || null,
      evidenceDocumentId,
      materials: materials
        .filter((row) => row.materialId && Number(row.quantity) > 0)
        .map((row) => ({ materialId: row.materialId, quantity: Number(row.quantity), unit: row.unit })),
    });
    setBusy(false);
    if (result.error) return notify(result.error.message, 'error');
    notify(`Recorded ${total} pcs (${good} good / ${rejected} rejected). Task and order totals updated.`);
    setForm((current) => ({ ...current, goodPieces: '', rejectedPieces: '', reworkPieces: '', downtimeMinutes: '', downtimeReason: '', remarks: '' }));
    setMaterials([]);
    setEvidence(null);
    await workspace.refresh();
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Production', 'Reporting']}
        eyebrow="PRODUCTION REPORTING"
        title="Record production"
        description="One entry per task and shift. Total produced is always good plus rejected, and rework is counted inside rejects."
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Good today" value={todaySummary.good.toLocaleString()} unit="pcs" icon="CheckCircle2" tone="lime" footnote={`${todaySummary.entries} entries`} />
        <StatCard label="Rejected today" value={todaySummary.rejected.toLocaleString()} unit="pcs" icon="AlertTriangle" tone={todaySummary.rejected ? 'warn' : 'default'} footnote={`${todaySummary.rework} rework`} />
        <StatCard label="Downtime today" value={todaySummary.downtime} unit="min" icon="Timer" footnote="Recorded against entries" />
        <StatCard
          label="Rejection rate"
          value={`${summary.produced ? ((summary.rejected / summary.produced) * 100).toFixed(1) : '0.0'}%`}
          icon="TrendingUp"
          footnote={`Across ${summary.entries} visible entries`}
        />
      </section>

      <div className="pt-report-layout">
        <Card title="Production entry" subtitle="Validated on submit and again in PostgreSQL">
          {!canReport ? (
            <EmptyState icon="LockKeyhole" title="Reporting not permitted" description="Your roles do not include production reporting." />
          ) : (
            <form className="pt-form-grid" onSubmit={submit}>
              <Field label="Production order" required className="pt-form-span">
                <Select value={form.productionOrderId} onChange={(event) => set('productionOrderId', event.target.value)} required>
                  <option value="">Choose an order</option>
                  {orders.map((item) => (
                    <option key={item.id} value={item.id}>{item.orderNo} · {productFor(data, item)?.name} · {Number(item.quantityPlanned).toLocaleString()} pcs</option>
                  ))}
                </Select>
              </Field>
              <Field label="Task">
                <Select value={form.taskId} onChange={(event) => set('taskId', event.target.value)}>
                  <option value="">Not linked to a task</option>
                  {orderTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </Select>
              </Field>
              <Field label="Shift">
                <Select value={form.shiftId} onChange={(event) => set('shiftId', event.target.value)}>
                  <option value="">Not specified</option>
                  {(data.shifts || []).map((shift) => <option key={shift.id} value={shift.id}>{shift.code} · {shift.startTime}–{shift.endTime}</option>)}
                </Select>
              </Field>
              <Field label="Workstation">
                <Select value={form.workstationId} onChange={(event) => set('workstationId', event.target.value)}>
                  <option value="">Not specified</option>
                  {(data.workstations || []).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                </Select>
              </Field>
              <Field label="Machine">
                <Select value={form.machineId} onChange={(event) => set('machineId', event.target.value)}>
                  <option value="">Not specified</option>
                  {(data.machines || []).map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
                </Select>
              </Field>
              <Field label="Product">
                <TextInput value={product?.name || ''} readOnly placeholder="Derived from the order" />
              </Field>
              <Field label="Batch number">
                <TextInput value={form.batchNo} onChange={(event) => set('batchNo', event.target.value)} placeholder="B-2026-0141-A" />
              </Field>
              <Field label="Start time" required>
                <TextInput type="datetime-local" value={form.startedAt} onChange={(event) => set('startedAt', event.target.value)} required />
              </Field>
              <Field label="End time" required>
                <TextInput type="datetime-local" value={form.endedAt} onChange={(event) => set('endedAt', event.target.value)} required />
              </Field>
              <Field label="Good pieces" required>
                <TextInput type="number" min="0" value={form.goodPieces} onChange={(event) => set('goodPieces', event.target.value)} placeholder="0" required />
              </Field>
              <Field label="Rejected pieces">
                <TextInput type="number" min="0" value={form.rejectedPieces} onChange={(event) => set('rejectedPieces', event.target.value)} placeholder="0" />
              </Field>
              <Field label="Rework pieces" error={reworkInvalid ? 'Rework cannot exceed rejects.' : ''} hint="Counted inside rejects, never added again.">
                <TextInput type="number" min="0" value={form.reworkPieces} onChange={(event) => set('reworkPieces', event.target.value)} placeholder="0" />
              </Field>
              <Field label="Total produced" hint="Derived: good + rejected.">
                <TextInput value={total} readOnly className="pt-mono" />
              </Field>
              <Field label="Downtime (minutes)">
                <TextInput type="number" min="0" value={form.downtimeMinutes} onChange={(event) => set('downtimeMinutes', event.target.value)} placeholder="0" />
              </Field>
              <Field label="Downtime reason">
                <TextInput value={form.downtimeReason} onChange={(event) => set('downtimeReason', event.target.value)} placeholder="Tool change / material wait" />
              </Field>
              <Field label="Remarks" className="pt-form-span">
                <Textarea rows={2} value={form.remarks} onChange={(event) => set('remarks', event.target.value)} placeholder="First-off verified against drawing AX-114 rev C." />
              </Field>
              <Field label="Evidence" className="pt-form-span" hint="Photo, inspection sheet or machine log. Stored privately.">
                <input type="file" className="pt-file-input" onChange={(event) => setEvidence(event.target.files?.[0] || null)} />
              </Field>

              <div className="pt-form-span pt-material-lines">
                <div className="pt-material-head">
                  <h4><Icon name="Box" size={14} /> Material consumed</h4>
                  <Button type="button" size="sm" variant="secondary" icon="Plus" onClick={addMaterial}>Add material</Button>
                </div>
                {materials.length ? materials.map((row, index) => {
                  const material = data.materials.find((item) => item.id === row.materialId);
                  return (
                    <div key={index} className="pt-material-row">
                      <Select value={row.materialId} onChange={(event) => updateMaterial(index, { materialId: event.target.value })} aria-label="Material">
                        <option value="">Choose material</option>
                        {(data.materials || []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
                      </Select>
                      <TextInput type="number" min="0" step="0.001" value={row.quantity} onChange={(event) => updateMaterial(index, { quantity: event.target.value })} placeholder="Quantity" aria-label="Quantity" />
                      <Select value={row.unit} onChange={(event) => updateMaterial(index, { unit: event.target.value })} aria-label="Unit">
                        {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </Select>
                      <Button type="button" size="sm" variant="ghost" icon="X" onClick={() => setMaterials((current) => current.filter((_, position) => position !== index))}>Remove</Button>
                      {material && row.unit && material.unit !== row.unit ? (
                        <small className="pt-form-error">Only {material.unit} is compatible with {material.name}.</small>
                      ) : null}
                    </div>
                  );
                }) : <p className="pt-muted pt-small">No material lines recorded for this entry.</p>}
              </div>

              <div className="pt-form-span pt-form-actions">
                <FieldHint icon="ShieldCheck">The order, task and scope are re-checked by PostgreSQL before the entry is stored.</FieldHint>
                <Button type="submit" icon="Check" disabled={busy}>{busy ? 'Recording…' : 'Record production'}</Button>
              </div>
            </form>
          )}
        </Card>

        <aside className="pt-report-aside">
          <Card title="Shift summary" subtitle="This shift versus the previous">
            {view.shifts.length ? view.shifts.slice(0, 4).map((shift) => (
              <div key={shift.key} className="pt-summary-row">
                <div>
                  <strong>{shift.shiftCode}</strong>
                  <small>{shift.date}</small>
                </div>
                <div className="pt-summary-numbers">
                  <span>{shift.good.toLocaleString()} good</span>
                  <span className={shift.rejected ? 'pt-warn-text' : 'pt-muted'}>{shift.rejected} rejected</span>
                </div>
                <Progress value={shift.produced ? (shift.good / shift.produced) * 100 : 0} />
              </div>
            )) : <EmptyState icon="Timer" title="No shift data yet" />}
          </Card>

          <Card title="Defect reasons" subtitle="Rejects grouped by recorded reason">
            {defectReasons.length ? (
              <ul className="pt-defect-list">
                {defectReasons.map((row) => (
                  <li key={row.reason}>
                    <span>{row.reason}</span>
                    <strong>{row.pieces}</strong>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="CheckCircle2" title="No rejects recorded" />}
          </Card>
        </aside>
      </div>

      <Card title="Recent entries" subtitle="Latest production records visible to you">
        {reports.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead><tr><th>Date</th><th>Order</th><th>Shift</th><th>Total</th><th>Good</th><th>Rejected</th><th>Rework</th><th>Downtime</th><th>Reported by</th></tr></thead>
              <tbody>
                {reports.slice(0, 12).map((report) => (
                  <tr key={report.id}>
                    <td>{report.workDate}<small className="pt-muted">{formatDateTime(report.startedAt)}</small></td>
                    <td className="pt-mono">{data.productionOrders.find((item) => item.id === report.productionOrderId)?.orderNo || '—'}</td>
                    <td>{report.shiftCode || '—'}</td>
                    <td className="pt-mono">{Number(report.totalProduced).toLocaleString()}</td>
                    <td className="pt-mono">{Number(report.goodPieces).toLocaleString()}</td>
                    <td className="pt-mono">{Number(report.rejectedPieces).toLocaleString()}</td>
                    <td className="pt-mono">{Number(report.reworkPieces || 0).toLocaleString()}</td>
                    <td>{report.downtimeMinutes ? <Badge tone="amber">{report.downtimeMinutes} min</Badge> : <span className="pt-muted">—</span>}</td>
                    <td>{data.employees.find((item) => item.id === report.reportedByEmployeeId)?.fullName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="FileText" title="No production recorded" description="Entries you record appear here with their defect and downtime detail." />
        )}
      </Card>
    </div>
  );
}
