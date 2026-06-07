'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRbac } from '@/lib/rbac';
import { authFetch } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import { BookOpen, RefreshCw, Download, Plus, PlusCircle, Edit2, BookX, CheckCircle, AlertTriangle, Clock, Upload } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Book {
  id: number;
  title: string;
  author: string;
  isbn?: string;
  subject?: string;
  genre?: string;
  publisher?: string;
  mrp?: number;
  edition?: string;
  language?: string;
  shelfLocation?: string;
  totalCopies: number;
  availableCopies: number;
  coverImageUrl?: string;
  description?: string;
  isActive: boolean;
  discardReason?: string;
  discardNote?: string;
}

interface Issuance {
  id: number;
  bookId: number;
  book?: Book;
  borrowerType: 'STUDENT' | 'STAFF';
  studentId?: number;
  staffId?: number;
  student?: { id: number; user?: { firstName: string; lastName: string }; firstName?: string; lastName?: string };
  staff?: { id: number; user?: { firstName: string; lastName: string }; firstName?: string; lastName?: string };
  issuedById: number;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'ISSUED' | 'RETURNED' | 'OVERDUE';
  returnCondition?: string;
  damageNote?: string;
  lateFeePayment?: {
    lateFeeCharged: number;
    amountPaid: number;
    amountWaived: number;
    paymentMethod?: string;
    collectedAt?: string;
  };
}

interface LibrarySettings {
  defaultLoanDays: number;
  maxLoanDays: number;
  maxBooksPerBorrower: number;
  lateFeePerDay: number;
  allowRenewal: boolean;
}

interface Pagination<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface StudentOption { id: number; firstName: string; lastName: string; rollNumber?: string; }
interface StaffOption { id: number; firstName: string; lastName: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTs = (d: string | Date) =>
  new Date(d).toISOString().replace('T', ' ').substring(0, 19);

const fmtDate = (d: string) => d?.substring(0, 10) ?? '';

const getBorrowerName = (i: Issuance): string => {
  if (i.borrowerType === 'STUDENT') {
    if (!i.student) return `Student #${i.studentId}`;
    const u = i.student.user;
    const name = `${u?.firstName ?? i.student.firstName ?? ''} ${u?.lastName ?? i.student.lastName ?? ''}`.trim();
    return name || `Student #${i.studentId}`;
  }
  if (!i.staff) return `Staff #${i.staffId}`;
  const u = i.staff.user;
  const name = `${u?.firstName ?? i.staff.firstName ?? ''} ${u?.lastName ?? i.staff.lastName ?? ''}`.trim();
  return name || `Staff #${i.staffId}`;
};

const statusBadge = (issuance: Issuance) => {
  if (issuance.status === 'RETURNED')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Returned</span>;
  const today = new Date().toISOString().substring(0, 10);
  if (issuance.dueDate < today || issuance.status === 'OVERDUE')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Overdue</span>;
  if (issuance.dueDate === today)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Due Today</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Active</span>;
};

const TAB_LABELS = ['My Books', 'Books', 'Issue / Return', 'Reports', 'Settings'] as const;
type Tab = typeof TAB_LABELS[number];

// ── Sub-components ─────────────────────────────────────────────────────────────

function PaginationBar({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} className="px-2 py-1 rounded text-sm border disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">‹</button>
      {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onChange(p)} className={`px-2.5 py-1 rounded text-sm border ${p === page ? 'bg-lime-600 text-white border-lime-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{p}</button>
      ))}
      <button disabled={page === pages} onClick={() => onChange(page + 1)} className="px-2 py-1 rounded text-sm border disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">›</button>
    </div>
  );
}

// ── My Books Tab ───────────────────────────────────────────────────────────────

function MyBooksTab() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Pagination<Issuance> | null>(null);
  const [loading, setLoading] = useState(false);
  const LIMIT = 5;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/library/issuances/me?page=${p}&limit=${LIMIT}`);
      if (!res.ok) throw new Error('Failed to load');
      setResult(await res.json());
    } catch {
      toast.error('Could not load your borrowed books');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">My Borrowed Books</h2>
      {!result || result.data.length === 0 ? (
        <p className="text-slate-500 text-sm">You have no borrowed books.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Book</th>
                  <th className="pb-2 pr-4">Issued</th>
                  <th className="pb-2 pr-4">Due</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Late Fee Paid</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map(i => (
                  <tr key={i.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 font-medium">{i.book?.title ?? `Book #${i.bookId}`}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-500">{fmtTs(i.issueDate)}</td>
                    <td className="py-2 pr-4 text-xs">{fmtDate(i.dueDate)}</td>
                    <td className="py-2 pr-4">{statusBadge(i)}</td>
                    <td className="py-2 text-xs">
                      {i.lateFeePayment ? `₹${i.lateFeePayment.amountPaid}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={result.page} total={result.total} limit={LIMIT} onChange={(p) => { setPage(p); load(p); }} />
        </>
      )}
    </div>
  );
}

// ── Books Tab ──────────────────────────────────────────────────────────────────

function BooksTab() {
  const [books, setBooks] = useState<Pagination<Book> | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ title: '', author: '', isbn: '', publisher: '' });
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [discardBook, setDiscardBook] = useState<Book | null>(null);
  const [increaseCopiesBook, setIncreaseCopiesBook] = useState<Book | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ successful: number; failed: number; errors: string[] } | null>(null);
  const LIMIT = 20;

  const load = useCallback(async (p: number, f = filters) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (f.title) q.set('title', f.title);
      if (f.author) q.set('author', f.author);
      if (f.isbn) q.set('isbn', f.isbn);
      if (f.publisher) q.set('publisher', f.publisher);
      const res = await authFetch(`${API_BASE_URL}/library/books?${q}`);
      if (!res.ok) throw new Error();
      setBooks(await res.json());
    } catch {
      toast.error('Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(1); }, []);

  const handleSearch = () => { setPage(1); load(1); };

  const downloadCsv = async () => {
    const q = new URLSearchParams({ export: 'csv', limit: '10000' });
    if (filters.title) q.set('title', filters.title);
    if (filters.author) q.set('author', filters.author);
    const res = await authFetch(`${API_BASE_URL}/library/books?${q}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'books.csv'; a.click();
  };

  const downloadTemplate = async () => {
    const res = await authFetch(`${API_BASE_URL}/library/books/bulk-import/template`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'books-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkFile(null);
    setBulkResult(null);
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append('file', bulkFile);
      const res = await authFetch(`${API_BASE_URL}/library/books/bulk-import`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || 'Failed to upload');
        return;
      }
      const result = await res.json();
      setBulkResult(result);
      if (result.successful > 0 && result.failed === 0) {
        toast.success(`Successfully imported ${result.successful} books`);
        load(1);
        setTimeout(closeBulkModal, 2000);
      } else if (result.successful > 0) {
        toast.success(`Partially imported ${result.successful} books. Check errors.`);
        load(1);
      }
    } catch {
      toast.error('An error occurred during bulk import');
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['title', 'author', 'isbn', 'publisher'] as const).map(k => (
          <input key={k} placeholder={k.charAt(0).toUpperCase() + k.slice(1)} value={filters[k]}
            onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="border rounded px-3 py-1.5 text-sm w-36 dark:bg-slate-800 dark:border-slate-600" />
        ))}
        <button onClick={handleSearch} className="px-3 py-1.5 rounded bg-lime-600 text-white text-sm hover:bg-lime-700">Search</button>
        <button onClick={downloadCsv} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700">
          <Upload className="w-3.5 h-3.5" /> Bulk Upload
        </button>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 text-white text-sm hover:bg-slate-700 ml-auto">
          <Plus className="w-3.5 h-3.5" /> Add Book
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Title</th>
                  <th className="pb-2 pr-3">Author</th>
                  <th className="pb-2 pr-3">ISBN</th>
                  <th className="pb-2 pr-3">Copies</th>
                  <th className="pb-2 pr-3">Available</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {books?.data.map(b => (
                  <tr key={b.id} className="border-b last:border-0 align-middle">
                    <td className="py-2 pr-3 font-medium">{b.title}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{b.author}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{b.isbn ?? '—'}</td>
                    <td className="py-2 pr-3">{b.totalCopies}</td>
                    <td className="py-2 pr-3">
                      <span className={b.availableCopies === 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>{b.availableCopies}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {b.isActive
                        ? <span className="text-xs text-green-600">Active</span>
                        : <span className="text-xs text-slate-400">Discarded</span>}
                    </td>
                    <td className="py-2 flex gap-2">
                      <button onClick={() => setEditBook(b)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      {b.isActive && (
                        <button onClick={() => setIncreaseCopiesBook(b)} className="p-1 rounded hover:bg-lime-50 dark:hover:bg-lime-900/30 text-lime-600" title="Increase copies"><PlusCircle className="w-4 h-4" /></button>
                      )}
                      {b.isActive && (
                        <button onClick={() => setDiscardBook(b)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500" title="Discard copies"><BookX className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {books && <PaginationBar page={books.page} total={books.total} limit={LIMIT} onChange={(p) => { setPage(p); load(p); }} />}
        </>
      )}

      {(showAddModal || editBook) && (
        <BookFormModal
          book={editBook}
          onClose={() => { setShowAddModal(false); setEditBook(null); }}
          onSaved={() => { setShowAddModal(false); setEditBook(null); load(page); }}
        />
      )}
      {discardBook && (
        <DiscardModal
          book={discardBook}
          onClose={() => setDiscardBook(null)}
          onDiscarded={() => { setDiscardBook(null); load(page); }}
        />
      )}
      {increaseCopiesBook && (
        <IncreaseCopiesModal
          book={increaseCopiesBook}
          onClose={() => setIncreaseCopiesBook(null)}
          onSaved={() => { setIncreaseCopiesBook(null); load(page); }}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h3 className="text-lg font-semibold">Bulk Import Books</h3>
              <button onClick={closeBulkModal} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg w-8 h-8 inline-flex justify-center items-center">
                <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="mb-4 text-sm text-slate-600 dark:text-slate-300 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="font-semibold mb-2">CSV Format Requirements:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li><span className="font-semibold text-red-600">Required:</span> title, author</li>
                  <li><span className="font-semibold">Optional:</span> isbn, subject, genre, publisher, mrp, edition, language, shelfLocation, totalCopies, description</li>
                  <li>All column headers must be present (leave optional fields empty)</li>
                  <li><span className="font-semibold">totalCopies:</span> whole number, defaults to 1 if empty</li>
                  <li><span className="font-semibold">mrp:</span> decimal number e.g. 250.00</li>
                </ul>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline font-medium"
                >
                  <Download className="w-3 h-3" /> Download CSV Template
                </button>
              </div>

              <form onSubmit={handleBulkUpload}>
                <label className="block mb-2 text-sm font-medium">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); }}
                  className="block w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800 p-2 mb-4"
                  required
                />

                {bulkResult && (
                  <div className={`p-4 mb-4 text-sm rounded-lg border ${bulkResult.failed > 0 ? 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300' : 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300'}`}>
                    <p className="font-bold mb-2">Import Results:</p>
                    <p>✅ {bulkResult.successful} books successfully imported.</p>
                    {bulkResult.failed > 0 && <p>❌ {bulkResult.failed} failed.</p>}
                    {bulkResult.errors.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto text-xs bg-white dark:bg-slate-800 p-2 rounded border border-orange-100">
                        {bulkResult.errors.map((err, i) => (
                          <div key={i} className="mb-1 text-red-600 dark:text-red-400 font-mono">{err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={closeBulkModal} className="px-4 py-2 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Close</button>
                  <button type="submit" disabled={!bulkFile || bulkUploading} className="px-4 py-2 rounded bg-lime-600 text-white text-sm hover:bg-lime-700 disabled:opacity-50">
                    {bulkUploading ? 'Importing…' : 'Upload & Import'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Book Form Modal ────────────────────────────────────────────────────────────

function BookFormModal({ book, onClose, onSaved }: { book: Book | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!book;
  const [form, setForm] = useState({
    title: book?.title ?? '',
    author: book?.author ?? '',
    isbn: book?.isbn ?? '',
    subject: book?.subject ?? '',
    genre: book?.genre ?? '',
    publisher: book?.publisher ?? '',
    mrp: book?.mrp != null ? String(book.mrp) : '',
    edition: book?.edition ?? '',
    language: book?.language ?? '',
    shelfLocation: book?.shelfLocation ?? '',
    totalCopies: book?.totalCopies != null ? String(book.totalCopies) : '1',
    description: book?.description ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        author: form.author,
      };
      if (form.isbn) body.isbn = form.isbn;
      if (form.subject) body.subject = form.subject;
      if (form.genre) body.genre = form.genre;
      if (form.publisher) body.publisher = form.publisher;
      if (form.mrp) body.mrp = parseFloat(form.mrp);
      if (form.edition) body.edition = form.edition;
      if (form.language) body.language = form.language;
      if (form.shelfLocation) body.shelfLocation = form.shelfLocation;
      // totalCopies only on create; use the increase-copies button to add more
      if (!isEdit && form.totalCopies) body.totalCopies = parseInt(form.totalCopies);
      if (form.description) body.description = form.description;

      const url = isEdit ? `${API_BASE_URL}/library/books/${book.id}` : `${API_BASE_URL}/library/books`;
      const res = await authFetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Failed'); }
      toast.success(isEdit ? 'Book updated' : 'Book added');
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? 'Error saving book');
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <input type={type} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        className="w-full border rounded px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Edit Book' : 'Add Book'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{field('title', 'Title *')}</div>
          <div className="col-span-2">{field('author', 'Author *')}</div>
          {field('isbn', 'ISBN')}
          {field('publisher', 'Publisher')}
          {field('subject', 'Subject')}
          {field('genre', 'Genre')}
          {field('mrp', 'MRP (₹)', 'number')}
          {field('edition', 'Edition')}
          {field('language', 'Language')}
          {field('shelfLocation', 'Shelf Location')}
          {!isEdit && field('totalCopies', 'Total Copies', 'number')}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full border rounded px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
          </div>
          <div className="col-span-2 flex gap-2 justify-end mt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={saving || !form.title || !form.author} className="px-4 py-1.5 rounded bg-lime-600 text-white text-sm hover:bg-lime-700 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Increase Copies Modal ──────────────────────────────────────────────────────

function IncreaseCopiesModal({ book, onClose, onSaved }: { book: Book; onClose: () => void; onSaved: () => void }) {
  const [additionalCopies, setAdditionalCopies] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(additionalCopies);
    if (!n || n < 1) { toast.error('Enter a valid number of copies (min 1)'); return; }
    if (!confirmed) { setConfirmed(true); return; }
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/library/books/${book.id}/increase-copies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalCopies: n }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Failed'); }
      toast.success(`Added ${n} ${n === 1 ? 'copy' : 'copies'} to "${book.title}"`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? 'Error increasing copies');
    } finally {
      setSaving(false);
    }
  };

  const n = parseInt(additionalCopies) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-1">Increase Copies</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          <span className="font-medium text-slate-700 dark:text-slate-200">{book.title}</span>
          <br />Current: {book.totalCopies} total · {book.availableCopies} available
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Copies to Add</label>
            <input
              type="number" min={1} value={additionalCopies}
              onChange={e => { setAdditionalCopies(e.target.value); setConfirmed(false); }}
              className="w-full border rounded px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600"
            />
          </div>

          {confirmed && n > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                You are about to permanently add <strong>{n}</strong> {n === 1 ? 'copy' : 'copies'} to this book.
                Copies can only be reduced by discarding the book.
                Click <strong>Confirm</strong> to proceed.
              </span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={saving || !n || n < 1}
              className={`px-4 py-1.5 rounded text-white text-sm disabled:opacity-50 ${confirmed ? 'bg-amber-600 hover:bg-amber-700' : 'bg-lime-600 hover:bg-lime-700'}`}>
              {saving ? 'Saving…' : confirmed ? 'Confirm' : 'Add Copies'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Discard Modal ──────────────────────────────────────────────────────────────

function DiscardModal({ book, onClose, onDiscarded }: { book: Book; onClose: () => void; onDiscarded: () => void }) {
  const [reason, setReason] = useState<'BOOK_LOST' | 'BOOK_DAMAGED' | 'OTHER'>('BOOK_DAMAGED');
  const [note, setNote] = useState('');
  const [discardMode, setDiscardMode] = useState<'partial' | 'all'>('partial');
  const [copiesToDiscard, setCopiesToDiscard] = useState('1');
  const [saving, setSaving] = useState(false);

  const copies = parseInt(copiesToDiscard) || 0;
  const isAll = discardMode === 'all';
  const effectiveCopies = isAll ? book.availableCopies : copies;
  const isFullDiscard = effectiveCopies >= book.availableCopies && book.availableCopies > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason === 'OTHER' && !note.trim()) { toast.error('Please provide a note'); return; }
    if (!isAll && (copies < 1 || copies > book.availableCopies)) {
      toast.error(`Enter a number between 1 and ${book.availableCopies}`);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        discardReason: reason,
        ...(note.trim() ? { discardNote: note } : {}),
        copiesToDiscard: effectiveCopies,
      };
      const res = await authFetch(`${API_BASE_URL}/library/books/${book.id}/discard`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Failed'); }
      toast.success(isFullDiscard ? 'Book fully discarded' : `${effectiveCopies} ${effectiveCopies === 1 ? 'copy' : 'copies'} discarded`);
      onDiscarded();
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setSaving(false);
    }
  };

  const reasonConfig = {
    BOOK_LOST:    { icon: '🔍', label: 'Lost',    color: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
    BOOK_DAMAGED: { icon: '💔', label: 'Damaged', color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
    OTHER:        { icon: '📋', label: 'Other',   color: 'border-slate-400 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BookX className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight">Discard Copies</h3>
              <p className="text-red-100 text-xs truncate mt-0.5">"{book.title}" · {book.availableCopies} available of {book.totalCopies} total</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Reason selector — icon cards */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Reason</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(reasonConfig) as [keyof typeof reasonConfig, typeof reasonConfig[keyof typeof reasonConfig]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReason(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all ${reason === key ? cfg.color + ' border-current' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}
                >
                  <span className="text-xl leading-none">{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {reason === 'OTHER' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Note <span className="text-red-500">*</span></label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Describe the reason…"
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
          )}

          {/* Quantity selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Copies to Discard</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => setDiscardMode('partial')}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${discardMode === 'partial' ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                Specific number
              </button>
              <button type="button" onClick={() => setDiscardMode('all')}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${discardMode === 'all' ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                All available ({book.availableCopies})
              </button>
            </div>
            {discardMode === 'partial' && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCopiesToDiscard(v => String(Math.max(1, (parseInt(v) || 1) - 1)))}
                  className="w-9 h-9 rounded-lg border flex items-center justify-center text-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">−</button>
                <input type="number" min={1} max={book.availableCopies} value={copiesToDiscard}
                  onChange={e => setCopiesToDiscard(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm text-center dark:bg-slate-800 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-400" />
                <button type="button" onClick={() => setCopiesToDiscard(v => String(Math.min(book.availableCopies, (parseInt(v) || 0) + 1)))}
                  className="w-9 h-9 rounded-lg border flex items-center justify-center text-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">+</button>
              </div>
            )}
          </div>

          {/* Warning for full discard */}
          {isFullDiscard && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>This will <strong>fully discard</strong> the book record — it will be permanently marked inactive and removed from circulation.</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || (!isAll && (copies < 1 || copies > book.availableCopies))}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-semibold hover:from-red-600 hover:to-rose-700 disabled:opacity-50 transition-all shadow-sm shadow-red-500/20">
              {saving ? 'Discarding…' : isFullDiscard ? '⚠️ Discard All' : `Discard ${effectiveCopies || '—'} ${effectiveCopies === 1 ? 'Copy' : 'Copies'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Issue / Return Tab ─────────────────────────────────────────────────────────

function IssueReturnTab() {
  const [subTab, setSubTab] = useState<'issue' | 'active'>('issue');
  const [settings, setSettings] = useState<LibrarySettings | null>(null);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/library/settings`).then(r => r.json()).then(setSettings).catch(() => {});
  }, []);

  const onIssued = () => setSubTab('active');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {([['issue', 'Issue Book'], ['active', 'Active Issuances']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === 'issue' && (
        <IssueBookPanel settings={settings} onIssued={onIssued} />
      )}
      {subTab === 'active' && (
        <ActiveIssuancesPanel refreshKey={subTab} />
      )}
    </div>
  );
}

function IssueBookPanel({ settings, onIssued }: { settings: LibrarySettings | null; onIssued: () => void }) {
  const [bookQuery, setBookQuery] = useState('');
  const [bookSuggestions, setBookSuggestions] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [borrowerType, setBorrowerType] = useState<'STUDENT' | 'STAFF'>('STUDENT');
  const [borrowerQuery, setBorrowerQuery] = useState('');
  const [borrowerSuggestions, setBorrowerSuggestions] = useState<(StudentOption | StaffOption)[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<StudentOption | StaffOption | null>(null);
  const [loanDays, setLoanDays] = useState(0);
  const [issuing, setIssuing] = useState(false);

  const bookDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borrowerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settings && loanDays === 0) setLoanDays(settings.defaultLoanDays);
  }, [settings]);

  const onBookQueryChange = (v: string) => {
    setBookQuery(v); setSelectedBook(null);
    if (bookDebounce.current) clearTimeout(bookDebounce.current);
    if (!v.trim()) { setBookSuggestions([]); return; }
    bookDebounce.current = setTimeout(async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/library/books?title=${encodeURIComponent(v)}&limit=8`);
        const data: Pagination<Book> = await res.json();
        setBookSuggestions(data.data.filter(b => b.isActive && b.availableCopies > 0));
      } catch { /**/ }
    }, 300);
  };

  const onBorrowerQueryChange = (v: string) => {
    setBorrowerQuery(v); setSelectedBorrower(null);
    if (borrowerDebounce.current) clearTimeout(borrowerDebounce.current);
    if (!v.trim()) { setBorrowerSuggestions([]); return; }
    borrowerDebounce.current = setTimeout(async () => {
      try {
        const endpoint = borrowerType === 'STUDENT'
          ? `${API_BASE_URL}/students?search=${encodeURIComponent(v)}&limit=8`
          : `${API_BASE_URL}/staff?search=${encodeURIComponent(v)}&limit=8`;
        const res = await authFetch(endpoint);
        const data = await res.json();
        setBorrowerSuggestions(data.data ?? data ?? []);
      } catch { /**/ }
    }, 300);
  };

  const dueDate = loanDays > 0
    ? new Date(Date.now() + loanDays * 86400000).toISOString().substring(0, 10)
    : '';

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !selectedBorrower) { toast.error('Select a book and borrower'); return; }
    setIssuing(true);
    try {
      const body: Record<string, unknown> = { bookId: selectedBook.id, borrowerType };
      if (borrowerType === 'STUDENT') body.studentId = selectedBorrower.id;
      else body.staffId = selectedBorrower.id;
      if (loanDays > 0) {
        if (settings && loanDays > settings.maxLoanDays) {
          toast.error(`Loan period cannot exceed ${settings.maxLoanDays} days`);
          setIssuing(false); return;
        }
        body.dueDate = dueDate;
      }
      const res = await authFetch(`${API_BASE_URL}/library/issuances`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Failed'); }
      const borrowerName = `${selectedBorrower.firstName} ${selectedBorrower.lastName}`;
      toast.success(`📗 "${selectedBook.title}" issued to ${borrowerName} — due ${dueDate || 'per default'}`);
      setSelectedBook(null); setBookQuery(''); setSelectedBorrower(null); setBorrowerQuery('');
      setLoanDays(settings?.defaultLoanDays ?? 14);
      onIssued();
    } catch (err: any) {
      toast.error(err.message ?? 'Error issuing book');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 dark:border-slate-700">
      <form onSubmit={handleIssue} className="space-y-3">
        {/* Book search */}
        <div className="relative">
          <label className="block text-xs font-medium mb-1">Book</label>
          <input value={selectedBook ? selectedBook.title : bookQuery}
            onChange={e => onBookQueryChange(e.target.value)}
            placeholder="Search by title…"
            className="w-full border rounded px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
          {bookSuggestions.length > 0 && !selectedBook && (
            <ul className="absolute z-10 left-0 right-0 mt-0.5 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {bookSuggestions.map(b => (
                <li key={b.id} onClick={() => { setSelectedBook(b); setBookSuggestions([]); }}
                  className="px-3 py-2 cursor-pointer hover:bg-lime-50 dark:hover:bg-slate-700 text-sm flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{b.title}</span>
                    <span className="text-slate-400 text-xs ml-1">by {b.author}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    b.availableCopies <= 2
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300'
                  }`}>{b.availableCopies} avail</span>
                </li>
              ))}
            </ul>
          )}
          {selectedBook && (
            <div className="mt-1.5 flex items-center gap-3 px-3 py-2 bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-lime-800 dark:text-lime-300 truncate">{selectedBook.title}</p>
                <p className="text-xs text-slate-500 truncate">by {selectedBook.author}{selectedBook.isbn ? ` · ISBN: ${selectedBook.isbn}` : ''}</p>
              </div>
              <div className={`shrink-0 text-right ${selectedBook.availableCopies <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-lime-700 dark:text-lime-400'}`}>
                <p className="text-lg font-bold leading-none">{selectedBook.availableCopies}</p>
                <p className="text-xs text-slate-500">of {selectedBook.totalCopies} avail</p>
              </div>
            </div>
          )}
        </div>

        {/* Borrower type */}
        <div className="flex gap-4">
          {(['STUDENT', 'STAFF'] as const).map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" checked={borrowerType === t} onChange={() => { setBorrowerType(t); setSelectedBorrower(null); setBorrowerQuery(''); setBorrowerSuggestions([]); }} />
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </label>
          ))}
        </div>

        {/* Borrower search */}
        <div className="relative">
          <label className="block text-xs font-medium mb-1">Borrower</label>
          <input value={selectedBorrower ? `${selectedBorrower.firstName} ${selectedBorrower.lastName}` : borrowerQuery}
            onChange={e => onBorrowerQueryChange(e.target.value)}
            placeholder={`Search ${borrowerType.toLowerCase()} name…`}
            className="w-full border rounded px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
          {borrowerSuggestions.length > 0 && !selectedBorrower && (
            <ul className="absolute z-10 left-0 right-0 mt-0.5 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {borrowerSuggestions.map(s => (
                <li key={s.id} onClick={() => { setSelectedBorrower(s); setBorrowerSuggestions([]); }}
                  className="px-3 py-2 cursor-pointer hover:bg-lime-50 dark:hover:bg-slate-700 text-sm">
                  {s.firstName} {s.lastName}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Issue date + loan days */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Issue Date</label>
            <input value={new Date().toISOString().substring(0, 10)} readOnly
              className="w-full border rounded px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 dark:border-slate-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Issue For (days)
              {settings && <span className="text-slate-400 ml-1">· max {settings.maxLoanDays}d</span>}
            </label>
            <div className="flex gap-1.5 mb-1.5 flex-wrap">
              {[7, 14, 21, 30].map(d => (
                <button key={d} type="button" onClick={() => setLoanDays(d)}
                  className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${
                    loanDays === d
                      ? 'bg-lime-600 text-white border-lime-600'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-lime-400'
                  }`}>{d}d</button>
              ))}
            </div>
            <input type="number" min={1} max={settings?.maxLoanDays ?? 365} value={loanDays || ''}
              onChange={e => setLoanDays(Math.max(1, Number(e.target.value)))}
              placeholder="Custom days…"
              className="w-full border rounded px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
            {dueDate && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Due: <span className="font-medium text-slate-700 dark:text-slate-200">{dueDate}</span>
              </p>
            )}
          </div>
        </div>

        <button type="submit" disabled={issuing || !selectedBook || !selectedBorrower}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-lime-600 text-white text-sm font-medium hover:bg-lime-700 disabled:opacity-50 transition-colors">
          {issuing ? 'Issuing…' : '📗 Issue Book'}
        </button>
      </form>
    </div>
  );
}

function ActiveIssuancesPanel({ refreshKey }: { refreshKey: string }) {
  const [issuances, setIssuances] = useState<Pagination<Issuance> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [returnIssuance, setReturnIssuance] = useState<Issuance | null>(null);

  // Separate filter states
  const [filterBook, setFilterBook] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterMobile, setFilterMobile] = useState('');
  const [dueEnabled, setDueEnabled] = useState(false);
  const [dueFilter, setDueFilter] = useState(new Date().toISOString().substring(0, 10));
  const [statusFilter, setStatusFilter] = useState<'ISSUED' | 'OVERDUE' | ''>('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (
    p: number,
    opts?: {
      book?: string; student?: string; staff?: string; mobile?: string;
      dueOn?: string; dueOn_enabled?: boolean; status?: '' | 'ISSUED' | 'OVERDUE';
    },
  ) => {
    const book    = opts?.book    ?? filterBook;
    const student = opts?.student ?? filterStudent;
    const staff   = opts?.staff   ?? filterStaff;
    const mobile  = opts?.mobile  ?? filterMobile;
    const dueOn   = opts?.dueOn   ?? dueFilter;
    const useDue  = opts?.dueOn_enabled ?? dueEnabled;
    const status  = opts?.status  ?? statusFilter;

    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: '20' });
      if (book.trim())    q.set('bookTitle', book.trim());
      if (student.trim()) q.set('studentName', student.trim());
      if (staff.trim())   q.set('staffName', staff.trim());
      if (mobile.trim())  q.set('mobile', mobile.trim());
      if (useDue && dueOn) q.set('dueDate', dueOn);
      if (status) q.set('status', status);
      else q.set('status', 'ISSUED,OVERDUE');
      const res = await authFetch(`${API_BASE_URL}/library/issuances?${q}`);
      if (!res.ok) throw new Error();
      setIssuances(await res.json());
    } catch {
      toast.error('Failed to load issuances');
    } finally {
      setLoading(false);
    }
  }, [filterBook, filterStudent, filterStaff, filterMobile, dueFilter, dueEnabled, statusFilter]);

  useEffect(() => { load(1); }, [refreshKey]);

  const triggerSearch = (overrides?: Parameters<typeof load>[1]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1, overrides); }, 350);
  };

  const handleFilterChange = (
    field: 'book' | 'student' | 'staff' | 'mobile',
    value: string,
  ) => {
    if (field === 'book')    setFilterBook(value);
    if (field === 'student') setFilterStudent(value);
    if (field === 'staff')   setFilterStaff(value);
    if (field === 'mobile')  setFilterMobile(value);
    triggerSearch({ [field]: value });
  };

  const handleDueToggle = (checked: boolean) => {
    setDueEnabled(checked);
    setPage(1);
    load(1, { dueOn_enabled: checked });
  };

  const handleDueDateChange = (val: string) => {
    setDueFilter(val);
    if (dueEnabled) { setPage(1); load(1, { dueOn: val }); }
  };

  const handleStatusChange = (val: '' | 'ISSUED' | 'OVERDUE') => {
    setStatusFilter(val);
    setPage(1);
    load(1, { status: val });
  };

  return (
    <div className="space-y-3">
      {/* Filter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Book Name</label>
          <input
            value={filterBook}
            onChange={e => handleFilterChange('book', e.target.value)}
            placeholder="Search by book title…"
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Student Name</label>
          <input
            value={filterStudent}
            onChange={e => handleFilterChange('student', e.target.value)}
            placeholder="Search by student name…"
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Staff Name</label>
          <input
            value={filterStaff}
            onChange={e => handleFilterChange('staff', e.target.value)}
            placeholder="Search by staff name…"
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Mobile Number</label>
          <input
            value={filterMobile}
            onChange={e => handleFilterChange('mobile', e.target.value)}
            placeholder="Search by mobile…"
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600"
          />
        </div>
      </div>

      {/* Due date + status row */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Due On toggle + date */}
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dueEnabled}
              onChange={e => handleDueToggle(e.target.checked)}
              className="accent-lime-600 w-3.5 h-3.5"
            />
            Due On (on or before)
          </label>
          <input
            type="date"
            value={dueFilter}
            onChange={e => handleDueDateChange(e.target.value)}
            disabled={!dueEnabled}
            title={dueEnabled ? 'Filter by due date (on or before)' : 'Enable checkbox to activate due date filter'}
            className={`border rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600 transition-opacity ${dueEnabled ? 'opacity-100' : 'opacity-40 cursor-not-allowed'}`}
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
          <select
            value={statusFilter}
            onChange={e => handleStatusChange(e.target.value as '' | 'ISSUED' | 'OVERDUE')}
            className="border rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600"
          >
            <option value="">All active</option>
            <option value="ISSUED">Issued</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={() => { setPage(1); load(1); }}
          className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors self-end"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Book</th>
                  <th className="pb-2 pr-3">Borrower</th>
                  <th className="pb-2 pr-3">Issued</th>
                  <th className="pb-2 pr-3">Due</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {issuances?.data.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No issuances found</td></tr>
                )}
                {issuances?.data.map(i => {
                  const isOverdue = i.status === 'OVERDUE' || i.dueDate < new Date().toISOString().substring(0, 10);
                  return (
                    <tr key={i.id} className={`border-b last:border-0 align-middle ${isOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="py-2 pr-3 font-medium">{i.book?.title ?? `#${i.bookId}`}</td>
                      <td className="py-2 pr-3">{getBorrowerName(i)}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{fmtTs(i.issueDate)}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDate(i.dueDate)}</td>
                      <td className="py-2 pr-3">{statusBadge(i)}</td>
                      <td className="py-2">
                        <button onClick={() => setReturnIssuance(i)}
                          className="px-2.5 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-700">
                          Return
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {issuances && <PaginationBar page={issuances.page} total={issuances.total} limit={20} onChange={(p) => { setPage(p); load(p); }} />}
        </>
      )}

      {returnIssuance && (
        <ReturnModal
          issuance={returnIssuance}
          onClose={() => setReturnIssuance(null)}
          onReturned={() => {
            setReturnIssuance(null);
            load(page);
          }}
        />
      )}
    </div>
  );
}

// ── Return Modal ───────────────────────────────────────────────────────────────

function ReturnModal({ issuance, onClose, onReturned }: { issuance: Issuance; onClose: () => void; onReturned: () => void }) {
  const [lateFeeInfo, setLateFeeInfo] = useState<{ lateFeeCharged: number; daysOverdue: number } | null>(null);
  const [feeMode, setFeeMode] = useState<'collect' | 'waive' | 'partial'>('collect');
  const [amountPaid, setAmountPaid] = useState('');
  const [amountWaived, setAmountWaived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [waiveReason, setWaiveReason] = useState('');
  const [returnCondition, setReturnCondition] = useState<'GOOD' | 'DAMAGED' | 'LOST'>('GOOD');
  const [damageNote, setDamageNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/library/issuances/${issuance.id}/late-fee`)
      .then(r => r.json()).then(setLateFeeInfo).catch(() => {});
  }, [issuance.id]);

  const fee = lateFeeInfo?.lateFeeCharged ?? 0;

  // Sync fee mode into paid/waived amounts
  useEffect(() => {
    if (!lateFeeInfo) return;
    if (feeMode === 'collect') { setAmountPaid(String(fee)); setAmountWaived('0'); }
    else if (feeMode === 'waive') { setAmountPaid('0'); setAmountWaived(String(fee)); }
    else { setAmountPaid(''); setAmountWaived(''); }
  }, [feeMode, fee, lateFeeInfo]);

  const paid = parseFloat(amountPaid || '0');
  const waived = parseFloat(amountWaived || '0');
  const splitOk = fee === 0 || Math.round((paid + waived) * 100) === Math.round(fee * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitOk) { toast.error(`Paid + Waived must equal ₹${fee}`); return; }
    if (fee > 0 && paid > 0 && !paymentMethod) { toast.error('Select payment method'); return; }
    if (fee > 0 && waived > 0 && !waiveReason.trim()) { toast.error('Provide waiver reason'); return; }
    if ((returnCondition === 'DAMAGED' || returnCondition === 'LOST') && !damageNote.trim()) { toast.error('Provide damage/loss note'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { returnCondition };
      if (damageNote) body.damageNote = damageNote;
      if (fee > 0) {
        body.amountPaid = paid;
        body.amountWaived = waived;
        if (paid > 0) body.paymentMethod = paymentMethod;
        if (waived > 0) body.waiveReason = waiveReason;
      }
      const res = await authFetch(`${API_BASE_URL}/library/issuances/${issuance.id}/return`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Failed'); }
      toast.success('Book returned successfully');
      onReturned();
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-semibold mb-3">Return Book</h3>

        {/* Info summary */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm space-y-1 mb-4">
          <div><span className="font-medium">Book:</span> {issuance.book?.title ?? `#${issuance.bookId}`}</div>
          <div><span className="font-medium">Issued:</span> {fmtTs(issuance.issueDate)}</div>
          <div><span className="font-medium">Due:</span> {fmtDate(issuance.dueDate)}</div>
          {lateFeeInfo && lateFeeInfo.daysOverdue > 0 && (
            <div className="text-red-600"><span className="font-medium">Days Overdue:</span> {lateFeeInfo.daysOverdue}</div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Late fee section */}
          {lateFeeInfo === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /> Calculating fee…</div>
          ) : fee === 0 ? (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg px-3 py-2 text-sm">
              <CheckCircle className="w-4 h-4" /> No late fee applicable
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2 text-sm">
                <AlertTriangle className="w-4 h-4" /> Late fee: <span className="font-semibold">₹{fee}</span>
              </div>
              {/* Fee mode radio */}
              <div className="space-y-1">
                {([['collect', 'Collect Full', `Pay ₹${fee}`], ['waive', 'Waive All', 'Waive entire fee'], ['partial', 'Partial', 'Custom split']] as const).map(([v, lbl, sub]) => (
                  <label key={v} className="flex items-start gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={feeMode === v} onChange={() => setFeeMode(v)} className="mt-0.5" />
                    <span><span className="font-medium">{lbl}</span> <span className="text-slate-400 text-xs">— {sub}</span></span>
                  </label>
                ))}
              </div>
              {/* Amount inputs for partial */}
              {feeMode === 'partial' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Amount Paid (₹)</label>
                    <input type="number" min="0" max={fee} step="0.01" value={amountPaid} onChange={e => { setAmountPaid(e.target.value); setAmountWaived(String(Math.max(0, fee - parseFloat(e.target.value || '0')))); }}
                      className="w-full border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Amount Waived (₹)</label>
                    <input type="number" min="0" max={fee} step="0.01" value={amountWaived} onChange={e => { setAmountWaived(e.target.value); setAmountPaid(String(Math.max(0, fee - parseFloat(e.target.value || '0')))); }}
                      className="w-full border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
                  </div>
                  <div className="col-span-2 text-xs text-slate-500">Total: ₹{(paid + waived).toFixed(2)} / ₹{fee} {!splitOk && <span className="text-red-500">(must equal ₹{fee})</span>}</div>
                </div>
              )}
              {/* Payment method */}
              {paid > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600">
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="ONLINE">Online</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              )}
              {/* Waive reason */}
              {waived > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1">Waiver Reason *</label>
                  <textarea value={waiveReason} onChange={e => setWaiveReason(e.target.value)} rows={2}
                    className="w-full border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
                </div>
              )}
            </div>
          )}

          {/* Return condition */}
          <div>
            <label className="block text-xs font-medium mb-1">Return Condition</label>
            <div className="flex gap-4">
              {(['GOOD', 'DAMAGED', 'LOST'] as const).map(c => (
                <label key={c} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" checked={returnCondition === c} onChange={() => setReturnCondition(c)} />
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </div>
          {(returnCondition === 'DAMAGED' || returnCondition === 'LOST') && (
            <div>
              <label className="block text-xs font-medium mb-1">Note *</label>
              <textarea value={damageNote} onChange={e => setDamageNote(e.target.value)} rows={2}
                className="w-full border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={saving || lateFeeInfo === null || !splitOk}
              className="px-4 py-1.5 rounded bg-lime-600 text-white text-sm hover:bg-lime-700 disabled:opacity-50">
              {saving ? 'Processing…' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reports Tab ────────────────────────────────────────────────────────────────

function ReportsTab() {
  const REPORT_TABS = ['Book Inventory', 'Issuance History', 'Late Fees', 'Overdue', 'Popular Books'] as const;
  type ReportTab = typeof REPORT_TABS[number];
  const [activeReport, setActiveReport] = useState<ReportTab>('Book Inventory');

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1 border-b mb-4">
        {REPORT_TABS.map(t => (
          <button key={t} onClick={() => setActiveReport(t)}
            className={`px-3 py-1.5 text-sm rounded-t transition-colors ${activeReport === t ? 'border-b-2 border-lime-600 font-medium text-lime-700 dark:text-lime-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}>
            {t}
          </button>
        ))}
      </div>

      {activeReport === 'Book Inventory' && <BookInventoryReport />}
      {activeReport === 'Issuance History' && <IssuanceHistoryReport />}
      {activeReport === 'Late Fees' && <LateFeesReport />}
      {activeReport === 'Overdue' && <OverdueReport />}
      {activeReport === 'Popular Books' && <PopularBooksReport />}
    </div>
  );
}

function BookInventoryReport() {
  const [data, setData] = useState<Pagination<Book> | null>(null);
  const [filters, setFilters] = useState({ title: '', author: '', publisher: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (p: number, f = filters) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (f.title) q.set('title', f.title);
      if (f.author) q.set('author', f.author);
      if (f.publisher) q.set('publisher', f.publisher);
      const res = await authFetch(`${API_BASE_URL}/library/reports/books?${q}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, []);

  const downloadCsv = async () => {
    const q = new URLSearchParams({ export: 'csv', limit: '10000' });
    const res = await authFetch(`${API_BASE_URL}/library/reports/books?${q}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'book-inventory.csv'; a.click();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {(['title', 'author', 'publisher'] as const).map(k => (
          <input key={k} placeholder={k} value={filters[k]} onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && load(1)}
            className="border rounded px-3 py-1.5 text-sm w-32 dark:bg-slate-800 dark:border-slate-600" />
        ))}
        <button onClick={() => load(1)} className="px-3 py-1.5 rounded bg-lime-600 text-white text-sm">Search</button>
        <button onClick={downloadCsv} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700"><Download className="w-3.5 h-3.5" /> CSV</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-slate-500"><th className="pb-1 pr-3 text-left">Title</th><th className="pb-1 pr-3 text-left">Author</th><th className="pb-1 pr-3 text-left">Publisher</th><th className="pb-1 pr-3 text-right">Total</th><th className="pb-1 text-right">Available</th></tr></thead>
              <tbody>
                {data?.data.map(b => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{b.title}</td>
                    <td className="py-1.5 pr-3">{b.author}</td>
                    <td className="py-1.5 pr-3">{b.publisher ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right">{b.totalCopies}</td>
                    <td className={`py-1.5 text-right font-medium ${b.availableCopies === 0 ? 'text-red-500' : 'text-green-600'}`}>{b.availableCopies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <PaginationBar page={data.page} total={data.total} limit={LIMIT} onChange={(p) => { setPage(p); load(p); }} />}
        </>
      )}
    </div>
  );
}

function IssuanceHistoryReport() {
  const [data, setData] = useState<Pagination<Issuance> | null>(null);
  const [status, setStatus] = useState('');
  const [borrowerType, setBorrowerType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (status) q.set('status', status);
      if (borrowerType) q.set('borrowerType', borrowerType);
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      const res = await authFetch(`${API_BASE_URL}/library/issuances?${q}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [status, borrowerType, fromDate, toDate]);

  useEffect(() => { load(1); }, []);

  const downloadCsv = async () => {
    const q = new URLSearchParams({ export: 'csv', limit: '10000' });
    if (status) q.set('status', status);
    if (fromDate) q.set('fromDate', fromDate);
    if (toDate) q.set('toDate', toDate);
    const res = await authFetch(`${API_BASE_URL}/library/issuances?${q}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'issuances.csv'; a.click();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600">
          <option value="">All Status</option>
          <option value="ISSUED">Issued</option>
          <option value="RETURNED">Returned</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <select value={borrowerType} onChange={e => setBorrowerType(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600">
          <option value="">All Borrowers</option>
          <option value="STUDENT">Students</option>
          <option value="STAFF">Staff</option>
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
        <button onClick={() => load(1)} className="px-3 py-1.5 rounded bg-lime-600 text-white text-sm">Search</button>
        <button onClick={downloadCsv} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700"><Download className="w-3.5 h-3.5" /> CSV</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-slate-500 text-left"><th className="pb-1 pr-3">Book</th><th className="pb-1 pr-3">Borrower</th><th className="pb-1 pr-3">Issued</th><th className="pb-1 pr-3">Due</th><th className="pb-1 pr-3">Returned</th><th className="pb-1">Status</th></tr></thead>
              <tbody>
                {data?.data.map(i => (
                  <tr key={i.id} className="border-b last:border-0 align-middle">
                    <td className="py-1.5 pr-3">{i.book?.title ?? `#${i.bookId}`}</td>
                    <td className="py-1.5 pr-3">{getBorrowerName(i)}</td>
                    <td className="py-1.5 pr-3 text-xs">{fmtTs(i.issueDate)}</td>
                    <td className="py-1.5 pr-3 text-xs">{fmtDate(i.dueDate)}</td>
                    <td className="py-1.5 pr-3 text-xs">{i.returnDate ? fmtTs(i.returnDate) : '—'}</td>
                    <td className="py-1.5">{statusBadge(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <PaginationBar page={data.page} total={data.total} limit={LIMIT} onChange={(p) => { setPage(p); load(p); }} />}
        </>
      )}
    </div>
  );
}

function LateFeesReport() {
  interface FeeRow { id: number; issuanceId: number; lateFeeCharged: number; amountPaid: number; amountWaived: number; paymentMethod?: string; collectedAt?: string; issuance?: Issuance; }
  interface FeeResult { data: FeeRow[]; total: number; page: number; limit: number; summary: { totalCharged: number; totalCollected: number; totalWaived: number; totalOutstanding: number }; }
  const [data, setData] = useState<FeeResult | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      const res = await authFetch(`${API_BASE_URL}/library/reports/fees?${q}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { load(1); }, []);

  const downloadCsv = async () => {
    const q = new URLSearchParams({ export: 'csv', limit: '10000' });
    if (fromDate) q.set('fromDate', fromDate);
    if (toDate) q.set('toDate', toDate);
    const res = await authFetch(`${API_BASE_URL}/library/reports/fees?${q}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'late-fees.csv'; a.click();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
        <button onClick={() => load(1)} className="px-3 py-1.5 rounded bg-lime-600 text-white text-sm">Search</button>
        <button onClick={downloadCsv} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm hover:bg-slate-100 dark:hover:bg-slate-700"><Download className="w-3.5 h-3.5" /> CSV</button>
      </div>
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[['Charged', data.summary.totalCharged, 'text-slate-700'], ['Collected', data.summary.totalCollected, 'text-green-600'], ['Waived', data.summary.totalWaived, 'text-amber-600'], ['Outstanding', data.summary.totalOutstanding, 'text-red-600']].map(([l, v, c]) => (
            <div key={String(l)} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${c}`}>₹{Number(v).toFixed(2)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      )}
      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-slate-500 text-left"><th className="pb-1 pr-3">Book</th><th className="pb-1 pr-3">Borrower</th><th className="pb-1 pr-3 text-right">Charged</th><th className="pb-1 pr-3 text-right">Paid</th><th className="pb-1 pr-3 text-right">Waived</th><th className="pb-1 pr-3">Method</th><th className="pb-1">Collected At</th></tr></thead>
              <tbody>
                {data?.data.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{r.issuance?.book?.title ?? `Issuance #${r.issuanceId}`}</td>
                    <td className="py-1.5 pr-3">
                      {r.issuance?.borrowerType === 'STUDENT'
                        ? r.issuance.student ? getBorrowerName(r.issuance) : '—'
                        : r.issuance?.staff ? getBorrowerName(r.issuance) : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right">₹{r.lateFeeCharged}</td>
                    <td className="py-1.5 pr-3 text-right text-green-600">₹{r.amountPaid}</td>
                    <td className="py-1.5 pr-3 text-right text-amber-600">₹{r.amountWaived}</td>
                    <td className="py-1.5 pr-3">{r.paymentMethod ?? '—'}</td>
                    <td className="py-1.5 text-xs">{r.collectedAt ? fmtTs(r.collectedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <PaginationBar page={data.page} total={data.total} limit={LIMIT} onChange={(p) => { setPage(p); load(p); }} />}
        </>
      )}
    </div>
  );
}

function OverdueReport() {
  const [data, setData] = useState<Pagination<Issuance> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/library/reports/overdue-summary?page=${p}&limit=${LIMIT}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  return (
    <div>
      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-slate-500 text-left"><th className="pb-1 pr-3">Book</th><th className="pb-1 pr-3">Borrower</th><th className="pb-1 pr-3">Due</th><th className="pb-1">Days Overdue</th></tr></thead>
              <tbody>
                {data?.data.map(i => {
                  const days = Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000));
                  return (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">{i.book?.title ?? `#${i.bookId}`}</td>
                      <td className="py-1.5 pr-3">{getBorrowerName(i)}</td>
                      <td className="py-1.5 pr-3 text-xs">{fmtDate(i.dueDate)}</td>
                      <td className="py-1.5 text-red-600 font-medium">{days}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && <PaginationBar page={data.page} total={data.total} limit={LIMIT} onChange={(p) => { setPage(p); load(p); }} />}
        </>
      )}
    </div>
  );
}

function PopularBooksReport() {
  interface PopBook { bookId: number; title: string; issuanceCount: number; }
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [data, setData] = useState<PopBook[]>([]);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); return fmtDate(new Date(d.getFullYear(), d.getMonth(), 1)); });
  const [toDate, setToDate] = useState(() => fmtDate(new Date()));
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ topN: '10' });
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      const res = await authFetch(`${API_BASE_URL}/library/reports/popular-books?${q}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" />
        <button onClick={load} className="px-3 py-1.5 rounded bg-lime-600 text-white text-sm">Search</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-slate-500 text-left"><th className="pb-1 pr-3">#</th><th className="pb-1 pr-3">Book</th><th className="pb-1">Times Issued</th></tr></thead>
            <tbody>
              {data.map((b, i) => (
                <tr key={b.bookId} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 text-slate-400">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{b.title}</td>
                  <td className="py-1.5 font-semibold text-lime-700 dark:text-lime-400">{b.issuanceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────────────────────

function SettingsTab() {
  const [form, setForm] = useState<LibrarySettings>({ defaultLoanDays: 14, maxLoanDays: 30, maxBooksPerBorrower: 3, lateFeePerDay: 5, allowRenewal: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/library/settings`).then(r => r.json()).then(d => { setForm(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/library/settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div>;

  const numField = (k: keyof LibrarySettings, label: string) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type="number" min="1" value={form[k] as number}
        onChange={e => setForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))}
        className="w-full border rounded px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 max-w-xs" />
    </div>
  );

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold mb-4">Library Settings</h2>
      <form onSubmit={handleSave} className="space-y-4">
        {numField('defaultLoanDays', 'Default Loan Days')}
        {numField('maxLoanDays', 'Maximum Loan Days')}
        {numField('maxBooksPerBorrower', 'Max Books per Borrower')}
        <div>
          <label className="block text-sm font-medium mb-1">Late Fee per Day (₹)</label>
          <input type="number" min="0" step="0.5" value={form.lateFeePerDay}
            onChange={e => setForm(f => ({ ...f, lateFeePerDay: parseFloat(e.target.value) || 0 }))}
            className="w-full border rounded px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 max-w-xs" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={form.allowRenewal} onChange={e => setForm(f => ({ ...f, allowRenewal: e.target.checked }))} />
          Allow Renewal
        </label>
        <button type="submit" disabled={saving} className="px-5 py-2 rounded bg-lime-600 text-white text-sm hover:bg-lime-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { canManageLibrary } = useRbac();
  const defaultTab: Tab = 'My Books';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const visibleTabs: Tab[] = canManageLibrary
    ? [...TAB_LABELS]
    : ['My Books'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-lime-100 dark:bg-lime-900/30 rounded-xl">
            <BookOpen className="w-6 h-6 text-lime-700 dark:text-lime-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Library</h1>
            <p className="text-xs text-slate-500">Manage books, issuances and late fees</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto no-scrollbar">
          {visibleTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-lime-600 text-lime-700 dark:text-lime-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
              ].join(' ')}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 md:p-6">
          {activeTab === 'My Books' && <MyBooksTab />}
          {activeTab === 'Books' && canManageLibrary && <BooksTab />}
          {activeTab === 'Issue / Return' && canManageLibrary && <IssueReturnTab />}
          {activeTab === 'Reports' && canManageLibrary && <ReportsTab />}
          {activeTab === 'Settings' && canManageLibrary && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
