import React, { useState, useEffect, useMemo } from 'react';
import { RetailProduct, RetailSale, Designer } from '../types';
import { api } from '../api/client';
import { getLocalTodayStr } from '../utils/timeSlots';
import { formatPrice } from '../utils/formatters';
import { playSuccessChime } from '../utils/audio';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Package,
  Sparkles,
  X,
  PlusCircle,
  Calendar,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RetailSalesSectionProps {
  selectedDate?: string;
  reportRangeMode?: 'single' | 'month' | 'all';
  designers: Designer[];
  lang?: 'en' | 'my';
  onSalesUpdated?: (totalRevenue: number, totalBarberCommission: number) => void;
}

export const RetailSalesSection: React.FC<RetailSalesSectionProps> = ({
  selectedDate: propSelectedDate,
  reportRangeMode: _propReportRangeMode,
  designers,
  lang = 'en',
  onSalesUpdated
}) => {
  const todayStr = getLocalTodayStr();
  const [startDate, setStartDate] = useState<string>(propSelectedDate || todayStr);
  const [endDate, setEndDate] = useState<string>(propSelectedDate || todayStr);

  const [sales, setSales] = useState<RetailSale[]>([]);
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Record / Edit Sale Modal State
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  // Product Catalog Management Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [productModalTab, setProductModalTab] = useState<'add' | 'list'>('list');

  // Form State for Recording / Editing Sale
  const [saleDate, setSaleDate] = useState<string>(startDate || todayStr);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'kpay' | 'wave' | 'pay_at_shop'>('cash');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State for New Product Catalog Item
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [newProdCommission, setNewProdCommission] = useState<number | ''>(10);
  const [newProdCategory, setNewProdCategory] = useState('Hair Styling & Pomade');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setLoading(true);
    const unsubSales = api.subscribeToRetailSales((list) => {
      setSales(list || []);
      setLoading(false);
    });

    const unsubProd = api.subscribeToRetailProducts((list) => {
      setProducts(list || []);
    });

    return () => {
      unsubSales();
      unsubProd();
    };
  }, []);

  // Filter sales for the selected date range
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const sDate = s.date || '';
      if (startDate && sDate < startDate) return false;
      if (endDate && sDate > endDate) return false;
      return true;
    });
  }, [sales, startDate, endDate]);

  // Aggregates
  const { totalRevenue, totalBarberCommission, totalUnitsSold } = useMemo(() => {
    let rev = 0;
    let comm = 0;
    let units = 0;
    for (const s of filteredSales) {
      rev += Number(s.totalPrice) || 0;
      comm += Number(s.barberCommissionAmount) || 0;
      units += Number(s.quantity) || 1;
    }
    return { totalRevenue: rev, totalBarberCommission: comm, totalUnitsSold: units };
  }, [filteredSales]);

  useEffect(() => {
    if (onSalesUpdated) {
      onSalesUpdated(totalRevenue, totalBarberCommission);
    }
  }, [totalRevenue, totalBarberCommission, onSalesUpdated]);

  const handleOpenSaleModal = (prod?: RetailProduct) => {
    setEditingSaleId(null);
    setSaleDate(startDate || todayStr);
    const targetProd = prod || products[0];
    if (targetProd) {
      setSelectedProductId(targetProd.id);
      setUnitPrice(targetProd.price);
    } else {
      setSelectedProductId('');
      setUnitPrice(0);
    }
    setQuantity(1);
    setSelectedBarberId('');
    setPaymentMethod('cash');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setShowSaleModal(true);
  };

  const handleOpenEditSaleModal = (sale: RetailSale) => {
    setEditingSaleId(sale.id);
    setSaleDate(sale.date || startDate || todayStr);
    setSelectedProductId(sale.productId || '');
    setUnitPrice(sale.unitPrice || 0);
    setQuantity(sale.quantity || 1);
    setSelectedBarberId(sale.barberId || '');
    setPaymentMethod(sale.paymentMethod || 'cash');
    setCustomerName(sale.customerName || '');
    setCustomerPhone(sale.customerPhone || '');
    setNotes(sale.notes || '');
    setShowSaleModal(true);
  };

  const handleProductSelectChange = (pId: string) => {
    setSelectedProductId(pId);
    const prod = products.find(p => p.id === pId);
    if (prod) {
      setUnitPrice(prod.price);
    }
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod && !selectedProductId && !editingSaleId) return;

    const prodName = prod ? prod.name : 'Shop Product';
    const finalUnitPrice = Number(unitPrice) || (prod ? prod.price : 0);
    const finalTotalPrice = finalUnitPrice * quantity;

    let barberCommissionAmount = 0;
    let barberName = undefined;
    if (selectedBarberId) {
      const barber = designers.find(d => d.id === selectedBarberId);
      barberName = barber?.name;
      const commRate = prod?.barberCommissionPercent ?? 10;
      barberCommissionAmount = Math.round((finalTotalPrice * commRate) / 100);
    }

    setIsSubmitting(true);
    try {
      if (editingSaleId) {
        await api.updateRetailSale(editingSaleId, {
          date: saleDate,
          productId: selectedProductId || undefined,
          productName: prodName,
          unitPrice: finalUnitPrice,
          quantity,
          totalPrice: finalTotalPrice,
          barberId: selectedBarberId || undefined,
          barberName,
          barberCommissionAmount,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined
        });
        showToast('✅ ပစ္စည်းအရောင်းစာရင်း ပြင်ဆင်ပြီးပါပြီ');
      } else {
        await api.addRetailSale({
          date: saleDate,
          productId: selectedProductId,
          productName: prodName,
          unitPrice: finalUnitPrice,
          quantity,
          totalPrice: finalTotalPrice,
          barberId: selectedBarberId || undefined,
          barberName,
          barberCommissionAmount,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined
        });
        showToast('✅ ပစ္စည်းရောင်းချမှု စာရင်း အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ');
      }

      playSuccessChime();
      setShowSaleModal(false);
      setEditingSaleId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSale = async (id: string, name: string) => {
    if (window.confirm(`"${name}" ရောင်းချမှု စာရင်းကို ဖျက်ရန် သေချာပါသလား?`)) {
      await api.deleteRetailSale(id);
      playSuccessChime();
      showToast('🗑️ အရောင်းစာရင်း ဖျက်ပြီးပါပြီ');
    }
  };

  const handleDeleteProduct = async (e: React.MouseEvent, productId: string, productName: string) => {
    e.stopPropagation();
    if (window.confirm(`"${productName}" ကို Product Catalog မှ ဖျက်ရန် သေချာပါသလား?`)) {
      try {
        await api.deleteRetailProduct(productId);
        playSuccessChime();
        showToast(`🗑️ "${productName}" ကို Catalog မှ ဖျက်လိုက်ပါပြီ`);
      } catch (err) {
        console.error('Failed to delete product:', err);
      }
    }
  };

  const handleSaveNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice || Number(newProdPrice) <= 0) return;

    try {
      const created = await api.saveRetailProduct({
        name: newProdName.trim(),
        price: Number(newProdPrice),
        barberCommissionPercent: Number(newProdCommission) || 0,
        category: newProdCategory
      });
      playSuccessChime();
      showToast(`✅ "${created.name}" ပစ္စည်းအသစ် ထည့်သွင်းပြီးပါပြီ`);
      setNewProdName('');
      setNewProdPrice('');
      setShowProductModal(false);
      // Auto-select for sale
      handleOpenSaleModal(created);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-4 font-sans">
      
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-50 bg-stone-950 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-mono font-bold flex items-center space-x-2 border border-stone-800"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Date Filtering Toolbar */}
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-950 text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                {lang === 'my' ? 'ဆိုင်သုံးပစ္စည်း အရောင်း (POS & Retail Sales)' : 'POS & Retail Product Sales'}
              </h4>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-2xl font-mono text-xs font-bold text-stone-900">
              Total: {formatPrice(totalRevenue)} ({totalUnitsSold} pcs)
            </div>
            <button
              type="button"
              onClick={() => handleOpenSaleModal()}
              className="px-3 py-1.5 bg-stone-950 hover:bg-stone-800 text-emerald-300 text-xs font-mono font-black rounded-2xl flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors border border-stone-900"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'my' ? '+ ပစ္စည်းရောင်းမည် (POS)' : '+ Record Sale (POS)'}</span>
            </button>
          </div>
        </div>

        {/* Compact Date Range Picker (From -> To with Today button) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center flex-wrap gap-1.5">
            <div className="flex items-center space-x-1 sm:space-x-1.5 bg-stone-100 border border-stone-200 px-2 py-1 rounded-lg font-mono text-xs text-stone-800 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-stone-400 font-bold text-[10px] shrink-0">{lang === 'my' ? 'မှ:' : 'From:'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (endDate && val > endDate) {
                    setEndDate(val);
                  }
                }}
                className="w-[105px] sm:w-[115px] bg-white border border-stone-200/80 rounded px-1 py-0.5 text-[11px] text-stone-900 font-bold focus:outline-hidden cursor-pointer"
              />
              <span className="text-stone-300 font-bold text-[10px] shrink-0">~</span>
              <span className="text-stone-400 font-bold text-[10px] shrink-0">{lang === 'my' ? 'ထိ:' : 'To:'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndDate(val);
                  if (startDate && val < startDate) {
                    setStartDate(val);
                  }
                }}
                className="w-[105px] sm:w-[115px] bg-white border border-stone-200/80 rounded px-1 py-0.5 text-[11px] text-stone-900 font-bold focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setStartDate(todayStr);
                setEndDate(todayStr);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors border shrink-0 ${
                startDate === todayStr && endDate === todayStr
                  ? 'bg-stone-950 text-emerald-300 border-stone-950 shadow-2xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title="Reset to Today"
            >
              {lang === 'my' ? 'ယနေ့' : 'Today'}
            </button>
          </div>

          <div className="text-stone-500 text-[11px] font-mono">
            {filteredSales.length} {lang === 'my' ? 'အရောင်းစာရင်း' : 'sales recorded'}
          </div>
        </div>
      </div>

      {/* Product Catalog Quick Sales Bar with Direct Delete */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-stone-600 uppercase tracking-wider flex items-center space-x-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>Product Catalog ({products.length}):</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setProductModalTab('add');
                setShowProductModal(true);
              }}
              className="text-[10px] font-mono font-bold text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 cursor-pointer"
            >
              <PlusCircle className="w-3 h-3" />
              <span>+ ပစ္စည်းအသစ်</span>
            </button>
            {products.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setProductModalTab('list');
                  setShowProductModal(true);
                }}
                className="text-[10px] font-mono font-bold text-stone-500 hover:text-stone-900 flex items-center space-x-1 cursor-pointer"
              >
                <span>စာရင်းစီမံရန်</span>
              </button>
            )}
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-stone-400 text-[11px] font-mono py-1">
            ပစ္စည်းစာရင်း မရှိသေးပါ။
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {products.map((p) => (
              <div
                key={p.id}
                className="group inline-flex items-center bg-white hover:bg-emerald-50/80 border border-stone-200 hover:border-emerald-400 rounded-xl pl-2.5 pr-1 py-1 text-xs font-mono font-bold text-stone-900 shadow-2xs transition-all gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => handleOpenSaleModal(p)}
                  className="inline-flex items-center space-x-1.5 cursor-pointer text-left"
                  title={`ရောင်းချရန် နှိပ်ပါ - ${p.name}`}
                >
                  <span>{p.name}</span>
                  <span className="text-emerald-700 font-normal">({formatPrice(p.price)})</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteProduct(e, p.id, p.name)}
                  className="p-1 rounded-md text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title={`"${p.name}" ကို Catalog မှ ဖျက်မည်`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sales Table */}
      {filteredSales.length === 0 ? (
        <div className="p-6 text-center bg-stone-50/60 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs font-mono">
          {lang === 'my' ? 'ပစ္စည်းရောင်းချမှု မှတ်တမ်း မရှိသေးပါ။' : 'No retail sales recorded for this period.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-mono uppercase text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Product Name (ပစ္စည်းအမည်)</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right font-bold text-stone-900">Total Price</th>
                <th className="py-2.5 px-3">Barber Sold</th>
                <th className="py-2.5 px-3 text-right font-bold text-emerald-700">Barber Comm</th>
                <th className="py-2.5 px-3 text-center">Payment</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono">
              {filteredSales.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                  <td className="py-3 px-3 text-stone-700 font-bold whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md text-stone-800 text-[11px]">
                      <Calendar className="w-3 h-3 text-stone-500" />
                      {item.date}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-stone-900 block">{item.productName}</span>
                    {item.customerName && (
                      <span className="text-[10px] text-stone-400 block font-normal">{item.customerName}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-stone-700">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-600">
                    {formatPrice(item.unitPrice)}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-stone-950">
                    {formatPrice(item.totalPrice)}
                  </td>
                  <td className="py-3 px-3 text-stone-700">
                    {item.barberName ? (
                      <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-200">
                        {item.barberName}
                      </span>
                    ) : (
                      <span className="text-stone-400 text-[10px]">Counter</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {item.barberCommissionAmount ? formatPrice(item.barberCommissionAmount) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded-md font-bold bg-stone-100 text-stone-700">
                      {item.paymentMethod || 'cash'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSaleModal(item)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(item.id, item.productName)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record / Edit Product Sale Modal */}
      <AnimatePresence>
        {showSaleModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                    {editingSaleId ? 'အရောင်း ပြင်ဆင်ရန်' : 'ပစ္စည်း ရောင်းချမည်'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="p-1 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitSale} className="space-y-4 text-xs">
                
                {/* Sale Date */}
                <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  <label className="font-bold text-stone-800 font-mono uppercase text-[11px] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ရက်စွဲ (Sale Date) *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSaleDate(todayStr)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        saleDate === todayStr
                          ? 'bg-emerald-500 text-stone-950'
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      ယနေ့
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleDate(getYesterdayDateStr())}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        saleDate === getYesterdayDateStr()
                          ? 'bg-emerald-500 text-stone-950'
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      မနေ့က
                    </button>
                  </div>
                </div>

                {/* Product Select */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                      ပစ္စည်း (Product) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaleModal(false);
                        setProductModalTab('add');
                        setShowProductModal(true);
                      }}
                      className="text-[10px] text-emerald-700 font-bold hover:underline"
                    >
                      + အသစ်ထည့်ရန်
                    </button>
                  </div>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelectChange(e.target.value)}
                    required
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="" disabled>ပစ္စည်း ရွေးချယ်ပါ</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.price)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Qty and Unit Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                      အရေအတွက် *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                      နှုန်းထား (Price) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Total Price Display */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between font-mono">
                  <span className="text-xs font-bold text-stone-700 uppercase">Total:</span>
                  <span className="text-base font-black text-emerald-950">
                    {formatPrice(unitPrice * quantity)}
                  </span>
                </div>

                {/* Barber Who Sold */}
                <div className="space-y-1">
                  <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                    ဆံသဆရာ (Barber)
                  </label>
                  <select
                    value={selectedBarberId}
                    onChange={(e) => setSelectedBarberId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">မရှိပါ (Counter)</option>
                    {designers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
                <div className="space-y-1">
                  <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                    ငွေပေးချေမှု
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: '💵 Cash' },
                      { id: 'kpay', label: '📱 KBZPay' },
                      { id: 'wave', label: '🌊 WavePay' }
                    ].map(pm => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`p-2 rounded-xl border text-center font-mono font-bold transition-all cursor-pointer ${
                          paymentMethod === pm.id
                            ? 'bg-emerald-500 text-stone-950 border-emerald-500 shadow-2xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Name & Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[10px]">
                      ဝယ်ယူသူအမည်
                    </label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-stone-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[10px]">
                      မှတ်ချက်
                    </label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-stone-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowSaleModal(false)}
                    className="px-4 py-2 rounded-2xl border border-stone-200 text-stone-700 font-mono font-bold hover:bg-stone-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-mono font-black cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingSaleId ? 'Update Sale' : 'Save Sale'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Catalog Modal (Manage, List & Add Products) */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                    Product Catalog
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="p-1 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => setProductModalTab('list')}
                  className={`py-2 px-4 text-xs font-mono font-bold transition-all border-b-2 cursor-pointer ${
                    productModalTab === 'list'
                      ? 'border-emerald-500 text-emerald-900 bg-emerald-50/50 rounded-t-lg'
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Catalog စာရင်း ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductModalTab('add')}
                  className={`py-2 px-4 text-xs font-mono font-bold transition-all border-b-2 cursor-pointer ${
                    productModalTab === 'add'
                      ? 'border-emerald-500 text-emerald-900 bg-emerald-50/50 rounded-t-lg'
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  + ပစ္စည်းအသစ်ထည့်ရန်
                </button>
              </div>

              {productModalTab === 'list' ? (
                <div className="space-y-3">
                  {products.length === 0 ? (
                    <div className="py-8 text-center text-stone-400 text-xs font-mono">
                      ပစ္စည်းစာရင်း မရှိသေးပါ။
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto pr-1">
                      {products.map((p) => (
                        <div key={p.id} className="py-2.5 flex items-center justify-between group">
                          <div>
                            <div className="font-bold text-stone-900 text-xs">{p.name}</div>
                            <div className="flex items-center space-x-2 text-[11px] font-mono text-stone-500">
                              <span className="text-emerald-700 font-bold">{formatPrice(p.price)}</span>
                              <span>•</span>
                              <span>{p.category || 'General'}</span>
                              {p.barberCommissionPercent ? (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-bold">Comm: {p.barberCommissionPercent}%</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowProductModal(false);
                                handleOpenSaleModal(p);
                              }}
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors"
                            >
                              ရောင်းမည်
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteProduct(e, p.id, p.name)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title={`"${p.name}" ကို Catalog မှ ဖျက်မည်`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => setProductModalTab('add')}
                      className="text-xs font-mono font-bold text-emerald-700 hover:underline"
                    >
                      + ပစ္စည်းအသစ်ထည့်မည်
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductModal(false)}
                      className="px-4 py-1.5 rounded-2xl bg-stone-100 text-stone-700 font-mono font-bold text-xs hover:bg-stone-200 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveNewProduct} className="space-y-4 text-xs">
                  
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                      ပစ္စည်း အမည် *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pomade, Hair Wax, Beard Oil"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                        ရောင်းစျေး (Price MMK) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="e.g. 15000"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                        ဆရာကော်မရှင် (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="e.g. 10"
                        value={newProdCommission}
                        onChange={(e) => setNewProdCommission(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                      အမျိုးအစား (Category)
                    </label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Hair Styling & Pomade">Hair Styling & Pomade</option>
                      <option value="Shampoo & Hair Care">Shampoo & Hair Care</option>
                      <option value="Beard & Shaving Care">Beard & Shaving Care</option>
                      <option value="General Retail">General Retail</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => setProductModalTab('list')}
                      className="px-4 py-2 rounded-2xl border border-stone-200 text-stone-700 font-mono font-bold hover:bg-stone-100 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-mono font-black cursor-pointer shadow-xs"
                    >
                      Save Product
                    </button>
                  </div>

                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

