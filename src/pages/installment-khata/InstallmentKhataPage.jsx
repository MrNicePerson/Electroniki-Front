import React, { useState } from 'react';
import { Banknote, Eye, Pencil, Printer, Search } from 'lucide-react';
import { apiRequest, money, num } from '../../api.js';

export default function InstallmentKhataPage({ app }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({ amount: '', method: 'cash', bankName: '', reference: '', note: '' });
  const {
    data,
    khataSearch,
    setKhataSearch,
    setShowAddInstallmentModal,
    dateText,
    refreshWorkspace,
    showAlert,
    notify,
    updateInstallmentReminder,
    savingReminderSetting,
  } = app;
  const query = khataSearch.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, '');
  const plans = [...(data.installmentPlans || [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const filteredPlans = plans.filter((plan) => {
    const sale = (data.sales || []).find((item) => item.invoiceNo === plan.invoiceNo || item.id === plan.saleId);
    const values = [plan.customerName, plan.phone, plan.whatsapp, plan.cnic, plan.planNo, plan.invoiceNo,
      plan.padNo, plan.productSummary, sale?.padNo];
    return !query || values.some((value) => {
      const text = String(value || '').toLowerCase();
      return text.includes(query) || (queryDigits.length >= 3 && text.replace(/\D/g, '').includes(queryDigits));
    });
  });

  function linkedSale(plan) {
    return (data.sales || []).find((sale) => sale.invoiceNo === plan.invoiceNo || sale.id === plan.saleId) || {};
  }

  function printModal(kind) {
    const className = kind === 'receipt' ? 'khata-print-receipt' : 'khata-print-details';
    const cleanup = () => document.body.classList.remove('khata-printing', className);
    document.body.classList.add('khata-printing', className);
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  }

  function beginEdit(plan) {
    const details = plan.installmentDetails || {};
    const customer = details.customer || {};
    const guarantor = details.guarantor || {};
    const schedule = details.plan || {};
    setEditingPlan({
      id: plan.id,
      planNo: plan.planNo || plan.invoiceNo,
      padNo: plan.padNo || linkedSale(plan).padNo || '',
      customerName: customer.name || plan.customerName || '',
      phone: customer.phone || plan.phone || '',
      whatsapp: customer.whatsapp || plan.whatsapp || '',
      cnic: customer.cnic || plan.cnic || '',
      address: customer.address || plan.address || '',
      guarantor: guarantor.name || plan.guarantor || '',
      guarantorPhone: guarantor.phone || plan.guarantorPhone || '',
      guarantorCnic: guarantor.cnic || plan.guarantorCnic || '',
      guarantorAddress: guarantor.address || plan.guarantorAddress || '',
      months: schedule.months || plan.months || 12,
      monthlyAmount: schedule.monthlyAmount ?? plan.monthlyAmount ?? 0,
      startDate: schedule.startDate || plan.startDate || '',
      nextDueDate: schedule.nextDueDate || plan.nextDueDate || '',
      productSummary: plan.productSummary || '',
    });
  }

  async function savePlanEdit(event) {
    event.preventDefault();
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      await apiRequest(`/installments/${encodeURIComponent(editingPlan.id)}`, {
        method: 'PUT',
        body: Object.fromEntries(Object.entries(editingPlan).filter(([key]) => key !== 'id')),
      });
      await refreshWorkspace();
      setEditingPlan(null);
      notify('Installment plan updated.');
    } catch (error) {
      showAlert('Could not update installment plan', error.message, 'warning');
    } finally {
      setSavingPlan(false);
    }
  }

  function openPayment(plan) {
    setPaymentDraft({ amount: String(Math.min(num(plan.balance), num(plan.monthlyAmount) || num(plan.balance))), method: 'cash', bankName: '', reference: '', note: '' });
    setPaymentPlan(plan);
  }

  async function savePayment(event) {
    event.preventDefault();
    if (!paymentPlan || savingPayment) return;
    if (paymentDraft.method === 'bank' && !data.bankAccounts.some((bank) => bank.active !== false && bank.bankName === paymentDraft.bankName)) {
      showAlert('Choose a bank account', 'Select an active bank account for this payment.', 'warning');
      return;
    }
    setSavingPayment(true);
    try {
      const result = await apiRequest(`/installments/${encodeURIComponent(paymentPlan.id)}/pay`, {
        method: 'POST',
        body: {
          idempotencyKey: `khpay-${paymentPlan.id}-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
          amount: num(paymentDraft.amount),
          method: paymentDraft.method,
          bankName: paymentDraft.method === 'bank' ? paymentDraft.bankName : '',
          reference: paymentDraft.reference,
          note: paymentDraft.note,
        },
      });
      const sale = linkedSale(paymentPlan);
      setPaymentPlan(null);
      setReceipt({
        ...result.payment,
        customerName: paymentPlan.customerName,
        planNo: paymentPlan.planNo,
        invoiceNo: paymentPlan.invoiceNo,
        padNo: paymentPlan.padNo || sale.padNo || '',
        remainingBalance: result.plan.balance,
        shopName: data.shop?.name || 'Shop',
      });
      await refreshWorkspace();
      notify(`Recorded ${money(result.payment.amount)} payment (${result.payment.receiptNo}).`);
    } catch (error) {
      showAlert('Payment could not be recorded', error.message, 'warning');
    } finally {
      setSavingPayment(false);
    }
  }

  function deletePlan(plan) {
    showAlert(
      'Delete installment plan?',
      `${plan.planNo || plan.invoiceNo} can be deleted only if no payment, advance, or product sale is linked to it.`,
      'danger',
      'Delete plan',
      async () => {
        try {
          await apiRequest(`/installments/${encodeURIComponent(plan.id)}`, { method: 'DELETE' });
          await refreshWorkspace();
          notify('Installment plan deleted.');
        } catch (error) {
          showAlert('Could not delete installment plan', error.message, 'warning');
        }
      },
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Installment Khata</h1></div>
      </div>

      <div className="grid khata-kpis">
        <section className="card khata-kpi">
          <div className="khata-kpi-label">Active installment plans</div>
          <div className="khata-kpi-value">
            {data.installmentPlans.filter((item) => num(item.balance) > 0).length}
          </div>
          <div className="khata-kpi-foot">Customers currently paying in installments</div>
        </section>
        <section className="card khata-kpi">
          <div className="khata-kpi-label">Total outstanding</div>
          <div className="khata-kpi-value">
            {money(data.installmentPlans.reduce((sum, item) => sum + num(item.balance), 0))}
          </div>
          <div className="khata-kpi-foot">Remaining balance across active plans</div>
        </section>
        <section className="card khata-kpi">
          <div className="khata-kpi-label">Payments collected</div>
          <div className="khata-kpi-value">
            {money(data.installmentPlans.reduce((sum, item) => sum + num(item.paid), 0))}
          </div>
          <div className="khata-kpi-foot">Total advance and installment payments</div>
        </section>
      </div>

      <section className="card">
        <div className="khata-toolbar">
          <div>
            <h2 style={{ margin: 0, color: '#12303f', fontSize: 16 }}>Installment bills</h2>
            <div className="muted tiny" style={{ marginTop: 4 }}>
              {filteredPlans.length} bill{filteredPlans.length === 1 ? '' : 's'} · Updated {dateText}
            </div>
          </div>
          <label className="khata-search">
            <span><Search size={14} /></span>
            <input
              placeholder="Search bill, pad, customer or phone"
              value={khataSearch}
              onChange={(event) => setKhataSearch(event.target.value)}
            />
          </label>
          <button type="button" className="btn" onClick={() => setShowAddInstallmentModal(true)}>
            + Add installment customer
          </button>
        </div>

        {filteredPlans.length === 0 ? (
          <div className="empty">No installment bills match your search.</div>
        ) : (
          <div className="table-wrap khata-table-wrap">
            <table className="data-table khata-table">
              <thead><tr><th>Bill Number</th><th>Pad No.</th><th>Customer</th><th>Details</th><th>Amount</th><th>Received</th><th>Balance</th><th>Next Due</th><th>Actions</th></tr></thead>
              <tbody>{filteredPlans.map((item) => {
                const sale = linkedSale(item);
                return <tr key={item.id}>
                  <td><strong>{item.invoiceNo || item.planNo || '-'}</strong></td>
                  <td>{item.padNo || sale.padNo || '—'}</td>
                  <td><strong>{item.customerName || 'Walk-in customer'}</strong><small className="khata-cell-sub">{item.phone || item.whatsapp || 'No phone'}</small></td>
                  <td>{item.productSummary || `${item.months || 0} month installment plan`}</td>
                  <td>{money(item.totalAmount)}</td><td>{money(item.paid)}</td><td><strong>{money(item.balance)}</strong></td>
                  <td>{item.nextDueDate || '—'}</td>
                  <td><div className="khata-row-actions">
                    <button type="button" className="btn ghost small" onClick={() => setSelectedPlan(item)}><Eye size={14} /> Details</button>
                    {num(item.balance) > 0 && <button type="button" className="btn small" onClick={() => openPayment(item)}><Banknote size={14} /> Receive</button>}
                    <button type="button" className="btn ghost small" onClick={() => beginEdit(item)}><Pencil size={14} /> Edit</button>
                    <button type="button" className="btn danger small" onClick={() => deletePlan(item)}>Delete</button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPlan && (() => {
        const plan = plans.find((entry) => entry.id === selectedPlan.id) || selectedPlan;
        const sale = linkedSale(plan);
        const customer = plan.installmentDetails?.customer || {};
        const guarantor = plan.installmentDetails?.guarantor || {};
        const payments = (data.installmentPayments || []).filter((payment) => payment.planId === plan.id).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        return <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSelectedPlan(null)}>
          <section className="modal khata-print-modal khata-details-modal khata-print-target" role="dialog" aria-modal="true">
            <div className="modal-head"><div><h2>Installment bill details</h2><p>{plan.invoiceNo || plan.planNo}</p></div><button type="button" className="btn ghost small modal-actions" onClick={() => setSelectedPlan(null)}>Close</button></div>
            <div className="modal-body">
              <div className="khata-document-title"><div><strong>{data.shop?.name || 'Shop'}</strong><small>Customer installment account</small></div><button type="button" className="btn ghost small modal-actions" onClick={() => printModal('details')}><Printer size={14} /> Print details</button></div>
              <div className="khata-detail-grid">
                <div><small>Bill Number</small><strong>{plan.invoiceNo || plan.planNo || '—'}</strong></div><div><small>Pad No.</small><strong>{plan.padNo || sale.padNo || '—'}</strong></div>
                <div><small>Customer Name</small><strong>{customer.name || plan.customerName || '—'}</strong></div><div><small>Phone / WhatsApp</small><strong>{customer.phone || plan.phone || customer.whatsapp || plan.whatsapp || '—'}</strong></div>
                <div><small>CNIC</small><strong>{customer.cnic || plan.cnic || '—'}</strong></div><div><small>Address</small><strong>{customer.address || plan.address || '—'}</strong></div>
                <div><small>Product / Items</small><strong>{plan.productSummary || '—'}</strong></div><div><small>Guarantor</small><strong>{guarantor.name || plan.guarantor || '—'}{(guarantor.phone || plan.guarantorPhone) ? ` · ${guarantor.phone || plan.guarantorPhone}` : ''}</strong></div>
                <div><small>Total Amount</small><strong>{money(plan.totalAmount)}</strong></div><div><small>Received</small><strong>{money(plan.paid)}</strong></div><div><small>Remaining Balance</small><strong>{money(plan.balance)}</strong></div>
                <div><small>Installment</small><strong>{money(plan.monthlyAmount)} × {plan.months || 0} months</strong></div><div><small>Start / Next Due</small><strong>{plan.startDate || '—'} / {plan.nextDueDate || '—'}</strong></div>
              </div>
              <div className="khata-reminder-toggle modal-actions"><label><input type="checkbox" checked={Boolean(plan.whatsappReminderEnabled)} disabled={savingReminderSetting || !(plan.whatsapp || plan.phone)} onChange={(event) => updateInstallmentReminder(plan, event.target.checked)} /> Daily WhatsApp installment reminders</label></div>
              <h3 className="khata-payment-heading">Payment history</h3>
              {payments.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Amount</th><th>Action</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.receiptNo || '—'}</td><td>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' }) : '—'}</td><td>{payment.method === 'bank' ? payment.bankName || 'Bank' : 'Cash'}</td><td>{money(payment.amount)}</td><td><button type="button" className="btn ghost small modal-actions" onClick={() => setReceipt({ ...payment, customerName: plan.customerName, invoiceNo: plan.invoiceNo, planNo: plan.planNo, padNo: plan.padNo || sale.padNo || '', shopName: data.shop?.name || 'Shop' })}>Print receipt</button></td></tr>)}</tbody></table></div> : <div className="empty">No payments have been recorded for this bill.</div>}
              <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => { setSelectedPlan(null); beginEdit(plan); }}><Pencil size={14} /> Edit bill</button>{num(plan.balance) > 0 && <button type="button" className="btn" onClick={() => { setSelectedPlan(null); openPayment(plan); }}><Banknote size={14} /> Receive payment</button>}</div>
            </div>
          </section>
        </div>;
      })()}

      {paymentPlan && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setPaymentPlan(null)}>
        <form className="modal" role="dialog" aria-modal="true" onSubmit={savePayment}>
          <div className="modal-head"><div><h2>Receive installment payment</h2><p>{paymentPlan.invoiceNo || paymentPlan.planNo} · Balance {money(paymentPlan.balance)}</p></div><button type="button" className="btn ghost small" onClick={() => setPaymentPlan(null)}>Close</button></div>
          <div className="modal-body"><label className="field"><span>Amount received (Rs.)</span><input required type="number" min="1" max={num(paymentPlan.balance)} step="1" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} /></label>
            <label className="field"><span>Payment method</span><select value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value, bankName: '' }))}><option value="cash">Cash</option><option value="bank">Bank</option></select></label>
            {paymentDraft.method === 'bank' && <label className="field"><span>Bank account</span><select required value={paymentDraft.bankName} onChange={(event) => setPaymentDraft((current) => ({ ...current, bankName: event.target.value }))}><option value="">Select account</option>{data.bankAccounts.filter((bank) => bank.active !== false).map((bank) => <option key={bank.id} value={bank.bankName}>{bank.bankName}</option>)}</select></label>}
            <label className="field"><span>Reference (optional)</span><input value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} /></label><label className="field"><span>Note (optional)</span><textarea value={paymentDraft.note} onChange={(event) => setPaymentDraft((current) => ({ ...current, note: event.target.value }))} /></label>
          </div><div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setPaymentPlan(null)}>Cancel</button><button type="submit" className="btn" disabled={savingPayment}>{savingPayment ? 'Saving…' : 'Receive payment'}</button></div>
        </form>
      </div>}

      {receipt && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setReceipt(null)}>
        <section className="modal khata-print-modal khata-receipt-modal khata-print-target" role="dialog" aria-modal="true">
          <div className="modal-head"><div><h2>Payment receipt</h2><p>{receipt.receiptNo || 'Installment payment'}</p></div><button type="button" className="btn ghost small modal-actions" onClick={() => setReceipt(null)}>Close</button></div>
          <div className="modal-body"><div className="khata-document-title"><div><strong>{receipt.shopName || 'Shop'}</strong><small>Payment received</small></div><button type="button" className="btn ghost small modal-actions" onClick={() => printModal('receipt')}><Printer size={14} /> Print receipt</button></div>
            <div className="khata-detail-grid"><div><small>Receipt No.</small><strong>{receipt.receiptNo || '—'}</strong></div><div><small>Date</small><strong>{receipt.createdAt ? new Date(receipt.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</strong></div><div><small>Bill Number</small><strong>{receipt.invoiceNo || receipt.planNo || '—'}</strong></div><div><small>Pad No.</small><strong>{receipt.padNo || '—'}</strong></div><div><small>Received From</small><strong>{receipt.customerName || '—'}</strong></div><div><small>Payment Method</small><strong>{receipt.method === 'bank' ? receipt.bankName || 'Bank' : 'Cash'}</strong></div><div><small>Amount Received</small><strong>{money(receipt.amount)}</strong></div>{receipt.remainingBalance !== undefined && <div><small>Remaining Balance</small><strong>{money(receipt.remainingBalance)}</strong></div>}{receipt.reference && <div><small>Reference</small><strong>{receipt.reference}</strong></div>}{receipt.note && <div><small>Note</small><strong>{receipt.note}</strong></div>}</div>
            <div className="khata-signature">Received by: __________________________</div><div className="modal-actions"><button type="button" className="btn" onClick={() => printModal('receipt')}><Printer size={14} /> Print receipt</button><button type="button" className="btn ghost" onClick={() => setReceipt(null)}>Done</button></div>
          </div>
        </section>
      </div>}
      {editingPlan && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setEditingPlan(null)}>
        <form className="modal" role="dialog" aria-modal="true" onSubmit={savePlanEdit}>
          <div className="modal-head"><div><h2>Edit installment plan</h2><p>{editingPlan.planNo}</p></div><button type="button" className="btn ghost small" onClick={() => setEditingPlan(null)}>Close</button></div>
          <div className="modal-body">
            <div className="modal-section">CUSTOMER DETAILS</div>
            <div className="form-grid">
              {[
                ['Pad No.', 'padNo'], ['Product / items', 'productSummary'], ['Customer name', 'customerName'], ['Phone', 'phone'], ['WhatsApp', 'whatsapp'], ['CNIC', 'cnic'], ['Address', 'address'],
                ['Guarantor name', 'guarantor'], ['Guarantor phone', 'guarantorPhone'], ['Guarantor CNIC', 'guarantorCnic'], ['Guarantor address', 'guarantorAddress'],
              ].map(([label, field]) => <label className="field" key={field}><span>{label}</span><input value={editingPlan[field]} onChange={(event) => setEditingPlan((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
            </div>
            <div className="modal-section" style={{ marginTop: 18 }}>PAYMENT SCHEDULE</div>
            <div className="form-grid">
              <label className="field"><span>Months</span><input type="number" min="1" max="60" required value={editingPlan.months} onChange={(event) => setEditingPlan((current) => ({ ...current, months: event.target.value }))} /></label>
              <label className="field"><span>Monthly amount</span><input type="number" min="0" step="1" required value={editingPlan.monthlyAmount} onChange={(event) => setEditingPlan((current) => ({ ...current, monthlyAmount: event.target.value }))} /></label>
              <label className="field"><span>Start date</span><input type="date" value={editingPlan.startDate} onChange={(event) => setEditingPlan((current) => ({ ...current, startDate: event.target.value }))} /></label>
              <label className="field"><span>Next due date</span><input type="date" value={editingPlan.nextDueDate} onChange={(event) => setEditingPlan((current) => ({ ...current, nextDueDate: event.target.value }))} /></label>
            </div>
          </div>
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setEditingPlan(null)}>Cancel</button><button type="submit" className="btn" disabled={savingPlan}>{savingPlan ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>}
    </>
  );
}

.khata-table-wrap { overflow-x: auto; }
.khata-table { min-width: 1050px; }
.khata-table td { vertical-align: middle; }
.khata-cell-sub { display: block; margin-top: 3px; color: #718391; font-size: 11px; }
.khata-row-actions { display: flex; flex-wrap: wrap; gap: 5px; min-width: 260px; }
.khata-row-actions .btn { display: inline-flex; align-items: center; gap: 4px; }
.khata-document-title { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0 16px; border-bottom: 1px solid #dbe5ea; }
.khata-document-title > div { display: grid; gap: 4px; }
.khata-document-title strong { color: #12303f; font-size: 20px; }
.khata-document-title small { color: #657987; }
.khata-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; margin-top: 15px; }
.khata-detail-grid > div { display: grid; gap: 5px; padding: 10px 0; border-bottom: 1px solid #edf1f3; overflow-wrap: anywhere; }
.khata-detail-grid small { color: #718391; font-size: 11px; }
.khata-detail-grid strong { color: #16394c; font-size: 13px; }
.khata-payment-heading { margin: 20px 0 10px; color: #12303f; font-size: 15px; }
.khata-reminder-toggle { padding: 12px 0; color: #35586c; }
.khata-reminder-toggle label { display: flex; align-items: center; gap: 8px; }
.khata-signature { margin-top: 32px; padding-top: 12px; border-top: 1px solid #dbe5ea; text-align: right; color: #486273; }
.khata-print-target { display: none; }
@media (max-width: 700px) { .khata-detail-grid { grid-template-columns: 1fr; } .khata-row-actions { min-width: 220px; } }
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body.khata-printing * { visibility: hidden !important; }
  body.khata-printing.khata-print-details .khata-details-modal,
  body.khata-printing.khata-print-details .khata-details-modal *,
  body.khata-printing.khata-print-receipt .khata-receipt-modal,
  body.khata-printing.khata-print-receipt .khata-receipt-modal * { visibility: visible !important; }
  body.khata-printing .khata-print-modal { display: block !important; position: fixed !important; inset: 0 !important; width: 100% !important; max-width: none !important; max-height: none !important; margin: 0 !important; overflow: visible !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
  body.khata-printing .khata-print-modal .modal-body { overflow: visible !important; max-height: none !important; padding: 0 !important; }
  body.khata-printing .khata-print-modal .modal-head,
  body.khata-printing .khata-print-modal .modal-actions { display: none !important; }
  body.khata-printing .khata-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
