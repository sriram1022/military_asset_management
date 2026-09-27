import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays,
  Check, ChevronDown, CircleAlert, ClipboardList, Crosshair, FileClock, LayoutDashboard,
  LogOut, Menu, PackagePlus, Plus, Search, Shield, ShieldCheck, Truck, UserRound,
  Users, WalletCards, X
} from "lucide-react";
import { api } from "./api";

const today = new Date().toLocaleDateString("en-CA");
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString("en-CA");
const navItems = [
  { id: "dashboard", label: "Situation room", icon: LayoutDashboard, roles: ["Admin", "BaseCommander", "LogisticsOfficer"] },
  { id: "inventory", label: "Inventory", icon: Boxes, roles: ["Admin", "BaseCommander"] },
  { id: "purchases", label: "Purchases", icon: PackagePlus, roles: ["Admin", "BaseCommander", "LogisticsOfficer"] },
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight, roles: ["Admin", "BaseCommander", "LogisticsOfficer"] },
  { id: "assignments", label: "Assignments", icon: UserRound, roles: ["Admin", "BaseCommander"] },
  { id: "expenditures", label: "Expenditures", icon: Activity, roles: ["Admin", "BaseCommander"] },
  { id: "assets", label: "Equipment register", icon: Crosshair, roles: ["Admin", "BaseCommander"] },
  { id: "bases", label: "Bases", icon: Shield, roles: ["Admin"] },
  { id: "users", label: "User access", icon: Users, roles: ["Admin"] },
  { id: "audit-logs", label: "Audit trail", icon: FileClock, roles: ["Admin"] }
];

const titles = {
  dashboard: ["Situation room", "Readiness at a glance"],
  inventory: ["Inventory", "Current holdings by installation"],
  purchases: ["Purchases", "Inbound equipment and procurement history"],
  transfers: ["Transfers", "Equipment moving between installations"],
  assignments: ["Assignments", "Issued equipment and assigned personnel"],
  expenditures: ["Expenditures", "Used, damaged, destroyed, or expired stock"],
  assets: ["Equipment register", "Master catalog of managed equipment"],
  bases: ["Bases", "Installations in the network"],
  users: ["User access", "People and permissions across the network"],
  "audit-logs": ["Audit trail", "A time-stamped record of system activity"]
};

const pageConfig = {
  inventory: { endpoint: "/inventory", result: "inventory", create: "opening", title: "Stock on hand", empty: "No stock has been recorded for these filters." },
  purchases: { endpoint: "/purchases", result: "purchases", create: "purchase", title: "Purchase history", empty: "No purchases in this period." },
  transfers: { endpoint: "/transfers", result: "transfers", create: "transfer", title: "Transfer history", empty: "No transfers in this period." },
  assignments: { endpoint: "/assignments", result: "assignments", create: "assignment", title: "Assignment register", empty: "No assignments in this period." },
  expenditures: { endpoint: "/expenditures", result: "expenditures", create: "expenditure", title: "Expenditure register", empty: "No expenditures in this period." },
  assets: { endpoint: "/assets", result: "assets", create: "asset", title: "Equipment catalog", empty: "No equipment has been added." },
  bases: { endpoint: "/bases", result: "bases", create: "base", title: "Installation directory", empty: "No bases have been added." },
  users: { endpoint: "/auth/users", result: "users", create: "user", title: "Authorized personnel", empty: "No user accounts have been created." },
  "audit-logs": { endpoint: "/audit-logs", result: "auditLogs", create: null, title: "Recent activity", empty: "No audit records yet." }
};

const columns = {
  inventory: ["Equipment", "Type", "Base", "Opening stock", "Available", "Updated"],
  purchases: ["Equipment", "Base", "Quantity", "Supplier", "Date", "Added by"],
  transfers: ["Equipment", "Movement", "Quantity", "Date", "Initiated by", "Remarks"],
  assignments: ["Equipment", "Assigned to", "Quantity", "Date", "Assigned by", "Remarks"],
  expenditures: ["Equipment", "Reason", "Quantity", "Date", "Recorded by", "Remarks"],
  assets: ["Equipment", "Type", "Unit", "Description", "Added"],
  bases: ["Base", "Location", "Added"],
  users: ["Name", "Email", "Role", "Assigned base", "Added"],
  "audit-logs": ["Time", "User", "Action", "Module", "Description"]
};

function savedSession() {
  try {
    return JSON.parse(localStorage.getItem("fieldstock-session") || "null");
  } catch {
    return null;
  }
}

function dateLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}

function dateTimeLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function label(value) {
  if (!value) return "—";
  if (typeof value === "object") return value.name || value.email || "—";
  return String(value);
}

function recordCells(page, row) {
  const equipment = label(row.assetId);
  const base = label(row.baseId);
  switch (page) {
    case "inventory": return [equipment, row.assetId?.type, base, row.openingBalance, row.currentStock, dateTimeLabel(row.lastUpdated)];
    case "purchases": return [equipment, base, row.quantity, row.supplier || "—", dateLabel(row.purchaseDate), label(row.addedBy)];
    case "transfers": return [equipment, `${label(row.fromBaseId)} → ${label(row.toBaseId)}`, row.quantity, dateLabel(row.transferDate), label(row.initiatedBy), row.remarks || "—"];
    case "assignments": return [equipment, row.assignedTo, row.quantity, dateLabel(row.assignmentDate), label(row.assignedBy), row.remarks || "—"];
    case "expenditures": return [equipment, row.reason, row.quantity, dateLabel(row.expenditureDate), label(row.expendedBy), row.remarks || "—"];
    case "assets": return [row.name, row.type, row.unit, row.description || "—", dateLabel(row.createdAt)];
    case "bases": return [row.name, row.location, dateLabel(row.createdAt)];
    case "users": return [row.name, row.email, row.role, label(row.baseId), dateLabel(row.createdAt)];
    case "audit-logs": return [dateTimeLabel(row.timestamp), label(row.userId), row.action, row.module, row.description];
    default: return [];
  }
}

function Metric({ label: metricLabel, value, note, icon: Icon, tone, onClick }) {
  return (
    <button className={`metric metric-${tone || "plain"} ${onClick ? "metric-clickable" : ""}`} onClick={onClick} disabled={!onClick}>
      <span className="metric-head"><span>{metricLabel}</span><Icon size={17} strokeWidth={1.8} /></span>
      <strong>{Number(value || 0).toLocaleString()}</strong>
      <span className="metric-note">{note}</span>
    </button>
  );
}

function Field({ field, value, onChange, options }) {
  const common = { id: field.name, name: field.name, value: value ?? "", onChange, required: field.required !== false };
  return (
    <label className="form-field" htmlFor={field.name}>
      <span>{field.label}</span>
      {field.options ? (
        <select {...common}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
        </select>
      ) : field.kind === "textarea" ? (
        <textarea {...common} rows="3" placeholder={field.placeholder || "Optional"} />
      ) : (
        <input {...common} type={field.kind || "text"} min={field.kind === "number" ? 1 : undefined} step={field.kind === "number" ? 1 : undefined} placeholder={field.placeholder} />
      )}
    </label>
  );
}

function EntryModal({ kind, bases, assets, user, token, onClose, onCreated }) {
  const fields = useMemo(() => {
    const baseOptions = bases.map((base) => ({ value: base._id, label: base.name }));
    const assetOptions = assets.map((asset) => ({ value: asset._id, label: `${asset.name} · ${asset.type}` }));
    const assignedBase = user.role === "Admin" ? [] : [];
    const chooseBase = { name: "baseId", label: "Base", options: baseOptions };
    const chooseAsset = { name: "assetId", label: "Equipment", options: assetOptions };
    const quantity = { name: "quantity", label: "Quantity", kind: "number" };
    const date = { name: "purchaseDate", label: "Date", kind: "date", required: false };
    const remarks = { name: "remarks", label: "Remarks", kind: "textarea", required: false };
    switch (kind) {
      case "purchase": return [chooseAsset, ...(user.role === "Admin" ? [chooseBase] : []), quantity, date, { name: "supplier", label: "Supplier", required: false }, remarks];
      case "transfer": return [chooseAsset, ...(user.role === "Admin" ? [{ name: "fromBaseId", label: "From base", options: baseOptions }] : []), { name: "toBaseId", label: "To base", options: baseOptions }, quantity, { name: "transferDate", label: "Transfer date", kind: "date", required: false }, remarks];
      case "assignment": return [chooseAsset, ...(user.role === "Admin" ? [chooseBase] : []), quantity, { name: "assignedTo", label: "Issued to" }, { name: "assignmentDate", label: "Assignment date", kind: "date", required: false }, remarks];
      case "expenditure": return [chooseAsset, ...(user.role === "Admin" ? [chooseBase] : []), quantity, { name: "reason", label: "Reason", options: ["Used", "Damaged", "Destroyed", "Expired"] }, { name: "expenditureDate", label: "Date", kind: "date", required: false }, remarks];
      case "opening": return [chooseAsset, ...(user.role === "Admin" ? [chooseBase] : []), { name: "quantity", label: "Opening quantity", kind: "number" }];
      case "asset": return [{ name: "name", label: "Equipment name" }, { name: "type", label: "Type", options: ["Weapon", "Vehicle", "Ammunition"] }, { name: "unit", label: "Unit", options: ["Piece", "Box", "Vehicle"] }, { name: "description", label: "Description", kind: "textarea", required: false }];
      case "base": return [{ name: "name", label: "Base name" }, { name: "location", label: "Location" }];
      case "user": return [{ name: "name", label: "Full name" }, { name: "email", label: "Email", kind: "email" }, { name: "password", label: "Temporary password", kind: "password", placeholder: "At least 12 characters" }, { name: "role", label: "Role", options: ["Admin", "BaseCommander", "LogisticsOfficer"] }, { name: "baseId", label: "Assigned base", options: [{ value: "__none__", label: "No base (Admin only)" }, ...baseOptions], required: false }];
      default: return assignedBase;
    }
  }, [kind, bases, assets, user]);

  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const config = {
    purchase: ["/purchases", "Purchase recorded"],
    transfer: ["/transfers", "Transfer dispatched"],
    assignment: ["/assignments", "Assignment recorded"],
    expenditure: ["/expenditures", "Expenditure recorded"],
    opening: ["/inventory/opening-balance", "Opening stock added"],
    asset: ["/assets", "Equipment added"],
    base: ["/bases", "Base added"],
    user: ["/auth/users", "User created"]
  }[kind];

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = { ...values };
    if (user.role !== "Admin" && ["purchase", "transfer", "assignment", "expenditure", "opening"].includes(kind)) {
      body.baseId = user.baseId;
      if (kind === "transfer") body.fromBaseId = user.baseId;
    }
    if (kind === "user" && body.baseId === "__none__") body.baseId = null;
    try {
      await api(config[0], { token, method: "POST", body: JSON.stringify(body) });
      onCreated(config[1]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="dialog entry-dialog" onSubmit={submit}>
        <div className="dialog-head"><div><span className="eyebrow">FIELD ENTRY</span><h2>{entryTitle(kind)}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="form-grid">{fields.map((field) => <Field key={field.name} field={field} value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />)}</div>
        {error && <p className="form-error"><CircleAlert size={15} />{error}</p>}
        <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Record entry"}<ArrowRight size={15} /></button></div>
      </form>
    </div>
  );
}

function entryTitle(kind) {
  return ({ purchase: "Record purchase", transfer: "Dispatch transfer", assignment: "Issue equipment", expenditure: "Record expenditure", opening: "Set opening stock", asset: "Add equipment", base: "Add base", user: "Create user" })[kind] || "New entry";
}

function MovementModal({ data, filters, bases, token, onClose }) {
  const [records, setRecords] = useState({ purchases: [], transfers: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate });
    if (filters.baseId) params.set("baseId", filters.baseId);
    if (filters.type) params.set("type", filters.type);
    Promise.all([api(`/purchases?${params}`, { token }), api(`/transfers?${params}`, { token })])
      .then(([purchases, transfers]) => setRecords({ purchases: purchases.purchases, transfers: transfers.transfers }))
      .catch((requestError) => setError(requestError.message));
  }, [filters, token]);

  const inbound = records.transfers.filter((row) => !filters.baseId || row.toBaseId?._id === filters.baseId);
  const outbound = records.transfers.filter((row) => !filters.baseId || row.fromBaseId?._id === filters.baseId);
  const sections = [
    ["Purchases", records.purchases, (row) => `${label(row.assetId)} · ${label(row.baseId)}`, "purchaseDate"],
    ["Transfers in", inbound, (row) => `${label(row.assetId)} · ${label(row.fromBaseId)} → ${label(row.toBaseId)}`, "transferDate"],
    ["Transfers out", outbound, (row) => `${label(row.assetId)} · ${label(row.fromBaseId)} → ${label(row.toBaseId)}`, "transferDate"]
  ];
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog movement-dialog">
        <div className="dialog-head"><div><span className="eyebrow">MOVEMENT DETAIL</span><h2>Net movement <b className={data.metrics?.netMovement < 0 ? "negative" : "positive"}>{data.metrics?.netMovement > 0 ? "+" : ""}{data.metrics?.netMovement || 0}</b></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <p className="dialog-subtitle">{dateLabel(filters.startDate)} — {dateLabel(filters.endDate)}{filters.baseId ? ` · ${label(bases.find((base) => base._id === filters.baseId))}` : " · All bases"}</p>
        {error && <p className="form-error"><CircleAlert size={15} />{error}</p>}
        <div className="movement-columns">{sections.map(([heading, rows, describe, dateKey]) => <section className="movement-section" key={heading}><div className="movement-section-head"><h3>{heading}</h3><strong>{rows.reduce((total, row) => total + row.quantity, 0).toLocaleString()} <small>units</small></strong></div>{rows.length ? rows.slice(0, 5).map((row) => <div className="movement-row" key={row._id}><div><span>{describe(row)}</span><small>{dateLabel(row[dateKey])}</small></div><b>+{row.quantity}</b></div>) : <p className="empty-inline">No activity recorded</p>}</section>)}</div>
        <div className="dialog-actions"><button className="button button-quiet" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function DataTable({ page, rows, search, empty, onCreate, role }) {
  const filtered = rows.filter((row) => JSON.stringify(recordCells(page, row)).toLowerCase().includes(search.toLowerCase()));
  const headings = columns[page] || [];
  return (
    <section className="table-panel">
      <div className="table-top"><div><h2>{pageConfig[page]?.title}</h2><span>{filtered.length} {filtered.length === 1 ? "record" : "records"}</span></div>{pageConfig[page]?.create && canCreate(page, role) && <button className="button button-primary button-small" onClick={onCreate}><Plus size={16} />{createLabel(page)}</button>}</div>
      {filtered.length ? <div className="table-scroll"><table><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row._id}>{recordCells(page, row).map((value, index) => <td key={`${row._id}-${index}`}>{page === "audit-logs" && index === 2 ? <span className={`tag tag-${String(value).toLowerCase()}`}>{value}</span> : page === "assets" && index === 1 ? <span className="tag tag-type">{value}</span> : value ?? "—"}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-mark"><Boxes size={21} /></div><strong>Nothing on the board</strong><span>{search ? "Try a different search." : empty}</span>{pageConfig[page]?.create && canCreate(page, role) && <button className="button button-outline button-small" onClick={onCreate}><Plus size={15} />{createLabel(page)}</button>}</div>}
    </section>
  );
}

function canCreate(page, role) {
  if (page === "audit-logs") return false;
  if (page === "assets" || page === "bases") return role === "Admin";
  if (page === "assignments" || page === "expenditures" || page === "inventory") return role !== "LogisticsOfficer";
  return true;
}

function createLabel(page) {
  return ({ inventory: "Opening stock", purchases: "New purchase", transfers: "New transfer", assignments: "Issue equipment", expenditures: "Record loss", assets: "Add equipment", bases: "Add base", users: "Create user" })[page] || "New entry";
}

function Dashboard({ dashboard, inventory, activity, role, onMovement, onCreate }) {
  const metrics = dashboard?.metrics || {};
  const lowStock = inventory.filter((row) => row.currentStock <= 5).slice(0, 4);
  return (
    <>
      <div className="dashboard-intro"><div><span className="eyebrow">OPERATIONAL OVERVIEW</span><h2>Good day, {activity.user?.name?.split(" ")[0] || "commander"}.</h2><p>Here’s the equipment picture across your command.</p></div><div className="readiness-stamp"><span className="pulse" />SYSTEMS NOMINAL <span>LIVE</span></div></div>
      <div className="metric-grid">
        {role === "LogisticsOfficer" ? <>
          <Metric label="Purchases" value={dashboard?.movement?.purchases} note="Received this period" icon={PackagePlus} tone="sage" onClick={() => activity.setPage("purchases")} />
          <Metric label="Transfers in" value={dashboard?.movement?.transfersIn} note="Moved to this base" icon={ArrowDownLeft} tone="blue" onClick={() => activity.setPage("transfers")} />
          <Metric label="Transfers out" value={dashboard?.movement?.transfersOut} note="Moved from this base" icon={ArrowUpRight} tone="coral" onClick={() => activity.setPage("transfers")} />
        </> : <>
          <Metric label="Opening balance" value={metrics.openingBalance} note="At the start of this period" icon={WalletCards} tone="sage" />
          <Metric label="Closing balance" value={metrics.closingBalance} note="Available after all activity" icon={Boxes} tone="amber" />
          <Metric label="Net movement" value={metrics.netMovement} note="Purchases + in − out" icon={ArrowLeftRight} tone="coral" onClick={onMovement} />
          <Metric label="Assigned" value={metrics.assigned} note="Issued to personnel or units" icon={Users} tone="blue" />
          <Metric label="Expended" value={metrics.expended} note="Used, damaged, or expired" icon={Activity} tone="plain" />
        </>}
      </div>
      <div className="dashboard-lower">
        {role === "LogisticsOfficer" ? <section className="table-panel dashboard-stock"><div className="table-top"><div><h2>Movement register</h2><span>Activity this period</span></div></div><div className="stock-row"><span className="stock-icon"><PackagePlus size={16} /></span><div className="stock-name"><strong>Purchases received</strong><small>Recorded for your base</small></div><button className="text-button" onClick={() => activity.setPage("purchases")}>View <ArrowRight size={14} /></button></div><div className="stock-row"><span className="stock-icon"><ArrowLeftRight size={16} /></span><div className="stock-name"><strong>Base transfers</strong><small>Inbound and outbound movements</small></div><button className="text-button" onClick={() => activity.setPage("transfers")}>View <ArrowRight size={14} /></button></div></section> : <section className="table-panel dashboard-stock"><div className="table-top"><div><h2>Stock watch</h2><span>{inventory.length} tracked lines</span></div><button className="text-button" onClick={() => activity.setPage("inventory")}>View inventory <ArrowRight size={14} /></button></div>
          {lowStock.length ? lowStock.map((row) => <div className="stock-row" key={row._id}><span className="stock-icon"><PackagePlus size={16} /></span><div className="stock-name"><strong>{row.assetId?.name}</strong><small>{label(row.baseId)} · {row.assetId?.type}</small></div><span className={`stock-level ${row.currentStock === 0 ? "level-zero" : ""}`}>{row.currentStock} <small>{row.assetId?.unit?.toLowerCase()}s</small></span></div>) : <div className="empty-inline">No stock lines are at or below 5 units.</div>}
        </section>}
        <section className="briefing-panel"><div className="briefing-top"><span className="eyebrow">QUICK ACTIONS</span><span className="briefing-icon"><ClipboardList size={18} /></span></div><h2>Keep the ledger current.</h2><p>Record a receipt, coordinate a movement, or issue equipment to a unit.</p><div className="quick-actions"><button onClick={() => onCreate("purchase")}><PackagePlus size={16} />Purchase<ArrowRight size={14} /></button><button onClick={() => onCreate("transfer")}><Truck size={16} />Transfer<ArrowRight size={14} /></button>{role !== "LogisticsOfficer" && <button onClick={() => onCreate("assignment")}><UserRound size={16} />Assignment<ArrowRight size={14} /></button>}</div></section>
      </div>
      <section className="movement-strip"><div><span className="eyebrow">PERIOD MOVEMENT</span><h2>Where stock moved</h2></div><div className="movement-stat"><ArrowDownLeft size={17} /><span>Purchased</span><strong>+{dashboard?.movement?.purchases || 0}</strong></div><div className="movement-stat"><ArrowDownLeft size={17} /><span>Transferred in</span><strong>+{dashboard?.movement?.transfersIn || 0}</strong></div><div className="movement-stat movement-out"><ArrowUpRight size={17} /><span>Transferred out</span><strong>−{dashboard?.movement?.transfersOut || 0}</strong></div><button className="icon-button movement-open" onClick={onMovement} aria-label="Open movement detail"><ArrowRight size={18} /></button></section>
    </>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { onLogin(await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return (
    <main className="login-screen"><div className="login-art"><div className="art-grid" /><div className="art-coordinate">37°14′N&nbsp;&nbsp; 115°48′W</div><div className="art-ring art-ring-one" /><div className="art-ring art-ring-two" /><div className="art-crosshair">＋</div><div className="art-caption"><span className="eyebrow">FIELDSTOCK / OPERATIONS</span><h1>Every asset.<br /><em>Accounted for.</em></h1><p>A clear picture of what you hold, where it is, and where it’s going.</p></div><div className="art-foot"><span>ASSET CONTROL SYSTEM</span><span>SECURE NETWORK <ShieldCheck size={13} /></span></div></div><div className="login-side"><div className="login-brand"><span className="brand-mark"><Crosshair size={18} /></span>FIELDSTOCK</div><form className="login-form" onSubmit={submit}><span className="eyebrow">SECURE ACCESS</span><h2>Welcome back.</h2><p>Sign in with your assigned credentials.</p><label className="form-field"><span>Email address</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@unit.gov" /></label><label className="form-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" /></label>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<button className="button button-primary login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to system"}<ArrowRight size={16} /></button><div className="login-security"><ShieldCheck size={15} /><span>Encrypted session · Role-based access</span></div></form><div className="login-footer"><span>FIELDSTOCK SYSTEMS</span><span>AUTHORIZED PERSONNEL ONLY</span></div></div></main>
  );
}

export default function App() {
  const [session, setSession] = useState(savedSession);
  const [page, setPage] = useState("dashboard");
  const [filters, setFilters] = useState({ startDate: startOfMonth, endDate: today, baseId: "", type: "" });
  const [catalog, setCatalog] = useState({ bases: [], assets: [] });
  const [content, setContent] = useState({ rows: [], inventory: [], dashboard: null, activity: {} });
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);

  function logout() {
    localStorage.removeItem("fieldstock-session");
    setSession(null); setPage("dashboard"); setContent({ rows: [], inventory: [], dashboard: null, activity: {} });
  }

  useEffect(() => {
    window.addEventListener("fieldstock:unauthorized", logout);
    return () => window.removeEventListener("fieldstock:unauthorized", logout);
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    api("/auth/me", { token: session.token }).then(({ user }) => {
      const next = { ...session, user };
      setSession(next); localStorage.setItem("fieldstock-session", JSON.stringify(next));
    }).catch(() => logout());
    Promise.all([api("/bases", { token: session.token }), api("/assets", { token: session.token })])
      .then(([bases, assets]) => setCatalog({ bases: bases.bases, assets: assets.assets }))
      .catch((requestError) => setError(requestError.message));
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token || !session.user) return;
    let active = true;
    async function load() {
      setBusy(true); setError("");
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.baseId) params.set("baseId", filters.baseId);
      if (filters.type) params.set("type", filters.type);
      try {
        if (page === "dashboard") {
          const requests = [
            api(`/dashboard?${params}`, { token: session.token }),
            session.user.role === "LogisticsOfficer" ? Promise.resolve({ inventory: [] }) : api(`/inventory?${new URLSearchParams({ ...(filters.baseId && session.user.role === "Admin" ? { baseId: filters.baseId } : {}), ...(filters.type ? { type: filters.type } : {}) })}`, { token: session.token }),
            api(`/purchases?${params}`, { token: session.token }),
            api(`/transfers?${params}`, { token: session.token })
          ];
          if (session.user.role !== "LogisticsOfficer") {
            requests.push(api(`/assignments?${params}`, { token: session.token }), api(`/expenditures?${params}`, { token: session.token }));
          }
          const values = await Promise.all(requests);
          if (!active) return;
          setContent({ dashboard: values[0], inventory: values[1].inventory, activity: { user: session.user }, rows: values.slice(2) });
        } else {
          const config = pageConfig[page];
          const query = ["assets", "bases", "inventory", "audit-logs"].includes(page) ? "" : `?${params}`;
          const result = await api(`${config.endpoint}${query}`, { token: session.token });
          if (!active) return;
          setContent((previous) => ({ ...previous, rows: result[config.result] || [], activity: { user: session.user } }));
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setBusy(false);
      }
    }
    load();
    return () => { active = false; };
  }, [session?.token, session?.user?._id, page, filters, refresh]);

  function handleLogin(result) {
    const next = { token: result.token, user: result.user };
    localStorage.setItem("fieldstock-session", JSON.stringify(next));
    setSession(next); setPage("dashboard");
  }

  function handleCreated(message) {
    setModal(null); setToast(message); setRefresh((value) => value + 1);
    api("/bases", { token: session.token }).then(({ bases }) => setCatalog((current) => ({ ...current, bases }))).catch(() => {});
    api("/assets", { token: session.token }).then(({ assets }) => setCatalog((current) => ({ ...current, assets }))).catch(() => {});
    window.setTimeout(() => setToast(""), 3200);
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(session?.user?.role));
  const pageInfo = titles[page] || titles.dashboard;
  const pageRecordConfig = pageConfig[page];
  const roleLabel = session?.user?.role === "BaseCommander" ? "BASE COMMANDER" : session?.user?.role === "LogisticsOfficer" ? "LOGISTICS OFFICER" : "SYSTEM ADMINISTRATOR";
  if (!session?.token) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><span className="brand-mark"><Crosshair size={18} /></span><span>FIELDSTOCK<small>ASSET OPERATIONS</small></span></div>
        <div className="sidebar-section-label">COMMAND</div>
        <nav className="side-nav">{visibleItems.slice(0, 6).map(({ id, label: itemLabel, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? "nav-active" : ""}`} onClick={() => { setPage(id); setMobileNav(false); }}><Icon size={17} strokeWidth={1.8} /><span>{itemLabel}</span>{page === id && <span className="nav-indicator" />}</button>)}</nav>
        {(session.user.role === "Admin") && <><div className="sidebar-section-label sidebar-secondary">SYSTEM</div><nav className="side-nav">{visibleItems.slice(6).map(({ id, label: itemLabel, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? "nav-active" : ""}`} onClick={() => { setPage(id); setMobileNav(false); }}><Icon size={17} strokeWidth={1.8} /><span>{itemLabel}</span>{page === id && <span className="nav-indicator" />}</button>)}</nav></>}
        <div className="sidebar-bottom"><div className="network-status"><span className="pulse" /><div><strong>Network online</strong><small>All systems operational</small></div><Check size={15} /></div><button className="profile-row" onClick={logout}><span className="avatar">{session.user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span className="profile-meta"><strong>{session.user.name}</strong><small>{roleLabel}</small></span><LogOut size={16} /></button></div>
      </aside>
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={19} /></button><div className="breadcrumb"><span>OPERATIONS</span><ArrowRight size={13} /><strong>{pageInfo[0]}</strong></div><div className="topbar-right"><span className="today-label"><CalendarDays size={15} />{new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span><span className="avatar avatar-small">{session.user.name.slice(0, 1).toUpperCase()}</span></div></header>
        <div className="content-area"><div className="page-heading"><div><span className="eyebrow">{page === "dashboard" ? "FIELD OPERATIONS / OVERVIEW" : "FIELD OPERATIONS / RECORDS"}</span><h1>{pageInfo[0]}</h1><p>{pageInfo[1]}</p></div>{page === "dashboard" && <button className="button button-primary" onClick={() => setModal({ kind: "purchase" })}><Plus size={16} />Record movement</button>}</div>
          <div className="filter-bar"><div className="filter-heading"><span>VIEW</span><ChevronDown size={14} /></div><label className="filter-field"><span>From</span><input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></label><label className="filter-field"><span>To</span><input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></label>{session.user.role === "Admin" && <label className="filter-field filter-select"><span>Installation</span><select value={filters.baseId} onChange={(event) => setFilters({ ...filters, baseId: event.target.value })}><option value="">All bases</option>{catalog.bases.map((base) => <option key={base._id} value={base._id}>{base.name}</option>)}</select></label>}<label className="filter-field filter-select"><span>Equipment type</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option>Weapon</option><option>Vehicle</option><option>Ammunition</option></select></label>{page !== "dashboard" && <label className="table-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></label>}</div>
          {error && <div className="error-banner"><CircleAlert size={16} />{error}<button onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
          {busy && <div className="loading-line"><span />Updating operational picture</div>}
          {page === "dashboard" ? <Dashboard dashboard={content.dashboard} inventory={content.inventory} activity={{ ...content, setPage }} role={session.user.role} onMovement={() => setModal({ kind: "movement" })} onCreate={(kind) => setModal({ kind })} /> : <DataTable page={page} rows={content.rows} search={search} empty={pageRecordConfig?.empty || "No records found."} role={session.user.role} onCreate={() => setModal({ kind: pageRecordConfig.create })} />}
          <footer className="content-footer"><span>FIELDSTOCK <b>·</b> CONTROLLED ASSET REGISTER</span><span>SESSION AUTHENTICATED <ShieldCheck size={13} /></span></footer>
        </div>
      </main>
      {modal?.kind === "movement" ? <MovementModal data={content.dashboard || {}} filters={filters} bases={catalog.bases} token={session.token} onClose={() => setModal(null)} /> : modal && <EntryModal kind={modal.kind} bases={catalog.bases} assets={catalog.assets} user={session.user} token={session.token} onClose={() => setModal(null)} onCreated={handleCreated} />}
      {toast && <div className="toast"><span><Check size={16} /></span>{toast}</div>}
    </div>
  );
}