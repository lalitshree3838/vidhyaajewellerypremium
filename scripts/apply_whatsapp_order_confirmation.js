import fs from 'node:fs';
import vm from 'node:vm';

const filePath = 'assets/index-D2RoHgHG.js';
let code = fs.readFileSync(filePath, 'utf8');

// The WhatsAppOrderConfirmationView component code as part of the var declaration chain
const componentCode = `WhatsAppOrderConfirmationView = ({ order: ke, onTrackOrder: r, onContinueShopping: n }) => {
  const [isConfirmed, setIsConfirmed] = (0, x.useState)(Boolean(ke?.whatsappCustomerConfirmed));
  const [hasClickedWhatsApp, setHasClickedWhatsApp] = (0, x.useState)(false);
  const [isSubmitting, setIsSubmitting] = (0, x.useState)(false);
  const [copied, setCopied] = (0, x.useState)(false);
  const [showFullReceipt, setShowFullReceipt] = (0, x.useState)(false);

  const orderId = ke?.orderNumber || ke?.id || 'N/A';
  let orderDateTime = 'Just now';
  try {
    orderDateTime = new Date(ke?.createdAt || Date.now()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {}

  const customerName = ke?.customerName || ke?.shippingAddress?.fullName || ke?.shippingAddress?.name || 'Valued Patron';
  const customerMobile = ke?.customerPhone || ke?.shippingAddress?.phone || 'N/A';
  const customerEmail = ke?.customerEmail || 'Not Provided';

  let address = 'Delivery address provided at checkout';
  if (ke?.shippingAddress) {
    const parts = [
      ke.shippingAddress.street,
      ke.shippingAddress.landmark,
      ke.shippingAddress.city,
      ke.shippingAddress.state ? (ke.shippingAddress.state + ' - ' + (ke.shippingAddress.pincode || '')) : ke.shippingAddress.pincode
    ].filter(Boolean);
    if (parts.length > 0) address = parts.join(', ');
  }

  const items = Array.isArray(ke?.items) ? ke.items : [];
  let itemsFormatted = '';
  if (items.length > 0) {
    itemsFormatted = items.map((item, idx) => {
      const name = item.productName || item.title || 'Handcrafted Jewellery';
      const qty = item.quantity || 1;
      const price = typeof item.price === 'number' ? item.price : Number(item.price) || 0;
      return (idx + 1) + '. ' + name + '\\n   Qty: ' + qty + ' | Price: ₹' + price.toLocaleString('en-IN');
    }).join('\\n');
  } else {
    itemsFormatted = '1. Handcrafted Jewellery (Qty: 1) - ₹' + (Number(ke?.totalAmount || ke?.total) || 0).toLocaleString('en-IN');
  }

  const subtotal = typeof ke?.subtotal === 'number' ? ke.subtotal : Number(ke?.subtotal) || Number(ke?.totalAmount || ke?.total) || 0;
  const discount = typeof ke?.discount === 'number' ? ke.discount : Number(ke?.discount) || 0;
  const deliveryCharge = typeof ke?.deliveryCharge === 'number' ? ke.deliveryCharge : 0;
  const totalAmount = typeof ke?.totalAmount === 'number' ? ke.totalAmount : Number(ke?.totalAmount || ke?.total) || 0;
  const paymentMethod = ke?.paymentMethod || 'Online Payment';
  const transactionId = ke?.paymentId || ke?.upiReference || ke?.cardNetwork || 'Verified via Payment Gateway';
  const paymentStatus = 'SUCCESSFUL';

  const preparedMessage = 'Vidhyaa Jewellery Studio\\nORDER CONFIRMATION REQUEST\\n\\nOrder ID: ' + orderId +
    '\\nOrder Date and Time: ' + orderDateTime +
    '\\n\\nCustomer Details:\\n• Customer Name: ' + customerName +
    '\\n• Customer Mobile Number: ' + customerMobile +
    '\\n• Customer Email: ' + customerEmail +
    '\\n\\nComplete Delivery Address:\\n' + address +
    '\\n\\nProducts Ordered:\\n' + itemsFormatted +
    '\\n\\nFinancial Breakdown:\\n• Subtotal: ₹' + subtotal.toLocaleString('en-IN') +
    '\\n• Discount: ₹' + discount.toLocaleString('en-IN') +
    '\\n• Shipping Charges: ₹' + deliveryCharge.toLocaleString('en-IN') +
    '\\n• Final Paid Amount: ₹' + totalAmount.toLocaleString('en-IN') +
    '\\n\\nPayment Information:\\n• Payment Method: ' + paymentMethod +
    '\\n• Payment Transaction ID: ' + transactionId +
    '\\n• Payment Status: ' + paymentStatus +
    '\\n\\nPlease confirm this order for delivery.';

  const whatsappUrl = 'https://wa.me/917302187770?text=' + encodeURIComponent(preparedMessage);

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setHasClickedWhatsApp(true);
  };

  const handleConfirmSent = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/orders/' + encodeURIComponent(ke.id || ke.orderNumber) + '/customer-whatsapp-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappCustomerConfirmed: true })
      }).catch(() => {});
      setIsConfirmed(true);
    } catch (e) {
      setIsConfirmed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyMessage = () => {
    try {
      navigator.clipboard.writeText(preparedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {}
  };

  return (0, I.jsxDEV)('div', {
    className: 'bg-white rounded-3xl border border-[#E8DCCF] p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-fadeIn max-w-3xl mx-auto',
    children: [
      (0, I.jsxDEV)('div', {
        className: 'flex flex-wrap items-center justify-center gap-2 sm:gap-4 pb-4 border-b border-[#E8DCCF] text-xs font-bold tracking-wide',
        children: [
          (0, I.jsxDEV)('div', {
            className: 'flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-300 shadow-xs',
            children: [
              (0, I.jsxDEV)('span', { className: 'w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-extrabold', children: '✓' }, void 0, false, { fileName: G, lineNumber: 1 }, void 0),
              (0, I.jsxDEV)('span', { children: '1. Payment Successful' }, void 0, false, { fileName: G, lineNumber: 2 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 3 }, void 0),
          (0, I.jsxDEV)('span', { className: 'text-gray-400', children: '→' }, void 0, false, { fileName: G, lineNumber: 4 }, void 0),
          (0, I.jsxDEV)('div', {
            className: 'flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs transition-all ' + (isConfirmed ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-amber-900 bg-amber-50 border-amber-400 ring-2 ring-amber-300'),
            children: [
              (0, I.jsxDEV)('span', {
                className: 'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ' + (isConfirmed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white animate-pulse'),
                children: isConfirmed ? '✓' : '2'
              }, void 0, false, { fileName: G, lineNumber: 5 }, void 0),
              (0, I.jsxDEV)('span', { children: isConfirmed ? '2. WhatsApp Confirmed ✓' : '2. Confirm on WhatsApp' }, void 0, false, { fileName: G, lineNumber: 6 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 7 }, void 0),
          (0, I.jsxDEV)('span', { className: 'text-gray-400', children: '→' }, void 0, false, { fileName: G, lineNumber: 8 }, void 0),
          (0, I.jsxDEV)('div', {
            className: 'flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs ' + (isConfirmed ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-gray-400 bg-gray-50 border-gray-200'),
            children: [
              (0, I.jsxDEV)('span', {
                className: 'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ' + (isConfirmed ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-white'),
                children: isConfirmed ? '✓' : '3'
              }, void 0, false, { fileName: G, lineNumber: 9 }, void 0),
              (0, I.jsxDEV)('span', { children: '3. Atelier Packing' }, void 0, false, { fileName: G, lineNumber: 10 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 11 }, void 0)
        ]
      }, void 0, true, { fileName: G, lineNumber: 12 }, void 0),

      !isConfirmed ? (
        (0, I.jsxDEV)('div', {
          className: 'bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-sm',
          children: [
            (0, I.jsxDEV)('div', {
              className: 'flex flex-wrap items-center gap-2',
              children: [
                (0, I.jsxDEV)('span', { className: 'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs', children: '✓ Payment Successful' }, void 0, false, { fileName: G, lineNumber: 13 }, void 0),
                (0, I.jsxDEV)('span', { className: 'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs animate-pulse', children: '⚠️ WhatsApp Message Not Yet Sent' }, void 0, false, { fileName: G, lineNumber: 14 }, void 0)
              ]
            }, void 0, true, { fileName: G, lineNumber: 15 }, void 0),
            (0, I.jsxDEV)('h2', { className: 'font-serif text-lg sm:text-xl font-bold text-[#3B1E22]', children: 'Mandatory Step: Confirm Your Order on WhatsApp' }, void 0, false, { fileName: G, lineNumber: 16 }, void 0),
            (0, I.jsxDEV)('p', { className: 'text-xs text-gray-700 leading-relaxed', children: 'Your payment of ₹' + totalAmount.toLocaleString('en-IN') + ' has been verified and Order ' + orderId + ' is safely saved in our database. To schedule atelier packing and delivery, please tap the green button below to send the pre-filled order confirmation to our studio owner at 7302187770.' }, void 0, false, { fileName: G, lineNumber: 17 }, void 0)
          ]
        }, void 0, true, { fileName: G, lineNumber: 18 }, void 0)
      ) : (
        (0, I.jsxDEV)('div', {
          className: 'bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-sm',
          children: [
            (0, I.jsxDEV)('div', {
              className: 'flex flex-wrap items-center gap-2',
              children: [
                (0, I.jsxDEV)('span', { className: 'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-700 text-white shadow-xs', children: '✓ Payment Successful' }, void 0, false, { fileName: G, lineNumber: 19 }, void 0),
                (0, I.jsxDEV)('span', { className: 'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-700 text-white shadow-xs', children: '✓ WhatsApp Confirmation Completed' }, void 0, false, { fileName: G, lineNumber: 20 }, void 0)
              ]
            }, void 0, true, { fileName: G, lineNumber: 21 }, void 0),
            (0, I.jsxDEV)('h2', { className: 'font-serif text-lg sm:text-xl font-bold text-emerald-950', children: '✓ Order Fully Confirmed on WhatsApp!' }, void 0, false, { fileName: G, lineNumber: 22 }, void 0),
            (0, I.jsxDEV)('p', { className: 'text-xs text-emerald-800 leading-relaxed', children: 'Thank you for completing WhatsApp confirmation! Studio owner (+91 7302187770) has received your order dispatch notice. Your royal handcrafted pieces are now being prepared at our Roorkee atelier.' }, void 0, false, { fileName: G, lineNumber: 23 }, void 0)
          ]
        }, void 0, true, { fileName: G, lineNumber: 24 }, void 0)
      ),

      !isConfirmed && (0, I.jsxDEV)('div', {
        className: 'space-y-4 py-2',
        children: [
          (0, I.jsxDEV)('button', {
            onClick: handleOpenWhatsApp,
            className: 'w-full max-w-md mx-auto bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white font-black text-sm sm:text-base px-6 py-4 sm:py-4.5 rounded-2xl shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer border-2 border-emerald-400 group',
            children: [
              (0, I.jsxDEV)('svg', {
                className: 'w-6 h-6 fill-current shrink-0',
                viewBox: '0 0 24 24',
                children: (0, I.jsxDEV)('path', { d: 'M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z' })
              }),
              (0, I.jsxDEV)('span', { className: 'tracking-wide', children: 'CONFIRM ORDER ON WHATSAPP' }, void 0, false, { fileName: G, lineNumber: 27 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 28 }, void 0),
          (0, I.jsxDEV)('p', {
            className: 'text-[11px] text-gray-500 max-w-sm mx-auto',
            children: 'Opens official WhatsApp chat with Vidhyaa Studio Owner (+91 7302187770) with your complete order message pre-filled.'
          }, void 0, false, { fileName: G, lineNumber: 29 }, void 0)
        ]
      }, void 0, true, { fileName: G, lineNumber: 30 }, void 0),

      !isConfirmed && hasClickedWhatsApp && (0, I.jsxDEV)('div', {
        className: 'bg-[#FAF7F2] border-2 border-[#DFB982] rounded-2xl p-5 sm:p-6 text-center space-y-3.5 animate-fadeIn max-w-lg mx-auto shadow-sm',
        children: [
          (0, I.jsxDEV)('div', { className: 'text-2xl', children: '📱' }, void 0, false, { fileName: G, lineNumber: 31 }, void 0),
          (0, I.jsxDEV)('h3', { className: 'font-serif text-base sm:text-lg font-bold text-[#3B1E22]', children: 'Did you press the SEND button in WhatsApp?' }, void 0, false, { fileName: G, lineNumber: 32 }, void 0),
          (0, I.jsxDEV)('p', { className: 'text-xs text-gray-600 leading-relaxed', children: 'Please ensure you switched to WhatsApp and pressed the SEND (➤) button to send the prepared order message to 7302187770. Once sent, click below to finalize confirmation:' }, void 0, false, { fileName: G, lineNumber: 33 }, void 0),
          (0, I.jsxDEV)('div', {
            className: 'flex flex-col sm:flex-row items-center justify-center gap-3 pt-2',
            children: [
              (0, I.jsxDEV)('button', {
                onClick: handleConfirmSent,
                disabled: isSubmitting,
                className: 'w-full sm:w-auto bg-[#3B1E22] hover:bg-[#802336] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2',
                children: [
                  (0, I.jsxDEV)('span', { className: 'text-[#DFB982] font-black', children: '✓' }, void 0, false, { fileName: G, lineNumber: 34 }, void 0),
                  (0, I.jsxDEV)('span', { children: isSubmitting ? 'Saving Confirmation...' : 'I Have Sent the Message on WhatsApp' }, void 0, false, { fileName: G, lineNumber: 35 }, void 0)
                ]
              }, void 0, true, { fileName: G, lineNumber: 36 }, void 0),
              (0, I.jsxDEV)('button', {
                onClick: handleOpenWhatsApp,
                className: 'w-full sm:w-auto bg-white border border-[#3B1E22] text-[#3B1E22] hover:bg-gray-100 font-bold text-xs px-4 py-3 rounded-xl cursor-pointer transition-all',
                children: 'Re-open WhatsApp'
              }, void 0, false, { fileName: G, lineNumber: 37 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 38 }, void 0)
        ]
      }, void 0, true, { fileName: G, lineNumber: 39 }, void 0),

      (0, I.jsxDEV)('div', {
        className: 'max-w-lg mx-auto bg-[#FAF7F2] p-5 sm:p-6 rounded-2xl border border-[#E8DCCF] text-left space-y-3 text-xs shadow-xs',
        children: [
          (0, I.jsxDEV)('div', {
            className: 'flex justify-between items-center pb-2 border-b border-[#E8DCCF]',
            children: [
              (0, I.jsxDEV)('div', {
                children: [
                  (0, I.jsxDEV)('span', { className: 'text-gray-400 block text-[10px] uppercase font-bold', children: 'Order Number' }, void 0, false, { fileName: G, lineNumber: 40 }, void 0),
                  (0, I.jsxDEV)('span', { className: 'font-mono font-bold text-sm text-[#3B1E22]', children: orderId }, void 0, false, { fileName: G, lineNumber: 41 }, void 0)
                ]
              }, void 0, true, { fileName: G, lineNumber: 42 }, void 0),
              (0, I.jsxDEV)('div', {
                className: 'text-right',
                children: [
                  (0, I.jsxDEV)('span', { className: 'text-gray-400 block text-[10px] uppercase font-bold', children: 'Order Date & Time' }, void 0, false, { fileName: G, lineNumber: 43 }, void 0),
                  (0, I.jsxDEV)('span', { className: 'font-mono text-gray-700 text-xs font-semibold', children: orderDateTime }, void 0, false, { fileName: G, lineNumber: 44 }, void 0)
                ]
              }, void 0, true, { fileName: G, lineNumber: 45 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 46 }, void 0),
          (0, I.jsxDEV)('div', {
            className: 'space-y-1.5 py-1',
            children: [
              (0, I.jsxDEV)('div', { className: 'flex justify-between', children: [(0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'Customer Name' }, void 0, false, { fileName: G, lineNumber: 47 }, void 0), (0, I.jsxDEV)('span', { className: 'font-bold text-gray-800', children: customerName }, void 0, false, { fileName: G, lineNumber: 48 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 49 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between', children: [(0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'Mobile Number' }, void 0, false, { fileName: G, lineNumber: 50 }, void 0), (0, I.jsxDEV)('span', { className: 'font-bold text-gray-800', children: customerMobile }, void 0, false, { fileName: G, lineNumber: 51 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 52 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between', children: [(0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'Email Address' }, void 0, false, { fileName: G, lineNumber: 53 }, void 0), (0, I.jsxDEV)('span', { className: 'text-gray-700', children: customerEmail }, void 0, false, { fileName: G, lineNumber: 54 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 55 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between items-start gap-2', children: [(0, I.jsxDEV)('span', { className: 'text-gray-500 shrink-0', children: 'Delivery Address' }, void 0, false, { fileName: G, lineNumber: 56 }, void 0), (0, I.jsxDEV)('span', { className: 'text-gray-800 text-right font-medium max-w-xs', children: address }, void 0, false, { fileName: G, lineNumber: 57 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 58 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between', children: [(0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'Payment Method' }, void 0, false, { fileName: G, lineNumber: 59 }, void 0), (0, I.jsxDEV)('span', { className: 'font-semibold text-gray-800', children: paymentMethod }, void 0, false, { fileName: G, lineNumber: 60 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 61 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between', children: [(0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'Transaction ID / UTR' }, void 0, false, { fileName: G, lineNumber: 62 }, void 0), (0, I.jsxDEV)('span', { className: 'font-mono font-bold text-gray-700', children: transactionId }, void 0, false, { fileName: G, lineNumber: 63 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 64 }, void 0),
              (0, I.jsxDEV)('div', {
                className: 'flex justify-between items-center',
                children: [
                  (0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'Payment Status' }),
                  (0, I.jsxDEV)('span', { className: 'font-extrabold uppercase text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full', children: 'SUCCESSFUL (PAID)' }, void 0, false, { fileName: G, lineNumber: 66 }, void 0)
                ]
              }, void 0, true, { fileName: G, lineNumber: 67 }, void 0),
              (0, I.jsxDEV)('div', {
                className: 'flex justify-between items-center',
                children: [
                  (0, I.jsxDEV)('span', { className: 'text-gray-500', children: 'WhatsApp Status' }),
                  (0, I.jsxDEV)('span', {
                    className: 'font-extrabold uppercase text-[11px] px-2 py-0.5 rounded-full ' + (isConfirmed ? 'text-emerald-800 bg-emerald-100 border border-emerald-300' : 'text-amber-900 bg-amber-100 border border-amber-300'),
                    children: isConfirmed ? '✓ CONFIRMED ON WHATSAPP' : 'CONFIRMATION PENDING'
                  }, void 0, false, { fileName: G, lineNumber: 69 }, void 0)
                ]
              }, void 0, true, { fileName: G, lineNumber: 70 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 71 }, void 0),

          items.length > 0 && (0, I.jsxDEV)('div', {
            className: 'pt-2 border-t border-[#E8DCCF] space-y-1.5',
            children: [
              (0, I.jsxDEV)('span', { className: 'text-[10px] font-bold text-gray-400 uppercase tracking-wider block', children: 'Ordered Products' }),
              ...items.map((item, idx) => (0, I.jsxDEV)('div', {
                className: 'flex justify-between text-xs py-1 border-b border-gray-100 last:border-0',
                children: [
                  (0, I.jsxDEV)('div', { className: 'text-gray-800 font-medium', children: [(idx + 1) + '. ', item.productName || item.title, item.quantity > 1 ? (' × ' + item.quantity) : ''] }, void 0, true, { fileName: G, lineNumber: 73 }, void 0),
                  (0, I.jsxDEV)('div', { className: 'font-semibold text-gray-900', children: '₹' + ((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN') }, void 0, false, { fileName: G, lineNumber: 74 }, void 0)
                ]
              }, idx, false, { fileName: G, lineNumber: 75 }, void 0))
            ]
          }, void 0, true, { fileName: G, lineNumber: 76 }, void 0),

          (0, I.jsxDEV)('div', {
            className: 'pt-2 border-t border-[#E8DCCF] space-y-1',
            children: [
              (0, I.jsxDEV)('div', { className: 'flex justify-between text-gray-600', children: [(0, I.jsxDEV)('span', { children: 'Product Subtotal' }, void 0, false, { fileName: G, lineNumber: 77 }, void 0), (0, I.jsxDEV)('span', { className: 'font-semibold', children: '₹' + subtotal.toLocaleString('en-IN') }, void 0, false, { fileName: G, lineNumber: 78 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 79 }, void 0),
              discount > 0 && (0, I.jsxDEV)('div', { className: 'flex justify-between text-emerald-700 font-semibold', children: [(0, I.jsxDEV)('span', { children: 'Discount Applied' }, void 0, false, { fileName: G, lineNumber: 80 }, void 0), (0, I.jsxDEV)('span', { children: '-₹' + discount.toLocaleString('en-IN') }, void 0, false, { fileName: G, lineNumber: 81 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 82 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between text-gray-600', children: [(0, I.jsxDEV)('span', { children: 'Shipping Charges' }, void 0, false, { fileName: G, lineNumber: 83 }, void 0), (0, I.jsxDEV)('span', { className: 'font-semibold', children: deliveryCharge > 0 ? ('₹' + deliveryCharge.toLocaleString('en-IN')) : 'FREE (Royal Atelier Delivery)' }, void 0, false, { fileName: G, lineNumber: 84 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 85 }, void 0),
              (0, I.jsxDEV)('div', { className: 'flex justify-between text-sm font-bold text-[#3B1E22] pt-2 border-t border-[#E8DCCF]', children: [(0, I.jsxDEV)('span', { children: 'Final Paid Amount' }, void 0, false, { fileName: G, lineNumber: 86 }, void 0), (0, I.jsxDEV)('span', { className: 'text-[#802336]', children: '₹' + totalAmount.toLocaleString('en-IN') }, void 0, false, { fileName: G, lineNumber: 87 }, void 0)] }, void 0, true, { fileName: G, lineNumber: 88 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 89 }, void 0)
        ]
      }, void 0, true, { fileName: G, lineNumber: 90 }, void 0),

      (0, I.jsxDEV)('div', {
        className: 'max-w-lg mx-auto text-left',
        children: [
          (0, I.jsxDEV)('button', {
            onClick: () => setShowFullReceipt(!showFullReceipt),
            className: 'text-xs font-bold text-[#3B1E22] hover:text-[#802336] underline cursor-pointer flex items-center gap-1',
            children: showFullReceipt ? '▲ Hide Prepared WhatsApp Message' : '▼ View Prepared WhatsApp Message to 7302187770'
          }, void 0, false, { fileName: G, lineNumber: 91 }, void 0),
          showFullReceipt && (0, I.jsxDEV)('div', {
            className: 'mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-mono text-gray-700 whitespace-pre-wrap relative',
            children: [
              preparedMessage,
              (0, I.jsxDEV)('button', {
                onClick: handleCopyMessage,
                className: 'mt-2 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded cursor-pointer block',
                children: copied ? '✓ Copied to Clipboard!' : 'Copy Message Text'
              }, void 0, false, { fileName: G, lineNumber: 92 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 93 }, void 0)
        ]
      }, void 0, true, { fileName: G, lineNumber: 94 }, void 0),

      (0, I.jsxDEV)('div', {
        className: 'flex flex-col sm:flex-row items-center justify-center gap-3 pt-4',
        children: [
          (0, I.jsxDEV)('button', {
            onClick: () => r(orderId),
            className: 'w-full sm:w-auto bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2',
            children: [
              (0, I.jsxDEV)('span', { className: 'text-[#DFB982]', children: '📦' }, void 0, false, { fileName: G, lineNumber: 95 }, void 0),
              (0, I.jsxDEV)('span', { children: 'Track Order Live' }, void 0, false, { fileName: G, lineNumber: 96 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 97 }, void 0),
          (0, I.jsxDEV)('button', {
            onClick: n,
            className: 'w-full sm:w-auto bg-white border border-[#E8DCCF] hover:bg-gray-50 text-[#3B1E22] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
            children: 'Continue Shopping'
          }, void 0, false, { fileName: G, lineNumber: 98 }, void 0),
          (0, I.jsxDEV)('button', {
            onClick: handleOpenWhatsApp,
            className: 'w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm',
            children: [
              (0, I.jsxDEV)('span', { children: '💬' }, void 0, false, { fileName: G, lineNumber: 99 }, void 0),
              (0, I.jsxDEV)('span', { children: 'Chat with Studio Owner' }, void 0, false, { fileName: G, lineNumber: 100 }, void 0)
            ]
          }, void 0, true, { fileName: G, lineNumber: 101 }, void 0)
        ]
      }, void 0, true, { fileName: G, lineNumber: 102 }, void 0)
    ]
  }, void 0, true, { fileName: G, lineNumber: 103 }, void 0);
}`;

// Insert component right before G=`/app/applet/src/views/CheckoutView.tsx` as part of the var list
const gMarker = "G=`/app/applet/src/views/CheckoutView.tsx`";
if (!code.includes(gMarker)) {
  console.error("Could not find G marker!");
  process.exit(1);
}
code = code.replace(gMarker, componentCode + "," + gMarker);
console.log("[SUCCESS] Inserted WhatsAppOrderConfirmationView component into var declaration!");

// Replace step 4 rendering
const step4StartMarker = "v===4&&ke&&(0,I.jsxDEV)(`div`,{className:`bg-white rounded-3xl border border-[#E8DCCF] p-8 sm:p-12 shadow-xl text-center space-y-6 animate-fadeIn`";
const step4EndMarker = "Continue Shopping`},void 0,!1,{fileName:G,lineNumber:1722,columnNumber:13},void 0)]},void 0,!0,{fileName:G,lineNumber:1713,columnNumber:11},void 0)]},void 0,!0,{fileName:G,lineNumber:1590,columnNumber:9},void 0)";

const sIdx = code.indexOf(step4StartMarker);
const eIdx = code.indexOf(step4EndMarker);

if (sIdx === -1 || eIdx === -1) {
  console.error("Could not locate step 4 markers!", { sIdx, eIdx });
  process.exit(1);
}

const targetStep4 = code.slice(sIdx, eIdx + step4EndMarker.length);
const replacementStep4 = "v===4&&ke&&(0,I.jsxDEV)(WhatsAppOrderConfirmationView,{order:ke,onTrackOrder:r,onContinueShopping:n},void 0,!1,{fileName:G,lineNumber:1590,columnNumber:9},void 0)";

code = code.replace(targetStep4, replacementStep4);
console.log("[SUCCESS] Replaced step 4 rendering with WhatsAppOrderConfirmationView!");

// Validate syntax
try {
  new vm.Script(code);
  console.log("[SUCCESS] Syntax validation passed completely!");
  fs.writeFileSync(filePath, code, 'utf8');
  if (fs.existsSync('dist/' + filePath)) {
    fs.writeFileSync('dist/' + filePath, code, 'utf8');
  }
  console.log("[SUCCESS] Saved updated bundle files!");
} catch (err) {
  console.error("[ERROR] Syntax error detected in modified bundle:", err);
  process.exit(1);
}
