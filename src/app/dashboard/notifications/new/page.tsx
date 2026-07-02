"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "react-hot-toast";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { useRbac } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import Link from "next/link";

type NotificationAudience = "PARENT" | "STAFF" | "ALL" | "CUSTOM";

export default function NewNotificationPage() {
  const { isSubAdmin, isAdmin, isSuperAdmin } = useRbac();
  const canSendNotifications = isSubAdmin || isAdmin || isSuperAdmin;
  const router = useRouter();

  // Custom Audience States
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting }
  } = useForm<{ title: string; message: string; targetAudience: NotificationAudience }>({
    defaultValues: { title: "", message: "", targetAudience: "" as unknown as NotificationAudience }
  });

  const watchAudience = useWatch({ control, name: "targetAudience" });

  const fetchSessions = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/academic-sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        const active = data.find((s: any) => s.isActive);
        if (active) setSelectedSessionId(active.id.toString());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClasses = async () => {
    setIsLoadingClasses(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/classes`);
      if (res.ok) setClasses(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const fetchSections = async (classId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/classes/${classId}/sections`);
      if (res.ok) setSections(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async (sessionId: string, classId: string, sectionId?: string) => {
    if (!classId) return setStudents([]);
    setIsLoadingStudents(true);
    try {
      let url = `${API_BASE_URL}/students?classId=${classId}`;
      if (sessionId) url += `&academicSessionId=${sessionId}`;
      if (sectionId) url += `&sectionId=${sectionId}`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (canSendNotifications) {
      fetchSessions();
      fetchClasses();
    }
  }, [canSendNotifications]);

  useEffect(() => {
    if (watchAudience === "CUSTOM") {
      fetchStudents(selectedSessionId, selectedClassId, selectedSectionId);
    }
  }, [selectedSessionId, selectedClassId, selectedSectionId, watchAudience]);

  // Handle Session selection
  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSessionId(e.target.value);
    setSelectedStudentIds([]); // Reset students
  };

  // Handle Class selection
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedClassId(cid);
    setSelectedSectionId(""); // Reset section
    setSelectedStudentIds([]); // Reset students
    if (cid) {
      fetchSections(cid);
    } else {
      setSections([]);
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: { title: string; message: string; targetAudience: NotificationAudience }) => {
    if (data.targetAudience === "CUSTOM" && selectedStudentIds.length === 0) {
      toast.error("Please select at least one student for the custom audience.");
      return;
    }

    try {
      const payload: any = { ...data };
      if (data.targetAudience === "CUSTOM") {
        payload.targetUserIds = selectedStudentIds;
      }

      const res = await authFetch(`${API_BASE_URL}/api/app-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Notification sent successfully!");
        router.push('/dashboard/notifications');
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to send notification.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    }
  };

  if (!canSendNotifications) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">You do not have permission to send notifications.</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/notifications" className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Create Notification</h1>
          <p className="mt-1 text-sm text-slate-500">Draft a new message and select your target audience.</p>
        </div>
      </div>

      <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 w-full block">Notification Title</label>
            <input
              {...register("title", { required: "Title is required" })}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
              placeholder="e.g., Important Parent-Teacher Meeting"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 w-full block">Message Overview</label>
            <textarea
              {...register("message", { required: "Message is required" })}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-y placeholder:text-slate-400"
              placeholder="Write the full message details here..."
            />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 w-full block">Target Audience</label>
            <select
              {...register("targetAudience", { required: "Please select an audience" })}
              className="w-full px-4 py-3 border border-slate-200 text-slate-700 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="" disabled>-- Select an Audience --</option>
              <option value="ALL">All Users (Parents & Staff)</option>
              <option value="PARENT">All Parents</option>
              <option value="STAFF">All Staff Members</option>
              <option value="CUSTOM">Custom Selection (Targeted Students)</option>
            </select>
            {errors.targetAudience && <p className="text-red-500 text-sm mt-1">{errors.targetAudience.message}</p>}
          </div>

          {watchAudience === "CUSTOM" && (
            <div className="space-y-5 p-5 border border-amber-100 rounded-xl bg-amber-50/30">
              <h4 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">Custom Audience Filter</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Academic Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={handleSessionChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(Active)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Select Class</label>
                  <select
                    value={selectedClassId}
                    onChange={handleClassChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="">-- All Classes --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Select Section (Optional)</label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => { setSelectedSectionId(e.target.value); setSelectedStudentIds([]); }}
                    disabled={!selectedClassId || sections.length === 0}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm disabled:opacity-50 disabled:bg-slate-50"
                  >
                    <option value="">-- All Sections --</option>
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {isLoadingStudents ? (
                <div className="py-8 text-center bg-white rounded-lg border border-slate-200 text-sm text-slate-500 flex items-center justify-center gap-2">
                   <div className="w-4 h-4 border-2 border-blue-500 border-t-white rounded-full animate-spin"></div> Loading students...
                </div>
              ) : students.length > 0 ? (
                <div className="space-y-3">
                   <div className="flex justify-between items-center bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm">
                     <label className="flex items-center gap-3 cursor-pointer group">
                       <input 
                         type="checkbox" 
                         checked={students.length > 0 && selectedStudentIds.length === students.length}
                         onChange={(e) => {
                           if (e.target.checked) {
                             setSelectedStudentIds(students.map(s => s.id.toString()));
                           } else {
                             setSelectedStudentIds([]);
                           }
                         }}
                         className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                       />
                       <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                         Select All Students ({students.length})
                       </span>
                     </label>
                     <div className="flex items-center gap-3">
                       {selectedStudentIds.length > 0 && (
                         <button 
                           type="button" 
                           onClick={() => setSelectedStudentIds([])}
                           className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                         >
                           Clear Selection
                         </button>
                       )}
                       <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                         {selectedStudentIds.length} Selected
                       </div>
                     </div>
                   </div>
                   
                   <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-inner">
                     {students.map(s => (
                       <label key={s.id} className="flex items-center gap-4 p-3 hover:bg-blue-50/50 cursor-pointer transition-colors">
                         <input 
                           type="checkbox" 
                           checked={selectedStudentIds.includes(s.id.toString())}
                           onChange={() => toggleStudentSelection(s.id.toString())}
                           className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                         />
                         <div className="flex-1">
                           <p className="text-sm font-semibold text-slate-900">{s.firstName} {s.lastName}</p>
                           <p className="text-xs text-slate-500 font-medium">Class: {s.class?.name || 'N/A'}{s.section ? ` - ${s.section.name}` : ''} | Roll: {s.enrollments?.[0]?.rollNo || 'N/A'}</p>
                         </div>
                       </label>
                     ))}
                   </div>
                </div>
              ) : selectedClassId ? (
                <div className="py-8 text-center bg-white rounded-lg border border-slate-200 text-sm text-slate-500 shadow-sm">
                  No students found matching these filters.
                </div>
              ) : (
                <div className="py-8 text-center bg-white rounded-lg border border-slate-200 text-sm text-slate-500 shadow-sm">
                  Select a class to view students.
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending Broadcast...
                </>
              ) : "Send Broadcast Now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
