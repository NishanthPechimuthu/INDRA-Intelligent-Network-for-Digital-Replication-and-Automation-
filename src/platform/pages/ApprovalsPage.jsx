import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { approvalsFor } from '../data/selectors.js';
import { canApproveRequest, hasPermission } from '../data/accessControl.js';
import { decideApproval } from '../data/actions.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  StatCard,
  StatusBadge,
  Textarea,
  currency,
  formatDate,
  formatDateTime,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

export default function ApprovalsPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approvals = useMemo(() => (workspace.data && context ? approvalsFor(workspace.data, context) : []), [workspace.data, context]);
  const decidedHistory = useMemo(() => {
    if (!workspace.data || !context) return [];
    return (workspace.data.approvals || [])
      .filter((step) => step.approverEmployeeId === context.employeeId && ['approved', 'rejected'].includes(step.status))
      .map((step) => ({ ...step, request: workspace.data.requests.find((item) => item.id === step.requestId) }))
      .slice(0, 12);
  }, [workspace.data, context]);

  const canApprove = hasPermission(context?.permissions, 'requests.approve');
  const amount = approvals.reduce((total, step) => total + (step.request?.amount || 0), 0);
  const leaveCount = approvals.filter((step) => step.request?.requestType === 'leave').length;

  function openDecision(step, nextDecision) {
    setSelected(step);
    setDecision(nextDecision);
    setComments('');
    setError('');
  }

  async function submitDecision() {
    if (!selected) return;
    const allowed = canApproveRequest(context, {
      employeeId: selected.request.employeeId,
      plantId: selected.request.plantId,
      departmentId: selected.request.departmentId,
      approverId: selected.approverEmployeeId,
      status: selected.request.status,
      customerVisible: selected.request.customerVisible,
      selfApprovalAllowed: false,
    });
    if (!allowed) {
      setError('Authorization denied: segregation of duties or scope prevents this decision.');
      return;
    }
    setBusy(true);
    const result = await decideApproval({
      requestId: selected.requestId,
      approvalId: selected.id,
      decision,
      comments,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify(`Request ${decision}. The requester and next approver were notified.`);
    setSelected(null);
    await workspace.refresh();
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'My approvals']}
        eyebrow="DECISION QUEUE"
        title="My approvals"
        description="Only requests routed to you or covered by your approval authority appear here. Every decision is permission-checked and audit logged."
      />

      {!canApprove ? (
        <Card>
          <EmptyState icon="ShieldCheck" title="Approval authority not assigned" description="Your roles do not include request approval. Ask your plant head to configure an approval authority if this is part of your role." />
        </Card>
      ) : (
        <>
          <section className="pt-stat-grid pt-stat-grid-4">
            <StatCard label="Awaiting decision" value={approvals.length} icon="BadgeCheck" tone="lime" footnote={`${leaveCount} leave requests`} />
            <StatCard label="Financial exposure" value={currency(amount)} icon="TrendingUp" footnote="Across visible requests" />
            <StatCard label="Oldest request" value={approvals.length ? relativeTime(approvals[0].request.submittedAt) : '—'} icon="Clock3" tone={approvals.length && new Date(approvals[0].request.submittedAt) < new Date(Date.now() - 3 * 86400000) ? 'warn' : 'default'} footnote="Decision ageing" />
            <StatCard label="Decided by me" value={decidedHistory.length} icon="CheckCircle2" footnote="Recent history" />
          </section>

          <div className="pt-approvals-layout">
            <div className="pt-approval-queue">
              {approvals.length ? approvals.map((step) => (
                <article key={step.id} className="pt-approval-card">
                  <div className="pt-approval-card-head">
                    <div className="pt-approval-requester">
                      <Avatar name={step.requester?.fullName} size="md" />
                      <div>
                        <strong>{step.requester?.fullName}</strong>
                        <small>{step.requester?.designation} · {step.requester?.department}</small>
                      </div>
                    </div>
                    <div className="pt-approval-tags">
                      <Badge tone="blue">{step.request.requestType.replaceAll('_', ' ')}</Badge>
                      <Badge tone="amber">Step {step.step}</Badge>
                      {step.request.customerVisible && <Badge tone="violet">Customer visible</Badge>}
                    </div>
                  </div>
                  <h3>{step.request.title}</h3>
                  <p>{step.request.details}</p>
                  <div className="pt-approval-facts">
                    <span><small>Amount</small><strong>{step.request.amount ? currency(step.request.amount) : 'No cost'}</strong></span>
                    <span><small>Submitted</small><strong>{formatDate(step.request.submittedAt)}</strong><em>{relativeTime(step.request.submittedAt)}</em></span>
                    <span><small>Scope</small><strong>{step.request.plantId?.replace('plant-', '')} · {step.request.departmentId?.replace('dept-', '')}</strong></span>
                    <span><small>Requester ID</small><strong className="pt-mono">{step.requester?.employeeCode}</strong></span>
                  </div>
                  <div className="pt-approval-actions">
                    <Button variant="secondary" icon="FileText" onClick={() => navigate('/requests')}>Open request</Button>
                    <div>
                      <Button variant="ghost" onClick={() => openDecision(step, 'rejected')}>Reject</Button>
                      <Button icon="Check" onClick={() => openDecision(step, 'approved')}>Approve</Button>
                    </div>
                  </div>
                </article>
              )) : (
                <Card><EmptyState icon="BadgeCheck" title="Queue clear" description="Requests routed to you will appear here. Check back after the next submission." /></Card>
              )}
            </div>

            <aside className="pt-approval-aside">
              <Card title="Decision history" subtitle="Your recent approvals">
                {decidedHistory.length ? (
                  <div className="pt-decision-history">
                    {decidedHistory.map((step) => (
                      <div key={step.id} className="pt-decision-row">
                        <span className={`pt-decision-icon ${step.status}`}><Icon name={step.status === 'approved' ? 'Check' : 'X'} size={13} /></span>
                        <div><strong>{step.request?.title || 'Request'}</strong><small>{step.decidedAt ? formatDateTime(step.decidedAt) : ''}</small></div>
                        <StatusBadge status={step.status} />
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon="History" title="No decisions yet" />}
              </Card>
              <Card title="Segregation of duties" subtitle="Built into the policy">
                <ul className="pt-policy-list">
                  <li><Icon name="Check" size={13} /> You cannot approve your own request.</li>
                  <li><Icon name="Check" size={13} /> Department and plant scope are checked.</li>
                  <li><Icon name="Check" size={13} /> Escalation follows approval authority thresholds.</li>
                  <li><Icon name="Check" size={13} /> Rejections require a comment in production.</li>
                </ul>
              </Card>
            </aside>
          </div>
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={decision === 'approved' ? 'Approve request' : 'Reject request'}
        description={selected ? `${selected.request.title} · ${selected.requester?.fullName}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant={decision === 'approved' ? 'primary' : 'danger'} icon={decision === 'approved' ? 'Check' : 'X'} onClick={submitDecision} disabled={busy}>
              {busy ? 'Recording decision…' : decision === 'approved' ? 'Confirm approval' : 'Confirm rejection'}
            </Button>
          </>
        }
      >
        {selected && (
          <div className="pt-decision-form">
            {error && <div className="pt-form-error"><Icon name="AlertTriangle" size={15} /> {error}</div>}
            <div className="pt-decision-summary">
              <span><small>Request</small><strong>{selected.request.title}</strong></span>
              <span><small>Amount</small><strong>{selected.request.amount ? currency(selected.request.amount) : 'No cost'}</strong></span>
              <span><small>Approver step</small><strong>Step {selected.step}</strong></span>
              <span><small>Scope</small><strong>{selected.request.plantId?.replace('plant-', '')} · {selected.request.departmentId?.replace('dept-', '')}</strong></span>
            </div>
            <Field label="Decision comment" hint={decision === 'rejected' ? 'Explain what needs to change before resubmission.' : 'Optional context for the audit trail.'}>
              <Textarea rows={4} value={comments} onChange={(event) => setComments(event.target.value)} placeholder={decision === 'approved' ? 'Approved — verified against the November plan.' : 'Please attach the supporting quotation.'} />
            </Field>
            <p className="pt-muted pt-small"><Icon name="ShieldCheck" size={13} /> The decision is re-authorised by PostgreSQL using your employee identity, roles and scope.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
