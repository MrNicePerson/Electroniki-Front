export const money = (amount) =>
  `Rs. ${Math.round(Number(amount) || 0).toLocaleString('en-PK')}`;

export const lineTotal = (item = {}) =>
  Number(item.qty || 0) * Number(item.rate ?? item.price ?? 0);

export const subtotal = (items = []) =>
  items.reduce((sum, item) => sum + lineTotal(item), 0);

export function createInstallmentSchedule(balance, installmentCount, suggestedAmount = 0) {
  const total = Math.max(0, Math.round(Number(balance) || 0));
  const count = Math.max(1, Math.floor(Number(installmentCount) || 1));
  const savedAmount = Math.max(0, Math.round(Number(suggestedAmount) || 0));
  const regularAmount = savedAmount > 0 && savedAmount * (count - 1) <= total
    ? savedAmount
    : Math.floor(total / count);
  return {
    count,
    regularAmount,
    finalAmount: total - regularAmount * (count - 1),
  };
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

/** Shape a persisted app sale and shop settings for the A5 invoice components. */
export function toInvoiceModel(sale = {}, shop = {}) {
  const items = Array.isArray(sale.items)
    ? sale.items.map((item) => ({
        name: item.name || item.productName || '',
        qty: Number(item.qty) || 0,
        rate: Number(item.price ?? item.rate) || 0,
      }))
    : [];
  const gross = Number(sale.gross) || subtotal(items);
  const total = Number(sale.total) || Math.max(0, gross - (Number(sale.billDiscount) || 0) + (Number(sale.add) || 0));
  const rawPaid = Number(sale.paid ?? sale.initialPaid);
  const paid = Math.min(total, Math.max(0, Number.isFinite(rawPaid) ? rawPaid : 0));
  const paymentDetails = sale.paymentDetails || {};
  const methodValue = String(paymentDetails.method || sale.paymentMethod || 'cash').toLowerCase();
  const cashAmount = Number(paymentDetails.cash) || Number(sale.cashCollected) || 0;
  const bankAmount = Number(paymentDetails.bank) || Number(sale.bankCollected) || 0;
  const paymentMethod = cashAmount > 0 && bankAmount > 0 ? 'Cash + Bank' : methodValue.includes('bank') || bankAmount > 0 ? 'Bank' : 'Cash';
  const installmentPlan = sale.installmentDetails?.plan || {};

  return {
    invoiceNo: sale.invoiceNo || sale.id || '',
    type: sale.type || 'cash',
    padNo: String(sale.padNo || '').trim(),
    date: formatDate(sale.createdAt || sale.date),
    customerName: sale.customer || sale.customerName || '',
    customerAddress: sale.address || '',
    customerPhone: sale.whatsapp || sale.phone || '',
    customerCnic: sale.cnic || '',
    guarantorName: sale.guarantor || '',
    items,
    subtotal: gross,
    discount: Number(sale.billDiscount) || 0,
    markup: Number(sale.add) || 0,
    total,
    paid,
    balance: Math.max(0, sale.balance !== undefined && sale.balance !== null && Number.isFinite(Number(sale.balance)) ? Number(sale.balance) : total - paid),
    guarantorName: sale.guarantor || '',
    guarantorCnic: sale.guarantorCnic || sale.installmentDetails?.guarantor?.cnic || '',
    months: Math.max(0, Math.floor(Number(sale.months) || 0)),
    monthly: Number(sale.monthly) || 0,
    paymentMethod,
    bankName: paymentDetails.bankName || '',
    startDate: formatDate(installmentPlan.startDate || sale.planStart),
    nextDueDate: formatDate(installmentPlan.nextDueDate || sale.nextDueDate),
    terms: [],
    footerNote: shop.receiptFooter || '',
    shop: {
      name: shop.name || '',
      phone1: shop.phone || shop.whatsapp || '',
      phone2: shop.phone && shop.whatsapp && shop.phone !== shop.whatsapp ? shop.whatsapp : '',
      address: [shop.address, shop.city].filter(Boolean).join(', '),
      invoiceDesign: shop.invoiceDesign || {},
    },
  };
}
