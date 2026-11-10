import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { requestsFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { createRequest } from '../data/actions.js';
import { navigate, queryParam } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  Textarea,
  Tabs,
  currency,
  formatDate,
  formatDateTime,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const REQUEST_TYPES = [
  { value: 'leave', label: 'Leave' },
  { value: 'expense', label: 'Expense reimbursement' },
  { value: 'purchase', label: 'Purchase request' },
  { value: 'access', label: 'Access request' },
  { value: 'shift_swap', label: 'Shift swap' },
  { value: 'attendance', label: 'Attendance regularization' },
  { value: 'profile', label: 'Profile update' },
  { value: 'customer_evidence', label: 'Customer evidence approval' },
];

export default function RequestsPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const [tab, setTab] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ requestType: 'leave', title: '', details: '', amount: '', customerVisible: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requests = useMemo(() => (workspace.data && context ? requestsFor(workspace.data, context) : []), [workspace.data, context]);

  useEffect(() => {
    const requested = queryParam('new');
    if (requested) {
      setForm((current) => ({ ...current, requestType: requested === '1' ? 'leave' : requested === 'shift' ? 'shift_swap' : requested === 'attendance' ? 'attendance' : requested === 'profile' ? 'profile' : requested }));
      setFormOpen(true);
      const details = queryParam('details');
      if (details) setForm((current) => ({ ...current, details }));
    }
  }, []);

  const mine = requests.filter((request) => request.employeeId === context.employeeId);
  const team = requests.filter((request) => request.employeeId !== context.employeeId);
  const visible = tab === 'mine' ? mine : tab === 'team' ? team : requests;
  const pending = requests.filter((request) => request.status === 'submitted');

  function closeForm() {
    setFormOpen(false);
    setError('');
    if (queryParam('new')) navigate('/requests', { replace: true });
  }

  async function submitRequest(event) {
    event.preventDefault();
    setError('');
    if (!form.title.trim() || !form.details.trim()) {
      setError('Add a short title and enough detail for the approver.');
      return;
    }
    setBusy(true);
    try {
      const result = await createRequest({
        requestType: form.requestType,
        title: form.title.trim(),
        details: form.details.trim(),
        amount: form.amount || null,
        customerVisible: form.customerVisible,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      notify('Request submitted and routed to your approver.');
      closeForm();
      setForm({ requestType: 'leave', title: '', details: '', amount: '', customerVisible: false });
      await workspace.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'My requests']}
        eyebrow="SERVICE REQUESTS"
        title="My requests"
        description="Leave, expenses, access and evidence approvals routed through the organization's approval authority."
        actions={<Button icon="Plus" onClick={() => setFormOpen(true)}>New request</Button>}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Open requests" value={pending.length} icon="Inbox" footnote={`${mine.filter((request) => request.status === 'submitted').length} of yours`} />
        <StatCard label="Approved" value={requests.filter((request) => request.status === 'approved').length} icon="CheckCircle2" tone="lime" footnote="Visible history" />
        <StatCard label="Needs changes" value={requests.filter((request) => request.status === 'rejected').length} icon="AlertTriangle" tone="warn" footnote="Rejected or returned" />
        <StatCard label="Approval steps" value={requests.reduce((total, request) => total + request.approvals.length, 0)} icon="BadgeCheck" footnote="Across visible requests" />
      </section>

      <Card
        padded={false}
        title="Request register"
        subtitle={`${requests.length} visible requests`}
        action={
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: requests.length },
              { id: 'mine', label: 'Raised by me', count: mine.length },
              ...(hasPermission(context.permissions, 'requests.read.all') ? [{ id: 'team', label: 'In scope', count: team.length }] : []),
            ]}
          />
        }
      >
        <DataTable
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: 'title', label: 'Request', render: (row) => <span className="pt-table-primary"><strong>{row.title}</strong><small>{row.requestType.replaceAll('_', ' ')} · {row.details.slice(0, 70)}{row.details.length > 70 ? '…' : ''}</small></span> },
            { key: 'employee', label: 'Raised by', render: (row) => <span className="pt-person-cell"><Avatar name={row.employee?.fullName} size="xs" /><span>{row.employee?.fullName}<small>{row.departmentId?.replace('dept-', '')}</small></span></span> },
            { key: 'amount', label: 'Amount', align: 'right', render: (row) => row.amount ? <span className="pt-mono">{currency(row.amount)}</span> : <span className="pt-muted">—</span> },
            { key: 'submitted', label: 'Submitted', render: (row) => <span className="pt-muted">{relativeTime(row.submittedAt)}<small className="pt-block">{formatDate(row.submittedAt)}</small></span> },
            { key: 'approver', label: 'Current approver', render: (row) => row.approver ? <span className="pt-muted">{row.approver.fullName}</span> : <span className="pt-muted">Decided</span> },
            { key: 'status', label: 'Status', align: 'right', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          rows={visible}
          empty={<EmptyState icon="FileText" title="No requests yet" description="Raise a request to start an approval workflow." action={<Button icon="Plus" onClick={() => setFormOpen(true)}>New request</Button>} />}
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title="New request"
        description="We route this to the configured approval authority based on type, department and plant."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button icon="Send" onClick={submitRequest} disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</Button>
          </>
        }
      >
        <form className="pt-form-grid" onSubmit={submitRequest}>
          {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
          <Field label="Request type" required>
            <Select value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })}>
              {REQUEST_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
          </Field>
          <Field label="Short title" required>
            <TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Earned leave — 2 days" />
          </Field>
          <Field label="Details" required className="pt-span-2" hint="Include dates, justification and any evidence referenced.">
            <Textarea rows={5} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Describe the request…" />
          </Field>
          {(form.requestType === 'expense' || form.requestType === 'purchase') && (
            <Field label="Amount (INR)" hint="Amounts above the configured threshold escalate to Finance.">
              <TextInput type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" />
            </Field>
          )}
          {form.requestType === 'customer_evidence' && (
            <label className="pt-checkbox pt-span-2">
              <input type="checkbox" checked={form.customerVisible} onChange={(event) => setForm({ ...form, customerVisible: event.target.checked })} />
              <span><strong>Make visible to assigned customer approver</strong><small>Only the customer approver scoped to this project can see it.</small></span>
            </label>
          )}
        </form>
      </Modal>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || 'Request'} description={selected ? `${selected.requestType.replaceAll('_', ' ')} · raised by ${selected.employee?.fullName}` : ''} size="lg">
        {selected && (
          <div className="pt-request-detail">
            <div className="pt-request-detail-head">
              <StatusBadge status={selected.status} />
              <Badge tone="neutral">#{selected.id.slice(-8)}</Badge>
              {selected.amount && <Badge tone="blue">{currency(selected.amount)}</Badge>}
            </div>
            <p>{selected.details}</p>
            <div className="pt-request-meta">
              <span><small>Submitted</small><strong>{formatDateTime(selected.submittedAt)}</strong></span>
              <span><small>Current approver</small><strong>{selected.approver?.fullName || 'Decided'}</strong></span>
              <span><small>Plant / department</small><strong>{selected.plantId?.replace('plant-', '')} · {selected.departmentId?.replace('dept-', '')}</strong></span>
            </div>
            <h4>Approval trail</h4>
            <div className="pt-approval-trail">
              {selected.approvals.map((step) => (
                <div key={step.id} className={`pt-approval-step ${step.status}`}>
                  <span className="pt-approval-step-icon"><Icon name={step.status === 'approved' ? 'Check' : step.status === 'rejected' ? 'X' : step.status === 'pending' ? 'Clock' : 'Circle'} size={14} /></span>
                  <div>
                    <strong>Step {step.step} · {workspace.data.employeesById[step.approverEmployeeId]?.fullName || 'Approver'}</strong>
                    <small>{step.status === 'pending' ? 'Waiting for decision' : step.decidedAt ? formatDateTime(step.decidedAt) : 'Not started'}</small>
                    {step.comments && <p>{step.comments}</p>}
                  </div>
                  <StatusBadge status={step.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
