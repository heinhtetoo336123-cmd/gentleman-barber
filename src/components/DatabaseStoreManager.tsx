import React, { useState, useRef } from 'react';
import { api } from '../api/client';
import { verifyAdminResetPassword } from '../lib/authCrypto';
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import {
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  Scissors,
  Users,
  Calendar,
  Bell,
  Lock,
  ShieldAlert,
  Trash2,
  Tag,
  Sliders,
  HardDriveDownload,
  HardDriveUpload,
  Loader2,
  FileUp,
  X,
  Check,
  RefreshCw
} from 'lucide-react';

interface DatabaseStoreManagerProps {
  onRefreshAll: () => void;
}

export const DatabaseStoreManager: React.FC<DatabaseStoreManagerProps> = ({ onRefreshAll }) => {
  const [dbData, setDbData] = useState<any>(null);
  const [activeTable, setActiveTable] = useState<'all' | 'services' | 'designers' | 'bookings' | 'clients' | 'promos' | 'notifications' | 'settings'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  // JSON Backup & Restore state
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Password Protected Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetError, setResetError] = useState('');

  React.useEffect(() => {
    fetchDbData();
  }, []);

  const fetchDbData = async () => {
    setLoading(true);
    try {
      const data = await api.exportDatabase();
      setDbData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = async () => {
    try {
      setLoading(true);
      const data = await api.exportDatabase();
      setDbData(data);
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `GENTLEMAN-Barber-Full-Backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      playSuccessChime();
      setMsg({
        type: 'success',
        text: `JSON Backup ဖိုင်အား အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ (${data.services?.length || 0} Services, ${data.designers?.length || 0} Barbers, ${data.bookings?.length || 0} Bookings, ${data.clients?.length || 0} Clients, ${data.promos?.length || 0} Promos)`
      });
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Backup export failed: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (dbData) {
      navigator.clipboard.writeText(JSON.stringify(dbData, null, 2));
      setCopied(true);
      playNotificationChime();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Process and validate JSON text
  const handleValidateJson = (text: string) => {
    setImportJsonText(text);
    setParseError('');
    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) {
        setParseError('Invalid JSON structure. Root must be a JSON object.');
        setParsedPreview(null);
        return;
      }
      setParsedPreview(parsed);
    } catch (err: any) {
      setParseError(err.message || 'Malformed JSON');
      setParsedPreview(null);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setParseError('ကျေးဇူးပြု၍ .json ဖိုင်ကိုသာ ရွေးချယ်ပေးပါ (Please select a .json file)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleValidateJson(content);
    };
    reader.onerror = () => {
      setParseError('Failed to read JSON file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedPreview) {
      setParseError('ကျေးဇူးပြု၍ မှန်ကန်သော JSON ဒေတာ ထည့်သွင်းပေးပါ (Please provide valid JSON)');
      return;
    }

    setImporting(true);
    setParseError('');
    try {
      const result = await api.importDatabase(parsedPreview);
      if (result.success) {
        setShowImportModal(false);
        setImportJsonText('');
        setParsedPreview(null);
        await fetchDbData();
        onRefreshAll();
        playSuccessChime();
        
        const counts = result.restoredCounts || {};
        const breakdown = Object.entries(counts)
          .map(([k, v]) => `${v} ${k}`)
          .join(', ');

        setMsg({
          type: 'success',
          text: `Database ဒေတာများအား JSON ဖိုင်မှ အောင်မြင်စွာ Restore လုပ်ပြီးပါပြီ! (${breakdown || 'All records synced'})`
        });
      } else {
        setParseError(result.message || 'Failed to restore database.');
      }
    } catch (err: any) {
      setParseError('Restore error: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleOpenResetModal = () => {
    setResetPasswordInput('');
    setResetError('');
    setShowResetModal(true);
  };

  const handleResetToZeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResetError('');

    if (!verifyAdminResetPassword(resetPasswordInput)) {
      setResetError('မှားယွင်းသော အက်ဒမင် လျှို့ဝှက်နံပါတ် (Incorrect Password)');
      setLoading(false);
      return;
    }

    const res = await api.resetDatabaseToZero(resetPasswordInput);
    if (res.success) {
      setShowResetModal(false);
      setResetPasswordInput('');
      await fetchDbData();
      onRefreshAll();
      setMsg({ type: 'success', text: 'ဝန်ဆောင်မှု သမိုင်းကြောင်းနှင့် ဒေတာအားလုံးကို 0 သို့ ပြန်စလိုက်ပါပြီ။' });
    } else {
      setResetError(res.message || 'Reset failed');
    }
    setLoading(false);
  };

  const handleResetSeedSubmit = async () => {
    setLoading(true);
    setResetError('');

    if (!verifyAdminResetPassword(resetPasswordInput)) {
      setResetError('မှားယွင်းသော အက်ဒမင် လျှို့ဝှက်နံပါတ် (Incorrect Password)');
      setLoading(false);
      return;
    }

    const res = await api.resetDatabase(resetPasswordInput);
    if (res.success) {
      setShowResetModal(false);
      setResetPasswordInput('');
      await fetchDbData();
      onRefreshAll();
      setMsg({ type: 'success', text: 'Database store reset to initial seed values.' });
    } else {
      setResetError(res.message || 'Reset failed');
    }
    setLoading(false);
  };

  const handlePurgeOldClientsSubmit = async () => {
    setLoading(true);
    setResetError('');

    if (!verifyAdminResetPassword(resetPasswordInput)) {
      setResetError('မှားယွင်းသော အက်ဒမင် လျှို့ဝှက်နံပါတ် (Incorrect Password)');
      setLoading(false);
      return;
    }

    const res = await api.purgeOldClientsAndNotifications();
    if (res.success) {
      setShowResetModal(false);
      setResetPasswordInput('');
      await fetchDbData();
      onRefreshAll();
      setMsg({ type: 'success', text: 'Firestore client အဟောင်းများနှင့် notifications အားလုံးကို ရှင်းလင်းပြီးပါပြီ။' });
    } else {
      setResetError(res.message || 'Purge failed');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="p-5 bg-white border border-stone-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 uppercase tracking-wide font-mono flex items-center space-x-2">
              <span>Database Store Management</span>
            </h3>
            <p className="text-xs text-stone-500">
              Direct JSON database records, live backup, import/restore, persistent auto-save, & reset tools
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportJson}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-98 transition-all disabled:opacity-50"
            title="Download full database as .json file"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>

          <button
            onClick={() => {
              setImportJsonText('');
              setParsedPreview(null);
              setParseError('');
              setShowImportModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white border border-stone-800 font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
            title="Upload and restore database from .json file"
          >
            <HardDriveUpload className="w-4 h-4 text-emerald-300" />
            <span>Restore / Import JSON</span>
          </button>

          <button
            onClick={handleOpenResetModal}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer"
            title="Reset All Data to Zero with Admin Password"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Reset Data (0 မှ ပြန်စရန်)</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-2xs ${
          msg.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : msg.type === 'info'
            ? 'bg-blue-50 border-blue-300 text-blue-800'
            : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2">
            {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span className="font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-stone-400 hover:text-stone-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Record Counter Badges */}
      {dbData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Services</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.services?.length || 0}</p>
            </div>
            <Scissors className="w-5 h-5 text-stone-400" />
          </div>

          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Stylists</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.designers?.length || 0}</p>
            </div>
            <Users className="w-5 h-5 text-stone-400" />
          </div>

          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Bookings</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.bookings?.length || 0}</p>
            </div>
            <Calendar className="w-5 h-5 text-stone-400" />
          </div>

          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Clients</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.clients?.length || 0}</p>
            </div>
            <Users className="w-5 h-5 text-stone-400" />
          </div>

          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Promos</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.promos?.length || 0}</p>
            </div>
            <Tag className="w-5 h-5 text-stone-400" />
          </div>

          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Alerts</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.notifications?.length || 0}</p>
            </div>
            <Bell className="w-5 h-5 text-stone-400" />
          </div>

          <div className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-mono">Settings</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{dbData.settings ? 'Ready' : '-'}</p>
            </div>
            <Sliders className="w-5 h-5 text-stone-400" />
          </div>
        </div>
      )}

      {/* Table Selection Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex space-x-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1">
          {(['all', 'services', 'designers', 'bookings', 'clients', 'promos', 'notifications', 'settings'] as const).map((tbl) => (
            <button
              key={tbl}
              onClick={() => setActiveTable(tbl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                activeTable === tbl
                  ? 'bg-emerald-500 text-stone-950 font-extrabold shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {tbl}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search JSON payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <button
            onClick={fetchDbData}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 cursor-pointer shrink-0 shadow-2xs"
            title="Refresh Database Snapshot"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Raw JSON Code Display Box */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 relative overflow-hidden shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3 text-xs text-stone-400">
          <span className="font-mono flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-300" />
            <span>Store Payload ({activeTable.toUpperCase()})</span>
            {dbData?.exportedAt && (
              <span className="text-[10px] text-stone-500 font-mono hidden sm:inline">
                • Snapshot: {new Date(dbData.exportedAt).toLocaleTimeString()}
              </span>
            )}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:text-white transition-colors cursor-pointer border border-stone-700 font-mono text-xs shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy JSON'}</span>
            </button>
          </div>
        </div>

        <pre className="text-[11px] font-mono text-emerald-200/90 overflow-x-auto max-h-[450px] p-2 scrollbar-thin leading-relaxed">
          {dbData
            ? JSON.stringify(
                activeTable === 'all'
                  ? dbData
                  : dbData[activeTable],
                null,
                2
              )
            : 'Loading database records...'}
        </pre>
      </div>

      {/* Full JSON Restore / Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <HardDriveUpload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-stone-900 font-mono">
                    Restore Database from JSON
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Upload a JSON backup file or paste the JSON payload to restore all functional data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteRestore} className="space-y-4">
              
              {/* Drag and drop / File Upload Box */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase font-mono tracking-wider">
                  Option 1: Upload .json Backup File
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-stone-300 hover:border-emerald-500 bg-stone-50/70'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <FileUp className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                  <p className="text-xs font-bold text-stone-800">
                    Click to select .json file or drag & drop here
                  </p>
                  <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                    Supports GENTLEMAN Full Backup .json files
                  </p>
                </div>
              </div>

              {/* Paste JSON Text Option */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                    Option 2: Paste JSON Structure
                  </label>
                  {parsedPreview && (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1 font-mono">
                      <Check className="w-3.5 h-3.5" />
                      <span>Valid JSON Structure</span>
                    </span>
                  )}
                </div>
                <textarea
                  rows={6}
                  placeholder='{ "services": [...], "designers": [...], "bookings": [...], "clients": [...] }'
                  value={importJsonText}
                  onChange={(e) => handleValidateJson(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-mono text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white leading-relaxed"
                />
              </div>

              {/* Error Box if parsing failed */}
              {parseError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Data Detection Summary Preview */}
              {parsedPreview && (
                <div className="p-3.5 bg-stone-900 border border-stone-800 rounded-2xl text-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-300">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Detected Database Entities to Restore:</span>
                    </span>
                    {parsedPreview.exportedAt && (
                      <span className="text-[10px] text-stone-400">
                        Date: {new Date(parsedPreview.exportedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center">
                      <span className="block text-[10px] text-stone-400 font-mono">Services</span>
                      <span className="text-sm font-black text-white font-mono">
                        {Array.isArray(parsedPreview.services) ? parsedPreview.services.length : 0}
                      </span>
                    </div>
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center">
                      <span className="block text-[10px] text-stone-400 font-mono">Stylists</span>
                      <span className="text-sm font-black text-white font-mono">
                        {Array.isArray(parsedPreview.designers) ? parsedPreview.designers.length : 0}
                      </span>
                    </div>
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center">
                      <span className="block text-[10px] text-stone-400 font-mono">Bookings</span>
                      <span className="text-sm font-black text-white font-mono">
                        {Array.isArray(parsedPreview.bookings) ? parsedPreview.bookings.length : 0}
                      </span>
                    </div>
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center">
                      <span className="block text-[10px] text-stone-400 font-mono">Clients</span>
                      <span className="text-sm font-black text-white font-mono">
                        {Array.isArray(parsedPreview.clients) ? parsedPreview.clients.length : 0}
                      </span>
                    </div>
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center">
                      <span className="block text-[10px] text-stone-400 font-mono">Promos</span>
                      <span className="text-sm font-black text-white font-mono">
                        {Array.isArray(parsedPreview.promos) ? parsedPreview.promos.length : 0}
                      </span>
                    </div>
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center">
                      <span className="block text-[10px] text-stone-400 font-mono">Notifications</span>
                      <span className="text-sm font-black text-white font-mono">
                        {Array.isArray(parsedPreview.notifications) ? parsedPreview.notifications.length : 0}
                      </span>
                    </div>
                    <div className="p-2 bg-stone-800/80 rounded-lg text-center col-span-2">
                      <span className="block text-[10px] text-stone-400 font-mono">Shop & Payment Settings</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {parsedPreview.settings ? 'Included & Verified' : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                <p className="text-[11px] text-stone-500 font-mono">
                  * Restores into live storage and syncs across all tabs & collections
                </p>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importing || !parsedPreview}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Restoring Data...</span>
                      </>
                    ) : (
                      <>
                        <HardDriveUpload className="w-4 h-4" />
                        <span>Confirm & Restore</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Protected Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-stone-900 font-mono flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>အက်ဒမင် လျှို့ဝှက်နံပါတ် ဖြည့်သွင်းပါ</span>
              </h3>
              <button onClick={() => setShowResetModal(false)} className="text-stone-400 hover:text-stone-700 cursor-pointer">✕</button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              <strong>Reset to Zero (0 မှ ပြန်စခြင်း):</strong> ဘိုကင် သမိုင်းကြောင်းများ၊ အသိပေးချက် မှတ်တမ်းများနှင့် ဒီဇိုင်နာ အချက်အလက်များ (Symbol Designer Details) အားလုံးကို 0 သို့ လုံးဝ ဖျက်ပစ်မည် ဖြစ်ပါသည်။
            </p>

            {resetError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetToZeroSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Admin Reset Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={resetPasswordInput}
                    onChange={(e) => {
                      setResetPasswordInput(e.target.value);
                      setResetError('');
                    }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500 font-mono focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="submit"
                    disabled={loading || !resetPasswordInput}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-xs transition-all disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'ဒေတာများ 0 မှ ပြန်စမည်'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetSeedSubmit}
                    disabled={loading || !resetPasswordInput}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'မူလ စတိုး အတိုင်း ပြောင်းမည်'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePurgeOldClientsSubmit}
                  disabled={loading || !resetPasswordInput}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-xs transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{loading ? 'Purging...' : 'Client ဒေတာ အဟောင်းများနှင့် Notifications အားလုံး ရှင်းထုတ်မည်'}</span>
                </button>
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                >
                  မလုပ်တော့ပါ (Cancel)
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
