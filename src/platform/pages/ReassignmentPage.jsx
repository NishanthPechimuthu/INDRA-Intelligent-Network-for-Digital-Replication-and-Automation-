import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { scopedEmployees } from '../data/selectors.js';
import { productionTaskRows, reassignmentProposals } from '../data/productionSelectors.js';
import { hasPermission } from '../data/accessControl.js';
import { decideApproval, submitReassignment } from '../data/actions.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DefinitionGrid,
  EmptyState,
  Field,
  Modal,
  Select,
  StatCard,
  Textarea,
  TextInput,
  formatDateTime,
  LoadingBlock,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { FieldHint } from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const STATUS_TONE = { submitted: 'amber', approved: 'lime', applied: 'lime', rejected: 'red', cancelled: 'neutral' };

/**
 * Reassignment workflow.
 *
 * A supervisor proposes; the original assignment is untouched until an
 * authorised approver decides. Validation (leave, skills, certifications,
 * working hours, shift overlap, machine authorisation) runs inside the RPC.
 */
export default function ReassignmentPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState(null);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    currentTaskId: '',
    proposedTaskId: '',
    currentWorkstationId: '',
    proposedWorkstationId: '',
    currentShiftId: '',
    proposedShiftId: '',
    competencyRequirements: '',
    reason: '',
    effectiveAt: '',
  });

  const proposals = useMemo(() => (data && context ? reassignmentProposals(data, context) : []), [data, context]);
  const employees = useMemo(() => (data && context ? scopedEmployees(data, context) : []), [data, context]);
  const tasks = useMemo(() => productionTaskRows(data), [data]);
  const canCreate = hasPermission(context?.permissions, 'reassignment.create');
  const canApprove = hasPermission(context?.permissions, 'reassignment.approve');
  const pending = proposals.filter((proposal) => proposal.status === 'submitted');

  const employeeTasks = tasks.filter((task) => task.assigneeEmployeeId === form.employeeId);
  const selectedEmployee = employees.find((employee) => employee.id === form.employeeId);

  function pickEmployee(employeeId) {
    const employee = employees.find((item) => item.id === employeeId);
    const current = tasks.find((task) => task.assigneeEmployeeId === employeeId && !['completed', 'cancelled'].includes(task.productionStatus));
    setForm((current_) => ({
      ...current_,
      employeeId,
      currentTaskId: current?.id || '',
      currentWorkstationId: current?.workstationId || '',
      currentShiftId: '',
      competencyRequirements: employee ? `${employee.designation} competency and machine authorization for the proposed workstation.` : '',
    }));
  }

  async function createProposal(event) {
    event.preventDefault();
    if (!form.employeeId || !form.reason.trim()) {
      return notify('Choose an employee and give a reason for the move.', 'error');
    }
    setBusy(true);
    const result = await submitReassignment({
      ...form,
      effectiveAt: form.effectiveAt ? new Date(form.effectiveAt).toISOString() : new Date().toISOString(),
    });
    setBusy(false);
    if (result.error) return notify(result.error.message, 'error');
    notify('Reassignment submitted. The current assignment is preserved until it is approved.');
    setCreateOpen(false);
    setForm({ employeeId: '', currentTaskId: '', proposedTaskId: '', currentWorkstationId: '', proposedWorkstationId: '', currentShiftId: '', proposedShiftId: '', competencyRequirements: '', reason: '', effectiveAt: '' });
    await workspace.refresh();
    return null;
  }

  async function decide(proposal, verdict) {
    if (!proposal.approval) {
      notify('This proposal has no pending approval step.', 'error');
      return;
    }
    setError('');
    setBusy(true);
    const result = await decideApproval({ requestId: proposal.requestId, approvalId: proposal.approval.id, decision: verdict, comments });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify(verdict === 'approved' ? 'Reassignment approved and applied.' : 'Reassignment rejected.');
    setDecision(null);
    setComments('');
    await workspace.refresh();
  }

  if (!context) return null;
  if (!data) return <div className="pt-page"><LoadingBlock rows={3} label="Loading reassignment data" /></div>;

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Operations', 'Reassignments']}
        eyebrow="ASSIGNMENT WORKFLOW"
        title="Reassignment requests"
        description="Move an employee only after the proposal is approved. Validation covers leave, skills, certifications, working hours, shift overlap and machine authorisation."
        actions={canCreate ? <Button icon="Plus" onClick={() => setCreateOpen(true)}>Propose reassignment</Button> : null}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Awaiting decision" value={pending.length} icon="UserRoundCheck" tone={pending.length ? 'warn' : 'default'} footnote="Preserved assignments" />
        <StatCard label="Applied" value={proposals.filter((proposal) => proposal.status === 'applied').length} icon="CheckCircle2" tone="lime" footnote="Effective and recorded" />
        <StatCard label="Rejected" value={proposals.filter((proposal) => proposal.status === 'rejected').length} icon="Ban" footnote="Original assignment kept" />
        <StatCard label="Team in scope" value={employees.length} icon="Users" footnote="Eligible for proposals" />
      </section>

      {proposals.length ? (
        <div className="pt-reassignment-list">
          {proposals.map((proposal) => (
            <Card
              key={proposal.requestId}
              title={proposal.employee?.fullName || 'Employee'}
              subtitle={proposal.request?.title || 'Reassignment'}
              action={<Badge tone={STATUS_TONE[proposal.status] || 'neutral'} dot>{proposal.status}</Badge>}
            >
              <div className="pt-reassignment-body">
                <div className="pt-reassignment-person">
                  <Avatar name={proposal.employee?.fullName} size="md" />
                  <div>
                    <strong>{proposal.employee?.fullName}</strong>
                    <small>{proposal.employee?.designation} · {proposal.employee?.department}</small>
                    <small className="pt-muted">Requested by {data.employees.find((employee) => employee.id === proposal.createdByEmployeeId)?.fullName || 'supervisor'} · {formatDateTime(proposal.request?.submittedAt || proposal.effectiveAt)}</small>
                  </div>
                </div>

                <div className="pt-reassignment-change">
                  <div className="pt-change-side">
                    <small>Current assignment</small>
                    <strong>{proposal.currentTask?.title || 'No active task'}</strong>
                    <span className="pt-muted">{data.workstations.find((station) => station.id === proposal.currentWorkstationId)?.name || '—'}</span>
                    <span className="pt-muted">{proposal.currentShift?.name || 'Shift unchanged'}</span>
                  </div>
                  <span className="pt-change-arrow"><Icon name="ArrowRight" size={18} /></span>
                  <div className="pt-change-side pt-change-proposed">
                    <small>Proposed assignment</small>
                    <strong>{proposal.proposedTask?.title || 'Workstation change'}</strong>
                    <span className="pt-muted">{data.workstations.find((station) => station.id === proposal.proposedWorkstationId)?.name || '—'}</span>
                    <span className="pt-muted">{proposal.proposedShift?.name || 'Shift unchanged'}</span>
                  </div>
                </div>

                <DefinitionGrid columns={3}>
                  <span><small>Effective</small><strong>{formatDateTime(proposal.effectiveAt)}</strong></span>
                  <span><small>Approver</small><strong>{data.employees.find((employee) => employee.id === proposal.approval?.approverEmployeeId)?.fullName || 'HOD'}</strong></span>
                  <span><small>Decision</small><strong>{proposal.status === 'submitted' ? 'Pending' : proposal.status}</strong></span>
                </DefinitionGrid>

                <div className="pt-reassignment-reason">
                  <h4><Icon name="MessageSquare" size={13} /> Reason</h4>
                  <p>{proposal.reason}</p>
                  {proposal.competencyRequirements ? <p className="pt-muted pt-small">Competency: {proposal.competencyRequirements}</p> : null}
                </div>

                {canApprove && proposal.approval ? (
                  <div className="pt-reassignment-actions">
                    <Button variant="secondary" icon="Eye" onClick={() => { setDecision({ ...proposal, verdict: 'rejected' }); setComments(''); setError(''); }}>Reject</Button>
                    <Button icon="Check" onClick={() => { setDecision({ ...proposal, verdict: 'approved' }); setComments(''); setError(''); }}>Approve reassignment</Button>
                  </div>
                ) : proposal.status === 'submitted' ? (
                  <p className="pt-muted pt-small"><Icon name="Clock3" size={12} /> Waiting for the authorised approver. The original assignment stays in place.</p>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon="UserRoundCheck" title="No reassignment proposals" description="Supervisors propose moves when a task is blocked and another operator is needed." action={canCreate ? <Button size="sm" icon="Plus" onClick={() => setCreateOpen(true)}>Propose reassignment</Button> : null} />
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Propose reassignment"
        description="Nothing changes until an HOD or delegated approver decides."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button icon="Send" onClick={createProposal} disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval'}</Button>
          </>
        }
      >
        <form className="pt-form-grid" onSubmit={createProposal}>
          <Field label="Employee" required>
            <Select value={form.employeeId} onChange={(event) => pickEmployee(event.target.value)} required>
              <option value="">Choose an employee</option>
              {employees.filter((employee) => employee.id !== context.employeeId).map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.designation}</option>
              ))}
            </Select>
          </Field>
          <Field label="Effective from">
            <TextInput type="datetime-local" value={form.effectiveAt} onChange={(event) => setForm({ ...form, effectiveAt: event.target.value })} />
          </Field>
          <Field label="Current task">
            <Select value={form.currentTaskId} onChange={(event) => setForm({ ...form, currentTaskId: event.target.value })}>
              <option value="">No active task</option>
              {employeeTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </Select>
          </Field>
          <Field label="Proposed task">
            <Select value={form.proposedTaskId} onChange={(event) => setForm({ ...form, proposedTaskId: event.target.value })}>
              <option value="">No specific task</option>
              {tasks.filter((task) => task.assigneeEmployeeId !== form.employeeId && !['completed', 'cancelled'].includes(task.productionStatus)).map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Current workstation">
            <Select value={form.currentWorkstationId} onChange={(event) => setForm({ ...form, currentWorkstationId: event.target.value })}>
              <option value="">Not specified</option>
              {(data.workstations || []).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
            </Select>
          </Field>
          <Field label="Proposed workstation">
            <Select value={form.proposedWorkstationId} onChange={(event) => setForm({ ...form, proposedWorkstationId: event.target.value })}>
              <option value="">Not specified</option>
              {(data.workstations || []).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
            </Select>
          </Field>
          <Field label="Current shift">
            <Select value={form.currentShiftId} onChange={(event) => setForm({ ...form, currentShiftId: event.target.value })}>
              <option value="">Unchanged</option>
              {(data.shifts || []).map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </Select>
          </Field>
          <Field label="Proposed shift">
            <Select value={form.proposedShiftId} onChange={(event) => setForm({ ...form, proposedShiftId: event.target.value })}>
              <option value="">Unchanged</option>
              {(data.shifts || []).map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}
            </Select>
          </Field>
          <Field label="Competency requirements" className="pt-form-span" hint={selectedEmployee ? `Validated against ${selectedEmployee.fullName}'s skills and certifications.` : ''}>
            <TextInput value={form.competencyRequirements} onChange={(event) => setForm({ ...form, competencyRequirements: event.target.value })} />
          </Field>
          <Field label="Reason" required className="pt-form-span">
            <Textarea rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Grinding is blocked on spindle inspection; the weld cell needs a second operator." required />
          </Field>
          <div className="pt-form-span">
            <FieldHint icon="ShieldCheck">Leave, employment status, certifications, machine authorisation and shift overlap are re-checked server-side.</FieldHint>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.verdict === 'approved' ? 'Approve reassignment' : 'Reject reassignment'}
        description={decision ? `${decision.employee?.fullName} · proposed by ${data.employees.find((employee) => employee.id === decision.createdByEmployeeId)?.fullName || 'supervisor'}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
            <Button variant={decision?.verdict === 'approved' ? 'primary' : 'danger'} icon={decision?.verdict === 'approved' ? 'Check' : 'X'} onClick={() => decide(decision, decision.verdict)} disabled={busy}>
              {busy ? 'Recording…' : decision?.verdict === 'approved' ? 'Apply reassignment' : 'Reject proposal'}
            </Button>
          </>
        }
      >
        <div className="pt-decision-form">
          {error ? <div className="pt-form-error"><Icon name="AlertTriangle" size={15} /> {error}</div> : null}
          <DefinitionGrid columns={2}>
            <span><small>Current task</small><strong>{decision?.currentTask?.title || '—'}</strong></span>
            <span><small>Proposed task</small><strong>{decision?.proposedTask?.title || '—'}</strong></span>
            <span><small>Effective</small><strong>{decision ? formatDateTime(decision.effectiveAt) : '—'}</strong></span>
            <span><small>Reason</small><strong>{decision?.reason}</strong></span>
          </DefinitionGrid>
          <Field label="Decision comment" hint={decision?.verdict === 'rejected' ? 'Explain what needs to change.' : 'Recorded on the approval and audit trail.'}>
            <Textarea rows={3} value={comments} onChange={(event) => setComments(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
