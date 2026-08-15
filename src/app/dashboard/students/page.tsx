"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { useReadOnlySession, READ_ONLY_TITLE } from '@/lib/support-session';
import { authFetch } from "@/lib/auth";
import { sortByName } from "@/lib/utils";
import { Eye, FileSearch, IdCard, Pencil, Search, TrendingUp, Upload, UserPlus } from "lucide-react";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { IdCardDialog } from "@/components/id-cards/IdCardDialog";
import { useFeatureFlag } from "@/lib/useSchoolFeatures";
import { DataTable, TableCount, TableTitle, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/FilterBar";
import { Field, FieldGrid, Input, Select } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function StudentsPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loadingSections, setLoadingSections] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const rbac = useRbac();
    const readOnly = useReadOnlySession();
    const router = useRouter();
    // The student whose ID card is open. The dialog fetches the card itself —
    // a card is derived from the roster, not carried on the student row.
    const [idCardStudent, setIdCardStudent] = useState<{ id: number; name: string } | null>(null);
    const idCardsEnabled = useFeatureFlag('id_cards').enabled === true;

    // Search Params
    const [searchSessionId, setSearchSessionId] = useState("");
    const [searchId, setSearchId] = useState("");
    const [searchFirstName, setSearchFirstName] = useState("");
    const [searchLastName, setSearchLastName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchMobile, setSearchMobile] = useState("");
    const [searchParents, setSearchParents] = useState("");
    const [searchPen, setSearchPen] = useState("");
    const [searchStatus, setSearchStatus] = useState("");
    const [searchClassId, setSearchClassId] = useState("");
    const [searchSectionId, setSearchSectionId] = useState("");

    const [hasSearched, setHasSearched] = useState(false);

    // Committed params — only updated when Search is clicked, used by column renders
    const [committedSessionId, setCommittedSessionId] = useState("");
    const [committedStatus, setCommittedStatus] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const totalPages = Math.ceil(total / pageSize);

    // Bulk Import Modal State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ successful: number; failed: number; errors: string[] } | null>(null);
    const [bulkValidation, setBulkValidation] = useState<{ errors: string[]; warnings: string[]; rowCount: number } | null>(null);

    const REQUIRED_HEADERS = ["firstName", "gender", "dateOfBirth", "mobile", "category", "religion", "fathersName", "mothersName"];
    const REQUIRED_FIELDS = REQUIRED_HEADERS;
    const DATE_DDMMYYYY = /^\d{2}-\d{2}-\d{4}$/;
    const DATE_YYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;

    const validateBulkFile = (file: File) => {
        setBulkValidation(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy" });
            const errors: string[] = [];
            const warnings: string[] = [];

            if (result.errors.length > 0) {
                errors.push(`CSV parse error: ${result.errors[0].message}`);
                setBulkValidation({ errors, warnings, rowCount: 0 });
                return;
            }

            const headers = result.meta.fields ?? [];
            const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                errors.push(`Missing required column(s): ${missingHeaders.join(", ")}`);
            }

            (result.data as Record<string, string>[]).forEach((row, i) => {
                const rowNum = i + 1;
                const missingFields = REQUIRED_FIELDS.filter(f => !row[f]?.trim());
                if (missingFields.length > 0) {
                    errors.push(`Row ${rowNum}: Missing required fields: ${missingFields.join(", ")}`);
                    return;
                }
                const dob = row.dateOfBirth?.trim() ?? "";
                if (dob && !DATE_DDMMYYYY.test(dob) && !DATE_YYYYMMDD.test(dob)) {
                    errors.push(`Row ${rowNum}: dateOfBirth "${dob}" must be DD-MM-YYYY or YYYY-MM-DD`);
                } else if (DATE_DDMMYYYY.test(dob)) {
                    // Warn about auto-conversion
                    warnings.push(`Row ${rowNum}: dateOfBirth "${dob}" is DD-MM-YYYY — will be auto-converted`);
                }
            });

            setBulkValidation({ errors, warnings, rowCount: result.data.length });
        };
        reader.readAsText(file);
    };

    const buildParams = (overridePage?: number) => {
        const params = new URLSearchParams();
        if (searchId) params.append("id", searchId);
        if (searchFirstName) params.append("firstName", searchFirstName);
        if (searchLastName) params.append("lastName", searchLastName);
        if (searchEmail) params.append("email", searchEmail);
        if (searchMobile) params.append("mobile", searchMobile);
        if (searchParents) params.append("parentsName", searchParents);
        if (searchPen) params.append("pen", searchPen);
        if (searchStatus !== "") params.append("enrollmentStatus", searchStatus);
        if (searchClassId) params.append("classId", searchClassId);
        if (searchSectionId) params.append("sectionId", searchSectionId);
        if (searchSessionId) params.append("academicSessionId", searchSessionId);
        params.append("page", String(overridePage ?? page));
        params.append("limit", String(pageSize));
        return params;
    };

    const fetchStudents = async (overridePage?: number) => {
        setLoading(true);
        try {
            const params = buildParams(overridePage);
            const res = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.data) {
                    setStudents(data.data);
                    setTotal(data.total);
                    setPage(data.page);
                } else {
                    setStudents(Array.isArray(data) ? data : []);
                    setTotal(Array.isArray(data) ? data.length : 0);
                }
                setHasSearched(true);
                setCommittedSessionId(searchSessionId);
                setCommittedStatus(searchStatus);
            }
        } catch {
            toast.error("Failed to fetch students");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        Promise.all([
            fetcher(`${API_BASE_URL}/classes/names-only`),
            fetcher(`${API_BASE_URL}/academic-sessions`)
        ]).then(([classesData, sessionsData]) => {
            const sessionList = Array.isArray(sessionsData) ? sessionsData : [];
            setClasses(sortByName(Array.isArray(classesData) ? classesData : []));
            setSessions(sessionList);
            const activeSession = sessionList.find((s: any) => s.isActive);
            if (activeSession) setSearchSessionId(activeSession.id.toString());
        }).catch(() => { });
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchStudents(1);
    };

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSearchClassId(val);
        setSearchSectionId("");
        setSections([]);
        if (val) {
            setLoadingSections(true);
            fetcher(`${API_BASE_URL}/classes/${val}/sections`)
                .then(data => setSections(Array.isArray(data) ? data : []))
                .catch(() => setSections([]))
                .finally(() => setLoadingSections(false));
        }
    };

    const handleReset = () => {
        setSearchId("");
        setSearchFirstName("");
        setSearchLastName("");
        setSearchEmail("");
        setSearchMobile("");
        setSearchParents("");
        setSearchPen("");
        setSearchStatus("");
        setSearchClassId("");
        setSearchSectionId("");
        const activeSession = sessions.find((s: any) => s.isActive);
        setSearchSessionId(activeSession ? activeSession.id.toString() : "");
        setSections([]);
        setStudents([]);
        setHasSearched(false);
        setCommittedSessionId("");
        setCommittedStatus("");
        setPage(1);
        setTotal(0);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        setPage(newPage);
        fetchStudents(newPage);
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(e.target.value);
        setPageSize(newSize);
        setPage(1);
        // Re-fetch with new page size — use setTimeout to let state settle
        setTimeout(() => fetchStudents(1), 0);
    };

    const closeBulkModal = () => {
        setShowBulkModal(false);
        setBulkFile(null);
        setBulkResult(null);
        setBulkValidation(null);
    };

    const handleBulkUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!bulkFile) return;

        setBulkUploading(true);
        setBulkResult(null);
        try {
            const formData = new FormData();
            formData.append("file", bulkFile);

            const res = await authFetch(`${API_BASE_URL}/students/bulk-import`, {
                method: "POST",
                body: formData, // No Content-Type header here, browser sets it with boundary for multipart/form-data
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message || "Failed to upload file");
            } else {
                const result = await res.json();
                setBulkResult(result);
                
                if (result.successful > 0 && result.failed === 0) {
                    toast.success(`Successfully imported ${result.successful} students`);
                    fetchStudents(1); // Refresh list
                    setTimeout(() => closeBulkModal(), 2000);
                } else if (result.successful > 0) {
                    toast.success(`Partially imported ${result.successful} students. Check errors.`);
                    fetchStudents(1); // Refresh list
                }
            }
        } catch {
            toast.error("An error occurred during bulk import");
        } finally {
            setBulkUploading(false);
        }
    };

    /**
     * Which enrollment a cell reads from: the one for the session that was
     * searched, else the one matching the searched status, else the active one.
     * Logic unchanged — only the rendering moved into DataTable columns.
     */
    const enrollmentFor = (row: any) =>
        row.enrollments?.find((e: any) => e.academicSession?.id === parseInt(committedSessionId))
        ?? (committedStatus ? row.enrollments?.find((e: any) => e.status === committedStatus) : undefined)
        ?? row.enrollments?.find((e: any) => e.status === 'ACTIVE');

    const columns: Column<any>[] = [
        {
            key: 'id',
            header: 'ID',
            accessor: (row) => row.id,
            sortable: true,
            width: 'w-14',
            className: 'tabular',
            card: 'meta',
        },
        {
            key: 'rollNo',
            header: 'Roll no',
            sortable: true,
            className: 'tabular',
            card: 'meta',
            sortValue: (row) => enrollmentFor(row)?.rollNo ?? row.rollNo,
            render: (row) => {
                const rollNo = enrollmentFor(row)?.rollNo ?? row.rollNo;
                return (rollNo && rollNo !== 0) ? rollNo : '—';
            },
        },
        {
            key: 'name',
            header: 'Student',
            sortable: true,
            card: 'title',
            sortValue: (row) => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
            render: (row) => (
                <span className="font-semibold text-ink">
                    {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
                </span>
            ),
        },
        {
            key: 'class',
            header: 'Class / section',
            hideBelow: 'lg',
            render: (row) => {
                const enrollment = row.enrollments?.find((e: any) => e.academicSession?.id === parseInt(searchSessionId))
                    ?? (committedStatus ? row.enrollments?.find((e: any) => e.status === committedStatus) : undefined);
                if (enrollment) {
                    return `${enrollment.class?.name || '-'} ${enrollment.section ? '- ' + enrollment.section.name : ''}`;
                }
                return row.class ? `${row.class.name} ${row.section ? '- ' + row.section.name : ''}` : '—';
            },
        },
        {
            key: 'subjects',
            header: 'Subjects',
            hideBelow: 'xl',
            card: 'hidden',
            render: (row) => row.studentSubjects && row.studentSubjects.length > 0
                ? row.studentSubjects.map((ss: any) => (ss.subject || ss.extraSubject)?.name).filter(Boolean).join(', ')
                : '—',
        },
        {
            key: 'status',
            header: 'Status',
            card: 'trailing',
            render: (row) => {
                const enrollment = enrollmentFor(row);
                return <StatusChip status={enrollment ? enrollment.status : (row.isActive ? 'ACTIVE' : 'INACTIVE')} />;
            },
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            // 'trailing' — NOT 'hidden'. On the mobile card the actions column is
            // the only route into a student's record, so dropping it left phones
            // with a searchable list they could not open.
            card: 'trailing',
            render: (row) => (
                <RowActionsMenu
                    label="Student actions"
                    actions={[
                        {
                            label: 'View',
                            icon: <Eye className="size-4 text-ink-faint" />,
                            href: `/dashboard/students/${row.id}`,
                        },
                        // Hidden outright when the school is not on the ID
                        // cards plan — an action that can only ever open an
                        // upsell is worse than no action.
                        idCardsEnabled && {
                            label: 'View ID card',
                            icon: <IdCard className="size-4 text-ink-faint" />,
                            onSelect: () =>
                                setIdCardStudent({
                                    id: row.id,
                                    name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
                                }),
                        },
                        rbac.canManageStudents && {
                            label: 'Edit',
                            icon: <Pencil className="size-4 text-ink-faint" />,
                            href: `/dashboard/students/${row.id}/edit`,
                            disabled: readOnly,
                        },
                        rbac.canManageStudents && {
                            label: 'Promote',
                            icon: <TrendingUp className="size-4 text-ink-faint" />,
                            href: `/dashboard/students/${row.id}/promote`,
                            disabled: readOnly,
                        },
                    ]}
                />
            ),
        },
    ];


    // (The page-number window used to be built here; <Pagination/> owns that
    //  now, so the local copy was dead code.)

    return (
        <PageShell>
            <PageHeader
                section="Academics · Students"
                title="Students"
                description="Search the register, then open a student for their full record."
                actions={
                    <>
                        <Button variant="outline" render={<Link href="/dashboard/documents" />}>
                            <FileSearch />
                            Document trace
                        </Button>
                        {rbac.canManageStudents && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setBulkFile(null);
                                    setBulkResult(null);
                                    setShowBulkModal(true);
                                }}
                            >
                                <Upload />
                                Bulk import
                            </Button>
                        )}
                        {rbac.canBulkOperateStudents && (
                            <Button variant="attn" render={<Link href="/dashboard/students/promotions" />}>
                                Bulk promotions
                            </Button>
                        )}
                        {rbac.canManageStudents && (
                            <Button render={<Link href="/dashboard/students/new" />}>
                                <UserPlus />
                                Add student
                            </Button>
                        )}
                    </>
                }
            />

            <PageBody>
                {/* ── Search ─────────────────────────────────────────── */}
                <Panel>
                    <form onSubmit={handleSearch} className="p-4">
                        <FieldGrid columns={3}>
                            <Field label="Student ID" htmlFor="f-id">
                                <Input id="f-id" value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="e.g. 1" />
                            </Field>
                            <Field label="First name" htmlFor="f-first">
                                <Input id="f-first" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} placeholder="First name" />
                            </Field>
                            <Field label="Last name" htmlFor="f-last">
                                <Input id="f-last" value={searchLastName} onChange={e => setSearchLastName(e.target.value)} placeholder="Last name" />
                            </Field>
                            <Field label="Email" htmlFor="f-email">
                                <Input id="f-email" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Email address" />
                            </Field>
                            <Field label="Mobile number" htmlFor="f-mobile" hint="Matches the whole number">
                                <Input id="f-mobile" inputMode="numeric" value={searchMobile} onChange={e => setSearchMobile(e.target.value.replace(/\D/g, ''))} placeholder="Exact mobile no." />
                            </Field>
                            <Field label="Parent's name" htmlFor="f-parent">
                                <Input id="f-parent" value={searchParents} onChange={e => setSearchParents(e.target.value)} placeholder="Mother or father" />
                            </Field>
                            <Field label="PEN" htmlFor="f-pen" hint="Permanent enrollment number">
                                <Input id="f-pen" value={searchPen} onChange={e => setSearchPen(e.target.value)} placeholder="e.g. 1234567890" />
                            </Field>
                            <Field label="Status" htmlFor="f-status">
                                <Select id="f-status" value={searchStatus} onChange={e => setSearchStatus(e.target.value)}>
                                    <option value="">All</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="PROMOTED">Promoted</option>
                                    <option value="ALUMNI">Alumni</option>
                                    <option value="WITHDRAWN">Withdrawn</option>
                                    <option value="GRADUATED">Graduated</option>
                                </Select>
                            </Field>
                            <Field label="Academic year" htmlFor="f-session">
                                <Select id="f-session" value={searchSessionId} onChange={e => setSearchSessionId(e.target.value)}>
                                    <option value="">All sessions</option>
                                    {sessions.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(active)' : ''}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Class" htmlFor="f-class">
                                <Select id="f-class" value={searchClassId} onChange={handleClassChange}>
                                    <option value="">All classes</option>
                                    {classes.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Section" htmlFor="f-section">
                                <Select id="f-section" value={searchSectionId} onChange={e => setSearchSectionId(e.target.value)} disabled={!searchClassId || loadingSections}>
                                    <option value="">{loadingSections ? 'Loading sections…' : 'All sections'}</option>
                                    {sections.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </Select>
                            </Field>
                        </FieldGrid>

                        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
                            <Button type="button" variant="ghost" onClick={handleReset}>Reset</Button>
                            <Button type="submit">
                                <Search />
                                Search
                            </Button>
                        </div>
                    </form>
                </Panel>

                {/* ── Results ────────────────────────────────────────── */}
                {!hasSearched ? (
                    <Panel>
                        <EmptyState
                            icon={<Search />}
                            title="Search the register"
                            description="Narrow by class, section, status or name, then search. Results appear here."
                        />
                    </Panel>
                ) : (
                    <DataTable
                        columns={columns}
                        data={students}
                        loading={loading}
                        rowKey={(row) => row.id}
                        defaultSort={{ key: 'id', direction: 'asc' }}
                        emptyMessage="No students match those filters"
                        // The whole row opens the record — on a phone the card IS
                        // the target, and tapping a name is what people try first.
                        onRowClick={(row) => router.push(`/dashboard/students/${row.id}`)}
                        toolbar={
                            <>
                                <TableTitle>Students</TableTitle>
                                <TableCount>{total.toLocaleString('en-IN')} found</TableCount>
                                <label className="ml-auto flex items-center gap-2">
                                    <span className="eyebrow">Rows</span>
                                    <select
                                        value={pageSize}
                                        onChange={handlePageSizeChange}
                                        className="cursor-pointer rounded-md border border-line-strong bg-surface px-2 py-1 text-[12px] text-ink"
                                        aria-label="Rows per page"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        }
                        footer={
                            <Pagination
                                page={page}
                                pageCount={totalPages}
                                onPageChange={handlePageChange}
                                total={total}
                                pageSize={pageSize}
                            />
                        }
                    />
                )}
            </PageBody>


                {/* Bulk Import Modal */}
                {showBulkModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 p-4 backdrop-blur-sm">
                        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-glass">
                            <div className="flex items-center justify-between border-b border-line bg-surface-secondary px-4 py-3">
                                <h3 className="font-display text-[17px] font-semibold text-ink">Import students from a CSV</h3>
                                <button onClick={closeBulkModal} className="ms-auto inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink" aria-label="Close">
                                    <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto">
                                <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <p className="font-semibold mb-2">CSV Format Requirements:</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Must contain headers exactly as shown below (order matters):</li>
                                        <li className="font-mono text-xs bg-gray-100 p-1 rounded overflow-x-auto whitespace-nowrap">firstName,lastName,gender,dateOfBirth,mobile,email,alternateMobile,category,religion,bloodGroup,aadhaarNumber,fathersName,fatherAadhaarNumber,mothersName,motherAadhaarNumber,addressLine1,addressLine2,landmark,city,state,postalCode,country,classId,sectionId,academicSessionId,subjectIds,pen,fatherPan,motherPan,fatherOccupation,motherOccupation,fatherIncome,motherIncome,aparId,abhaId</li>
                                        <li><span className="font-semibold text-red-600">Required:</span> firstName, gender, dateOfBirth, mobile, fathersName, mothersName, category, religion</li>
                                        <li><span className="font-semibold">Optional fields</span> can be left empty, but the column must still be present.</li>
                                        <li><span className="font-semibold">dateOfBirth:</span> Use format YYYY-MM-DD</li>
                                        <li><span className="font-semibold">subjectIds:</span> Pipe-separated values e.g. <code className="bg-gray-200 px-1 rounded">1|3|4</code></li>
                                        <li><span className="font-semibold">country:</span> Full country name e.g. <code className="bg-gray-200 px-1 rounded">INDIA</code> (leave blank to default to INDIA)</li>
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const headers = "firstName,lastName,gender,dateOfBirth,mobile,email,alternateMobile,category,religion,bloodGroup,aadhaarNumber,fathersName,fatherAadhaarNumber,mothersName,motherAadhaarNumber,addressLine1,addressLine2,landmark,city,state,postalCode,country,classId,sectionId,academicSessionId,subjectIds,pen,fatherPan,motherPan,fatherOccupation,motherOccupation,fatherIncome,motherIncome,aparId,abhaId";
                                            const sample = "John,Doe,Male,2010-05-15,9876543210,john.doe@example.com,,General,HINDU,O+,,Ramesh Doe,,Sunita Doe,,12 Main Street,,Near Park,Delhi,Delhi,110001,India,1,1,1,1|2,,,,,,,,,";
                                            const blob = new Blob([headers + "\n" + sample], { type: "text/csv" });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = "students-import-template.csv";
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-brand underline hover:no-underline"
                                    >
                                        Download CSV template
                                    </button>
                                </div>

                                <form onSubmit={handleBulkUpload}>
                                    <label className="eyebrow mb-2 block">CSV file</label>
                                    <input 
                                        type="file" 
                                        accept=".csv"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            setBulkFile(f);
                                            setBulkResult(null);
                                            if (f) validateBulkFile(f);
                                            else setBulkValidation(null);
                                        }}
                                        className="mb-4 block w-full cursor-pointer rounded-md border border-line-strong bg-surface-secondary p-2 text-[13.5px] text-ink focus:outline-none" 
                                        required
                                    />

                                    {bulkValidation && !bulkResult && (
                                        <div className={`p-4 mb-4 text-sm rounded-lg border ${bulkValidation.errors.length > 0 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                                            <p className="font-bold mb-1">
                                                {bulkValidation.errors.length > 0
                                                    ? `Validation found ${bulkValidation.errors.length} issue(s) in ${bulkValidation.rowCount} row(s)`
                                                    : `File looks good — ${bulkValidation.rowCount} row(s) ready to import`}
                                            </p>
                                            {bulkValidation.errors.length > 0 && (
                                                <div className="mt-2 max-h-40 overflow-y-auto text-xs bg-white p-2 rounded border border-red-100">
                                                    {bulkValidation.errors.map((err, i) => (
                                                        <div key={i} className="mb-1 text-red-600 font-mono">{err}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {bulkValidation.warnings.length > 0 && (
                                                <details className="mt-2">
                                                    <summary className="text-xs cursor-pointer text-amber-700 font-medium">{bulkValidation.warnings.length} auto-conversion note(s)</summary>
                                                    <div className="mt-1 max-h-32 overflow-y-auto text-xs bg-white p-2 rounded border border-amber-100">
                                                        {bulkValidation.warnings.map((w, i) => (
                                                            <div key={i} className="mb-1 text-amber-700 font-mono">{w}</div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    )}

                                    {bulkResult && (
                                        <div className={`p-4 mb-4 text-sm rounded-lg ${bulkResult.failed > 0 ? 'bg-orange-50 text-orange-800 border border-orange-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                            <p className="font-bold mb-2">Import Results:</p>
                                            <p>{bulkResult.successful} students successfully created and enrolled.</p>
                                            {bulkResult.failed > 0 && <p>{bulkResult.failed} failed.</p>}
                                            {bulkResult.errors?.length > 0 && (
                                                <div className="mt-2 max-h-32 overflow-y-auto text-xs bg-white p-2 rounded border border-orange-100">
                                                    {bulkResult.errors.map((err, i) => (
                                                        <div key={i} className="mb-1 text-red-600 font-mono">{err}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 mt-6">
                                        <button 
                                            type="button" 
                                            onClick={closeBulkModal} 
                                            className="text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-line-strong font-medium rounded-lg text-sm px-5 py-2.5"
                                        >
                                            Close
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={!bulkFile || bulkUploading || readOnly}
                                            title={readOnly ? READ_ONLY_TITLE : undefined}
                                            className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-brand/40 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-50"
                                        >
                                            {bulkUploading ? 'Importing...' : 'Upload & Import'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

            <IdCardDialog
                subject={idCardStudent ? { type: 'student', ...idCardStudent } : null}
                open={idCardStudent !== null}
                onOpenChange={(open) => { if (!open) setIdCardStudent(null); }}
            />
        </PageShell>
    );
}
