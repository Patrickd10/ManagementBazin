"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addEntryAction,
  createStudentAction,
  deleteStudentAction,
  getStudentEntriesAction,
  logoutAction,
  removeLastEntryAction,
  renewStudentAction,
  restoreStudentAction,
  updateStudentAction,
} from "../actions";

type Subscription = {
  id: number;
  nume: string;
  numarIntrari: number;
  valabilitateZile: number;
};

export type Student = {
  id: number;
  nume: string;
  dataNasterii: string | null;
  numeParinte: string;
  telefonParinte: string;
  dataStartAbonament: string;
  dataUltimeiIntrari: string | null;
  abonament: Subscription;
  intrariFolosite: number;
};

export type DeletedStudent = {
  id: number;
  nume: string;
  dataNasterii: string | null;
  numeParinte: string;
  telefonParinte: string;
  dataStergere: string;
  dataExpirarePastrare: string;
  abonament: Subscription | null;
};

type DashboardProps = {
  antrenor: string;
  elevi: Student[];
  eleviStersi: DeletedStudent[];
  abonamente: Subscription[];
  currentDate: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function expiresAt(student: Student) {
  const start = new Date(student.dataStartAbonament);
  start.setDate(start.getDate() + student.abonament.valabilitateZile);
  return start;
}

function daysUntil(date: Date, currentDate: string) {
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function dateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subscriptionLabel(subscription: Subscription | null, subscriptions: Subscription[]) {
  if (!subscription) {
    return "Abonament necunoscut";
  }

  return subscriptions.find((item) => item.id === subscription.id)?.nume ?? subscription.nume;
}

function showValue(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : "-";
}

function studentState(student: Student, currentDate: string) {
  const expiry = expiresAt(student);
  const expiryDays = daysUntil(expiry, currentDate);
  const entriesReached = student.intrariFolosite >= student.abonament.numarIntrari;
  const expired = expiryDays < 0;

  return {
    expiry,
    expiryDays,
    entriesReached,
    expired,
    needsAttention: entriesReached || expired,
  };
}

function ListIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

function RenewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v7" />
      <path d="M14 10v7" />
    </svg>
  );
}

export function Dashboard({ antrenor, elevi, eleviStersi, abonamente, currentDate }: DashboardProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedEntriesStudent, setSelectedEntriesStudent] = useState<Student | null>(null);
  const [selectedRenewStudent, setSelectedRenewStudent] = useState<Student | null>(null);
  const [selectedEditStudent, setSelectedEditStudent] = useState<Student | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showDeletedStudents, setShowDeletedStudents] = useState(false);
  const [renewUseToday, setRenewUseToday] = useState(true);
  const [message, setMessage] = useState("");
  const [entriesByStudent, setEntriesByStudent] = useState<Record<number, string[]>>({});
  const [loadingEntriesStudentId, setLoadingEntriesStudentId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return elevi.filter((student) => {
      const state = studentState(student, currentDate);
      const matchesSearch =
        !normalizedSearch ||
        student.nume.toLowerCase().includes(normalizedSearch) ||
        showValue(student.numeParinte).toLowerCase().includes(normalizedSearch) ||
        showValue(student.telefonParinte).toLowerCase().includes(normalizedSearch);

      const matchesSubscription =
        subscriptionId === "all" || String(student.abonament.id) === subscriptionId;

      const matchesStatus =
        status === "all" ||
        (status === "limit" && state.entriesReached) ||
        (status === "expired" && state.expired) ||
        (status === "soon" && state.expiryDays >= 0 && state.expiryDays <= 7);

      return matchesSearch && matchesSubscription && matchesStatus;
    });
  }, [elevi, search, subscriptionId, status, currentDate]);

  const attentionCount = elevi.filter((student) => studentState(student, currentDate).needsAttention).length;

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");

    startTransition(async () => {
      const result = await createStudentAction(new FormData(form));
      setMessage(result.message);

      if (result.ok) {
        form.reset();
        setShowAddStudent(false);
        router.refresh();
      }
    });
  }

  function openRenewStudent(student: Student) {
    setSelectedRenewStudent(student);
    setRenewUseToday(true);
  }

  function openEntriesStudent(student: Student) {
    setSelectedEntriesStudent(student);

    if (entriesByStudent[student.id]) {
      return;
    }

    setLoadingEntriesStudentId(student.id);
    startTransition(async () => {
      const result = await getStudentEntriesAction(student.id);
      setMessage(result.ok ? "" : result.message);

      if (result.ok) {
        setEntriesByStudent((current) => ({
          ...current,
          [student.id]: result.intrari,
        }));
      }

      setLoadingEntriesStudentId(null);
    });
  }

  function forgetEntries(studentId: number) {
    setEntriesByStudent((current) => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });
  }

  function renewStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRenewStudent) {
      return;
    }

    const form = event.currentTarget;
    setMessage("");

    startTransition(async () => {
      const result = await renewStudentAction(selectedRenewStudent.id, new FormData(form));
      setMessage(result.message);

      if (result.ok) {
        form.reset();
        setSelectedRenewStudent(null);
        forgetEntries(selectedRenewStudent.id);
        router.refresh();
      }
    });
  }

  function editStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEditStudent) {
      return;
    }

    const form = event.currentTarget;
    setMessage("");

    startTransition(async () => {
      const result = await updateStudentAction(selectedEditStudent.id, new FormData(form));
      setMessage(result.message);

      if (result.ok) {
        forgetEntries(selectedEditStudent.id);
        setSelectedEditStudent(null);
        router.refresh();
      }
    });
  }

  function renderEntryControl(student: Student) {
    return (
      <div className="entry-control">
        <button
          type="button"
          aria-label={`Sterge ultima intrare pentru ${student.nume}`}
          disabled={isPending || student.intrariFolosite <= 0}
          onClick={() => {
            forgetEntries(student.id);
            runAction(() => removeLastEntryAction(student.id));
          }}
        >
          -
        </button>
        <strong>
          {student.intrariFolosite}/{student.abonament.numarIntrari}
        </strong>
        <button
          type="button"
          aria-label={`Adauga intrare pentru ${student.nume}`}
          disabled={isPending}
          onClick={() => {
            forgetEntries(student.id);
            runAction(() => addEntryAction(student.id));
          }}
        >
          +
        </button>
      </div>
    );
  }

  function renderSignals(student: Student) {
    const state = studentState(student, currentDate);

    return (
      <div className="signals" aria-label="Avertizari">
        {state.entriesReached ? <span className="signal danger">! Limita intrari</span> : null}
        {state.expired ? <span className="signal danger">! Expirat</span> : null}
        {!state.needsAttention && state.expiryDays <= 7 ? (
          <span className="signal warn">Expira curand</span>
        ) : null}
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Bazin Olimpic</p>
          <h1>Elevi si abonamente</h1>
        </div>

        <div className="trainer-box">
          <span>{antrenor}</span>
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              startTransition(async () => {
                await logoutAction();
                window.location.reload();
              })
            }
          >
            Iesire
          </button>
        </div>
      </header>

      <section className="stats-grid" aria-label="Rezumat">
        <article>
          <span>Elevi activi</span>
          <strong>{elevi.length}</strong>
        </article>
        <article className={attentionCount ? "stat-danger" : ""}>
          <span>Cu atentionari</span>
          <strong>{attentionCount}</strong>
        </article>
      </section>

      <section className="toolbar">
        <button type="button" className="ghost-button" onClick={() => setShowDeletedStudents(true)}>
          Elevi stersi ({eleviStersi.length})
        </button>
        <button type="button" className="primary-button" onClick={() => setShowAddStudent(true)}>
          + Adauga elev
        </button>
      </section>

      <section className="filters" aria-label="Filtre">
        <label>
          <span>Cauta</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Elev, parinte sau telefon"
            suppressHydrationWarning
          />
        </label>

        <label>
          <span>Abonament</span>
          <select
            value={subscriptionId}
            onChange={(event) => setSubscriptionId(event.target.value)}
            suppressHydrationWarning
          >
            <option value="all">Toate</option>
            {abonamente.map((abonament) => (
              <option key={abonament.id} value={abonament.id}>
                {abonament.nume}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            suppressHydrationWarning
          >
            <option value="all">Toti</option>
            <option value="limit">Limita intrari</option>
            <option value="soon">Expira in 7 zile</option>
            <option value="expired">Expirat</option>
          </select>
        </label>
      </section>

      {message ? (
        <p className={message.includes("esuat") || message.includes("nu") ? "toast error" : "toast success"}>
          {message}
        </p>
      ) : null}

      <section className="students-section">
        <div className="section-heading">
          <h2>Lista elevi</h2>
          <span>{filteredStudents.length} rezultate</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Elev</th>
                <th>Abonament</th>
                <th>Intrari folosite</th>
                <th>Expira</th>
                <th>Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const state = studentState(student, currentDate);

                return (
                  <tr className={state.needsAttention ? "attention-row" : ""} key={student.id}>
                    <td>
                      <strong>{student.nume}</strong>
                      <span>{showValue(student.numeParinte)}</span>
                      {renderSignals(student)}
                    </td>
                    <td>
                      <strong>{subscriptionLabel(student.abonament, abonamente)}</strong>
                      <span>
                        {student.abonament.numarIntrari} intrari / {student.abonament.valabilitateZile} zile
                      </span>
                    </td>
                    <td>{renderEntryControl(student)}</td>
                    <td>
                      <span
                        className={
                          state.expired ? "badge danger" : state.expiryDays <= 7 ? "badge warn" : "badge"
                        }
                      >
                        {formatDate(state.expiry.toISOString())}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="action-button" onClick={() => setSelectedStudent(student)}>
                          <InfoIcon />
                          Info
                        </button>
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => openEntriesStudent(student)}
                        >
                          <ListIcon />
                          Intrari
                        </button>
                        <button type="button" className="action-button" onClick={() => openRenewStudent(student)}>
                          <RenewIcon />
                          Reinnoieste
                        </button>
                        <button type="button" className="action-button" onClick={() => setSelectedEditStudent(student)}>
                          <EditIcon />
                          Modifica
                        </button>
                        <button
                          type="button"
                          className="action-button danger-button"
                          disabled={isPending}
                          onClick={() => {
                            if (window.confirm(`Stergi elevul ${student.nume}?`)) {
                              runAction(() => deleteStudentAction(student.id));
                            }
                          }}
                        >
                          <TrashIcon />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!filteredStudents.length ? (
            <div className="empty-state">Nu exista elevi pentru filtrele selectate.</div>
          ) : null}
        </div>
      </section>

      {showAddStudent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowAddStudent(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Adauga elev"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Elev nou</p>
                <h2>Adauga elev</h2>
              </div>
              <button type="button" onClick={() => setShowAddStudent(false)}>
                Inchide
              </button>
            </div>

            <form className="student-form" onSubmit={createStudent}>
              <label>
                <span>Nume elev</span>
                <input name="nume" required />
              </label>
              <label>
                <span>Data nasterii</span>
                <input name="data_nasterii" type="date" />
              </label>
              <label>
                <span>Nume parinte</span>
                <input name="nume_parinte" placeholder="-" />
              </label>
              <label>
                <span>Telefon parinte</span>
                <input name="telefon_parinte" inputMode="tel" placeholder="-" />
              </label>
              <label>
                <span>Abonament</span>
                <select name="tip_abonament_id" required defaultValue={abonamente[0]?.id ?? ""}>
                  {abonamente.map((abonament) => (
                    <option key={abonament.id} value={abonament.id}>
                      {abonament.nume}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start abonament</span>
                <input
                  name="data_start_abonament"
                  type="date"
                  required
                  defaultValue={dateInputValue(currentDate)}
                />
              </label>

              <button type="submit" className="primary-button" disabled={isPending}>
                {isPending ? "Se salveaza..." : "Salveaza elev"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {selectedRenewStudent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedRenewStudent(null)}>
          <section
            className="modal compact-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Reinnoieste abonament ${selectedRenewStudent.nume}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Abonament nou</p>
                <h2>Reinnoieste {selectedRenewStudent.nume}</h2>
              </div>
              <button type="button" onClick={() => setSelectedRenewStudent(null)}>
                Inchide
              </button>
            </div>

            <form className="student-form" onSubmit={renewStudent}>
              <label>
                <span>Tip abonament</span>
                <select name="tip_abonament_id" required defaultValue={selectedRenewStudent.abonament.id}>
                  {abonamente.map((abonament) => (
                    <option key={abonament.id} value={abonament.id}>
                      {abonament.nume}
                    </option>
                  ))}
                </select>
              </label>

              <label className="checkbox-label">
                <input
                  name="use_today"
                  type="checkbox"
                  checked={renewUseToday}
                  onChange={(event) => setRenewUseToday(event.target.checked)}
                />
                <span>Data de azi</span>
              </label>

              <label>
                <span>Alta data</span>
                <input
                  name="data_start_abonament"
                  type="date"
                  defaultValue={dateInputValue(currentDate)}
                  disabled={renewUseToday}
                  required={!renewUseToday}
                />
              </label>

              <button type="submit" className="primary-button" disabled={isPending}>
                {isPending ? "Se salveaza..." : "Reinnoieste abonamentul"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {selectedEditStudent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEditStudent(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Modifica ${selectedEditStudent.nume}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Date elev</p>
                <h2>Modifica {selectedEditStudent.nume}</h2>
              </div>
              <button type="button" onClick={() => setSelectedEditStudent(null)}>
                Inchide
              </button>
            </div>

            <form className="student-form" onSubmit={editStudent}>
              <label>
                <span>Nume elev</span>
                <input name="nume" required defaultValue={selectedEditStudent.nume} />
              </label>
              <label>
                <span>Data nasterii</span>
                <input
                  name="data_nasterii"
                  type="date"
                  defaultValue={dateInputValue(selectedEditStudent.dataNasterii)}
                />
              </label>
              <label>
                <span>Nume parinte</span>
                <input name="nume_parinte" placeholder="-" defaultValue={selectedEditStudent.numeParinte} />
              </label>
              <label>
                <span>Telefon parinte</span>
                <input
                  name="telefon_parinte"
                  inputMode="tel"
                  placeholder="-"
                  defaultValue={selectedEditStudent.telefonParinte}
                />
              </label>
              <label>
                <span>Abonament</span>
                <select name="tip_abonament_id" required defaultValue={selectedEditStudent.abonament.id}>
                  {abonamente.map((abonament) => (
                    <option key={abonament.id} value={abonament.id}>
                      {abonament.nume}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start abonament</span>
                <input
                  name="data_start_abonament"
                  type="date"
                  required
                  defaultValue={dateInputValue(selectedEditStudent.dataStartAbonament)}
                />
              </label>

              <button type="submit" className="primary-button" disabled={isPending}>
                {isPending ? "Se salveaza..." : "Salveaza modificarile"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {showDeletedStudents ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowDeletedStudents(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Elevi stersi"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Arhiva temporara</p>
                <h2>Elevi stersi</h2>
              </div>
              <button type="button" onClick={() => setShowDeletedStudents(false)}>
                Inchide
              </button>
            </div>

            {eleviStersi.length ? (
              <div className="deleted-table-wrap">
                <table className="deleted-table">
                  <thead>
                    <tr>
                      <th>Elev</th>
                      <th>Abonament</th>
                      <th>Sters</th>
                      <th>Pastrat pana la</th>
                      <th>Actiune</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eleviStersi.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <strong>{student.nume}</strong>
                          <span>{showValue(student.numeParinte)}</span>
                        </td>
                        <td>{subscriptionLabel(student.abonament, abonamente)}</td>
                        <td>{formatDate(student.dataStergere)}</td>
                        <td>{formatDate(student.dataExpirarePastrare)}</td>
                        <td>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={isPending}
                            onClick={() => runAction(() => restoreStudentAction(student.id))}
                          >
                            Readu elevul
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="deleted-mobile-list">
                  {eleviStersi.map((student) => (
                    <article className="student-card" key={student.id}>
                      <div className="student-card-head">
                        <div>
                          <strong>{student.nume}</strong>
                          <span>{showValue(student.numeParinte)}</span>
                        </div>
                      </div>
                      <div className="student-card-meta">
                        <span>{subscriptionLabel(student.abonament, abonamente)}</span>
                        <span>Sters: {formatDate(student.dataStergere)}</span>
                        <span>Pastrat pana la: {formatDate(student.dataExpirarePastrare)}</span>
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={isPending}
                        onClick={() => runAction(() => restoreStudentAction(student.id))}
                      >
                        Readu elevul
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">Nu exista elevi stersi.</div>
            )}
          </section>
        </div>
      ) : null}

      {selectedEntriesStudent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEntriesStudent(null)}>
          <section
            className="modal compact-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Intrari ${selectedEntriesStudent.nume}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Istoric intrari</p>
                <h2>{selectedEntriesStudent.nume}</h2>
              </div>
              <button type="button" onClick={() => setSelectedEntriesStudent(null)}>
                Inchide
              </button>
            </div>

            {loadingEntriesStudentId === selectedEntriesStudent.id ? (
              <div className="empty-state">Se incarca intrarile...</div>
            ) : (entriesByStudent[selectedEntriesStudent.id] ?? []).length ? (
              <ol className="entries-list">
                {(entriesByStudent[selectedEntriesStudent.id] ?? []).map((intrare, index, intrari) => (
                  <li key={`${selectedEntriesStudent.id}-${intrare}`}>
                    <strong>Intrarea {intrari.length - index}</strong>
                    <span>{formatDateTime(intrare)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-state">Elevul nu are intrari pe abonamentul curent.</div>
            )}
          </section>
        </div>
      ) : null}

      {selectedStudent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedStudent(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Info ${selectedStudent.nume}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Fisa elev</p>
                <h2>{selectedStudent.nume}</h2>
              </div>
              <button type="button" onClick={() => setSelectedStudent(null)}>
                Inchide
              </button>
            </div>

            <dl className="details-grid">
              <div>
                <dt>Data nasterii</dt>
                <dd>{formatDate(selectedStudent.dataNasterii)}</dd>
              </div>
              <div>
                <dt>Parinte</dt>
                <dd>{showValue(selectedStudent.numeParinte)}</dd>
              </div>
              <div>
                <dt>Telefon</dt>
                <dd>{showValue(selectedStudent.telefonParinte)}</dd>
              </div>
              <div>
                <dt>Abonament</dt>
                <dd>{subscriptionLabel(selectedStudent.abonament, abonamente)}</dd>
              </div>
              <div>
                <dt>Start abonament</dt>
                <dd>{formatDate(selectedStudent.dataStartAbonament)}</dd>
              </div>
              <div>
                <dt>Intrari folosite</dt>
                <dd>
                  {selectedStudent.intrariFolosite}/{selectedStudent.abonament.numarIntrari}
                </dd>
              </div>
              <div>
                <dt>Expira</dt>
                <dd>{formatDate(expiresAt(selectedStudent).toISOString())}</dd>
              </div>
              <div>
                <dt>Ultima intrare</dt>
                <dd>{formatDateTime(selectedStudent.dataUltimeiIntrari)}</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </main>
  );
}
