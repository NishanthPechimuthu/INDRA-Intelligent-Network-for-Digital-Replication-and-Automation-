import React, { useMemo, useState } from 'react';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import {
  productionOrderRows,
  productionTaskRows,
  productFor,
  reportsForOrder,
  summariseReports,
} from '../data/productionSelectors.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, StatCard, Tabs, formatDate, formatDateTime } from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { OrderStatus, PriorityPill, QuantityBreakdown, TaskStatus } from '../components/Production.jsx';

/** Production order board: plan versus actual, defects and the tasks behind it. */
export default function ProductionOrderBoardPage() {
  const workspace = useWorkspace();
  const data = workspace.data;
  const [filter, setFilter] = useState('open');
  const [expanded, setExpanded] = useState(null);

  const orders = useMemo(() => productionOrderRows(data), [data]);
  const tasks = useMemo(() => productionTaskRows(data), [data]);
  const visible = orders.filter((order) => {
    if (filter === 'open') return !['completed', 'cancelled'].includes(order.status);
    if (filter === 'completed') return order.status === 'completed';
    return true;
  });
  const openOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status));
  const totals = openOrders.reduce(
    (sum, order) => ({
      planned: sum.planned + Number(order.quantityPlanned || 0),
      completed: sum.completed + Number(order.quantityCompleted || 0),
      rejected: sum.rejected + Number(order.quantityRejected || 0),
    }),
    { planned: 0, completed: 0, rejected: 0 },
  );

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Production', 'Orders']}
        eyebrow="PRODUCTION CONTROL"
        title="Production orders"
        description="Committed quantities, live output and the tasks carrying each order. Rejects are reported separately from good pieces."
        actions={
          <div className="pt-header-actions">
            <Button variant="secondary" icon="ListChecks" onClick={() => navigate('/production/tasks')}>Task board</Button>
            <Button icon="FileText" onClick={() => navigate('/production/reports')}>Record production</Button>
          </div>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Open orders" value={openOrders.length} icon="Factory" footnote={`${orders.length} total`} />
        <StatCard
          label="Order fulfilment"
          value={`${totals.planned ? Math.round((totals.completed / totals.planned) * 100) : 0}%`}
          icon="Gauge"
          tone="lime"
          footnote={`${totals.completed.toLocaleString()} of ${totals.planned.toLocaleString()} pcs`}
        />
        <StatCard label="Rejected pieces" value={totals.rejected.toLocaleString()} icon="AlertTriangle" tone={totals.rejected ? 'warn' : 'default'} footnote="Open orders" />
        <StatCard
          label="Rejection rate"
          value={`${totals.completed + totals.rejected ? ((totals.rejected / (totals.completed + totals.rejected)) * 100).toFixed(1) : '0.0'}%`}
          icon="TrendingUp"
          footnote="Rejects against total produced"
        />
      </section>

      <Card
        title="Order book"
        subtitle="Select an order to see its tasks and production entries"
        action={<Tabs active={filter} onChange={setFilter} tabs={[{ id: 'open', label: 'Open' }, { id: 'completed', label: 'Completed' }, { id: 'all', label: 'All' }]} />}
      >
        {visible.length ? (
          <div className="pt-order-list">
            {visible.map((order) => {
              const product = productFor(data, order);
              const orderTasks = tasks.filter((task) => task.productionOrderId === order.id);
              const reports = reportsForOrder(data, order.id);
              const summary = summariseReports(reports);
              const isOpen = expanded === order.id;
              return (
                <article key={order.id} className={`pt-order-card ${isOpen ? 'pt-order-open' : ''}`}>
                  <button type="button" className="pt-order-head" onClick={() => setExpanded(isOpen ? null : order.id)}>
                    <div className="pt-order-title">
                      <span className="pt-mono">{order.orderNo}</span>
                      <strong>{product?.name || 'Product'}</strong>
                      <small>{order.batchNo ? `Batch ${order.batchNo}` : 'No batch'} · {order.plannedEndAt ? `due ${formatDate(order.plannedEndAt)}` : 'no due date'}</small>
                    </div>
                    <div className="pt-order-tags">
                      <PriorityPill priority={order.priority} />
                      <OrderStatus status={order.status} />
                      <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={16} />
                    </div>
                  </button>
                  <div className="pt-order-body">
                    <QuantityBreakdown target={order.quantityPlanned} completed={order.quantityCompleted} rejected={order.quantityRejected} />
                    <div className="pt-order-facts">
                      <span><small>Tasks</small><strong>{orderTasks.length}</strong></span>
                      <span><small>Reports</small><strong>{summary.entries}</strong></span>
                      <span><small>Downtime</small><strong>{summary.downtime} min</strong></span>
                      <span><small>Line</small><strong>{data.productionLines?.find((line) => line.id === order.productionLineId)?.name || '—'}</strong></span>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="pt-order-detail">
                      <h4><Icon name="ListChecks" size={14} /> Tasks on this order</h4>
                      {orderTasks.length ? (
                        <div className="pt-mini-table">
                          {orderTasks.map((task) => {
                            const assignee = data.employees.find((employee) => employee.id === task.assigneeEmployeeId);
                            return (
                              <div key={task.id} className="pt-mini-row">
                                <div>
                                  <strong>{task.title}</strong>
                                  <small>{assignee?.fullName || 'Unassigned'} · {Number(task.completedQuantity || 0)} / {Number(task.targetQuantity || 0)} pcs · {Number(task.rejectedQuantity || 0)} rejected</small>
                                </div>
                                <div className="pt-mini-row-tags">
                                  <TaskStatus status={task.productionStatus} />
                                  <Badge tone="neutral">{task.priority}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : <p className="pt-muted pt-small">No tasks released against this order yet.</p>}

                      <h4><Icon name="FileText" size={14} /> Production entries</h4>
                      {reports.length ? (
                        <div className="pt-mini-table">
                          {reports.map((report) => {
                            const employee = data.employees.find((item) => item.id === report.reportedByEmployeeId);
                            return (
                              <div key={report.id} className="pt-mini-row">
                                <div>
                                  <strong>{report.shiftCode || 'Shift'} · {report.workDate}</strong>
                                  <small>{employee?.fullName || '—'} · {formatDateTime(report.startedAt)} → {formatDateTime(report.endedAt)}</small>
                                </div>
                                <div className="pt-mini-row-tags">
                                  <Badge tone="lime">{Number(report.goodPieces)} good</Badge>
                                  <Badge tone={Number(report.rejectedPieces) ? 'red' : 'neutral'}>{Number(report.rejectedPieces)} rejected</Badge>
                                  {Number(report.reworkPieces) ? <Badge tone="amber">{Number(report.reworkPieces)} rework</Badge> : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : <p className="pt-muted pt-small">No production recorded yet.</p>}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="Factory" title="No orders in this view" description="Released production orders appear here with plan versus actual quantities." />
        )}
      </Card>
    </div>
  );
}
