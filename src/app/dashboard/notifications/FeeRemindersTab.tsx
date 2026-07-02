"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

export default function FeeRemindersTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Pagination
  const [studentsPage, setStudentsPage] = useState(1);
  const STUDENTS_PER_PAGE = 10;

  // Sorting
  const [sortColumn, setSortColumn] = useState('firstName');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedStudents = [...students].sort((a, b) => {
    let valA = a[sortColumn];
    let valB = b[sortColumn];
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [sessionRes, classRes] = await Promise.all([
          authFetch(`${API_BASE_URL}/academic-sessions`),
          authFetch(`${API_BASE_URL}/classes`)
        ]);

        if (sessionRes.ok) {
          const s = await sessionRes.json();
          setSessions(s);
          const active = s.find((x: any) => x.isActive);
          if (active) setSelectedSessionId(active.id.toString());
        }

        if (classRes.ok) {
          setClasses(await classRes.json());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitData();
  }, []);

  const handleClassChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedClassId(cid);
    setSelectedSectionId("");
    setSections([]);
    setStudents([]);

    if (cid) {
      const res = await authFetch(`${API_BASE_URL}/classes/${cid}/sections`);
      if (res.ok) setSections(await res.json());
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClassId || !selectedSectionId) {
        setStudents([]);
        return;
      }
      setLoadingStudents(true);
      try {
        let url = `${API_BASE_URL}/fees/reports/pending-dues?classId=${selectedClassId}`;
        const session = sessions.find(s => s.id.toString() === selectedSessionId);
        if (session) {
          url += `&academicYear=${encodeURIComponent(session.name)}`;
        }
        url += `&sectionId=${selectedSectionId}`;
        const res = await authFetch(url);
        if (res.ok) {
          const data = await res.json();
          setStudents(Array.isArray(data) ? data : data.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [selectedClassId, selectedSectionId, selectedSessionId, sessions]);

  useEffect(() => {
    setStudentsPage(1);
  }, [students]);

  const handleSendReminder = () => {
    if (!selectedClassId || !selectedSectionId) {
      toast.error("Please select a class and section first.");
      return;
    }
    setShowModal(true);
  };

  const confirmSend = async () => {
    if (useCustomMessage && !customMessage.trim()) {
      toast.error("Please enter a custom message.");
      return;
    }
    
    const targetUserIds = students.map((s) => s.studentId.toString());
    const payload = {
      title: "Fee Payment Reminder",
      message: useCustomMessage ? customMessage : "Dear Parent, this is a reminder that your ward has pending school fee dues. Kindly clear the outstanding amount at the earliest to avoid any inconvenience. Thank you.",
      targetAudience: "CUSTOM",
      targetUserIds,
    };

    setSendingNotif(true);

    try {
      // First, check if duplicate reminder has been sent
      const checkRes = await authFetch(`${API_BASE_URL}/api/app-notifications/check-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (checkRes.ok) {
        const { isDuplicate, sentAt } = await checkRes.json();
        if (isDuplicate) {
          const sentDate = new Date(sentAt).toLocaleString();
          const confirmed = window.confirm(`A Fee Payment Reminder was already sent to these exact students on ${sentDate}. Are you sure you want to send it again?`);
          if (!confirmed) {
            setSendingNotif(false);
            return;
          }
        }
      }
      
      const res = await authFetch(`${API_BASE_URL}/api/app-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Fee reminder sent successfully!");
        setShowModal(false);
        setCustomMessage("");
        setUseCustomMessage(false);
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to send reminder.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setSendingNotif(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Fee Reminder Broadcast</h3>
        <p className="text-sm text-slate-500 mb-6">Select class and section to send fee reminder to all students in that group.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Academic Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(Active)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Class</label>
            <select
              value={selectedClassId}
              onChange={handleClassChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Section <span className="text-red-500">*</span></label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedClassId || sections.length === 0}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
            >
              <option value="">{selectedClassId ? '-- Select Section --' : '-- Select Class First --'}</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedClassId && selectedSectionId && (
          <div className="mb-6 p-5 border border-slate-200 rounded-xl bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-600 font-medium">Students in selection: <span className="text-lg font-bold text-slate-900">{loadingStudents ? '...' : students.length}</span></p>
              <p className="text-xs text-slate-500 mt-1">Fee payment reminder will be sent to parents of all students with pending dues in selected class &amp; section.</p>
            </div>
            <button
              onClick={handleSendReminder}
              disabled={!selectedClassId || !selectedSectionId || loadingStudents || students.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition"
            >
              Send Reminder
            </button>
          </div>
        )}

        {selectedClassId && selectedSectionId && (
          <>
            <div className="mb-4">
              <h4 className="text-md font-semibold text-slate-800">Student List Reference</h4>
              <p className="text-xs text-slate-500">Review the list of students who will receive this reminder.</p>
            </div>
            {/* Student list */}
            {loadingStudents ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading students...</div>
            ) : students.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 w-10">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('firstName')}>
                        <div className="flex items-center gap-1">Name <span className="text-gray-400 text-xs">{sortColumn === 'firstName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></div>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('rollNo')}>
                        <div className="flex items-center gap-1">Roll No <span className="text-gray-400 text-xs">{sortColumn === 'rollNo' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></div>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('sectionName')}>
                        <div className="flex items-center gap-1">Section <span className="text-gray-400 text-xs">{sortColumn === 'sectionName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></div>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('mobile')}>
                        <div className="flex items-center gap-1">Mobile <span className="text-gray-400 text-xs">{sortColumn === 'mobile' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></div>
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('pendingAmount')}>
                        <div className="flex items-center justify-end gap-1">Pending Dues <span className="text-gray-400 text-xs">{sortColumn === 'pendingAmount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedStudents
                      .slice((studentsPage - 1) * STUDENTS_PER_PAGE, studentsPage * STUDENTS_PER_PAGE)
                      .map((s, idx) => (
                        <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-400">{(studentsPage - 1) * STUDENTS_PER_PAGE + idx + 1}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{s.firstName} {s.lastName}</td>
                          <td className="px-4 py-3 text-slate-500">{s.rollNo || '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{s.sectionName || '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{s.mobile || '—'}</td>
                          <td className="px-4 py-3 text-red-600 font-medium text-right">₹{s.pendingAmount?.toLocaleString() || '0'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {/* Pagination controls */}
                {Math.ceil(students.length / STUDENTS_PER_PAGE) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <span className="text-xs text-slate-500">
                      Showing {(studentsPage - 1) * STUDENTS_PER_PAGE + 1}–{Math.min(studentsPage * STUDENTS_PER_PAGE, students.length)} of {students.length} students
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setStudentsPage(p => Math.max(1, p - 1))}
                        disabled={studentsPage === 1}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.ceil(students.length / STUDENTS_PER_PAGE) }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === Math.ceil(students.length / STUDENTS_PER_PAGE) || Math.abs(p - studentsPage) <= 1)
                        .reduce<(number | '...')[]>((acc, p, i, arr) => {
                          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === '...' ? (
                            <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs text-slate-400">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setStudentsPage(p as number)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                                studentsPage === p
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => setStudentsPage(p => Math.min(Math.ceil(students.length / STUDENTS_PER_PAGE), p + 1))}
                        disabled={studentsPage === Math.ceil(students.length / STUDENTS_PER_PAGE)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No students found in the selected section.</div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Send Fee Reminder
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-sm border border-indigo-100 flex gap-3 items-center">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Will notify parents of <strong>{students.length}</strong> selected student(s).</span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notification Title</label>
                <input type="text" value="Fee Payment Reminder" disabled className="w-full border-slate-200 bg-slate-50 text-slate-500 rounded-lg p-2.5 text-sm" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Message Content</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useCustomMessage} onChange={(e) => setUseCustomMessage(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs text-slate-600 font-medium">Use custom message</span>
                  </label>
                </div>
                
                {useCustomMessage ? (
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Write your custom reminder message here..."
                    className="w-full border-slate-300 rounded-lg p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                  />
                ) : (
                  <div className="w-full border border-slate-200 bg-slate-50 rounded-lg p-4 text-sm text-slate-500 italic">
                    "Dear Parent, this is a reminder that your ward has pending school fee dues. Kindly clear the outstanding amount at the earliest to avoid any inconvenience. Thank you."
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={sendingNotif}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                disabled={sendingNotif || (useCustomMessage && !customMessage.trim())}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition flex items-center gap-2 disabled:opacity-50"
              >
                {sendingNotif ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
