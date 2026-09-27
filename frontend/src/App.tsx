import { useEffect, useMemo, useState } from "react";
import { Activity, Box, Database, Droplets, Link as LinkIcon, LogOut, QrCode, Thermometer, Wallet, AlertTriangle } from "lucide-react";
import { api } from "./api";
import { connectWallet } from "./wallet";
import { QRCodeCard } from "./components/QRCodeCard";
import { QRScanner } from "./components/QRScanner";
import { TempChart } from "./components/TempChart";

type User = { id: string; email: string; name: string; role: string };

const demo = {
  ADMIN: ["admin@bloodchain.local", "Admin123!"],
  BLOOD_BANK: ["bank@bloodchain.local", "Bank123!"],
  HOSPITAL: ["hospital@bloodchain.local", "Hospital123!"],
  TRANSPORT: ["transport@bloodchain.local", "Transport123!"]
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [login, setLogin] = useState({ email: demo.BLOOD_BANK[0], password: demo.BLOOD_BANK[1] });
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [verifyId, setVerifyId] = useState("BLD-DEMO-001");
  const [verification, setVerification] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [d, u, r, dl] = await Promise.all([
        api.dashboard(), api.units(), api.requests(), api.deliveries()
      ]);
      setData(d); setUnits(u); setRequests(r); setDeliveries(dl);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("bloodchain_token");
    const saved = localStorage.getItem("bloodchain_user");
    if (token && saved) {
      setUser(JSON.parse(saved));
      refresh();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const ws = new WebSocket((import.meta.env.VITE_WS_URL || "ws://localhost:4000/ws"));
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.event === "temperature") refresh();
    };
    return () => ws.close();
  }, [user]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await api.login(login.email, login.password);
      localStorage.setItem("bloodchain_token", result.token);
      localStorage.setItem("bloodchain_user", JSON.stringify(result.user));
      setUser(result.user);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand"><Droplets /> BloodChain</div>
          <p className="muted">Traceable blood logistics with blockchain + IoT.</p>
          <form onSubmit={doLogin}>
            <label>Email<input value={login.email} onChange={e => setLogin({...login, email:e.target.value})}/></label>
            <label>Password<input type="password" value={login.password} onChange={e => setLogin({...login, password:e.target.value})}/></label>
            <button className="primary">Sign in</button>
          </form>
          <div className="demo-grid">
            {Object.entries(demo).map(([role, values]) => (
              <button key={role} className="secondary" onClick={() => setLogin({email:values[0],password:values[1]})}>{role}</button>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  const nav = [
    ["overview", "Overview", Activity],
    ["inventory", "Inventory", Box],
    ["requests", "Requests", Database],
    ["deliveries", "Deliveries", Thermometer],
    ["scan", "QR Tracking", QrCode],
    ["verify", "Blockchain", LinkIcon]
  ];

  return (
    <div className="app-shell">
      <aside>
        <div className="brand"><Droplets /> BloodChain</div>
        <div className="role-pill">{user.role}</div>
        <nav>{nav.map(([key,label,Icon]: any) =>
          <button className={tab===key ? "nav active" : "nav"} key={key} onClick={() => setTab(key)}>
            <Icon size={18}/>{label}
          </button>
        )}</nav>
        <div className="sidebar-bottom">
          <button className="secondary wallet" onClick={async () => {
            try { setWallet(await connectWallet()); setError(""); }
            catch(e) { setError((e as Error).message); }
          }}><Wallet size={17}/>{wallet ? `${wallet.address.slice(0,6)}…${wallet.address.slice(-4)}` : "Connect MetaMask"}</button>
          <button className="nav" onClick={logout}><LogOut size={18}/>Logout</button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h1>{nav.find(n => n[0]===tab)?.[1]}</h1>
            <p className="muted">{user.name} · local development network</p>
          </div>
          <button className="secondary" onClick={refresh}>Refresh</button>
        </header>

        {error && <div className="error">{error}<button onClick={()=>setError("")}>×</button></div>}

        {tab === "overview" && <Overview data={data} deliveries={deliveries} />}
        {tab === "inventory" && <Inventory units={units} onCreate={async () => {
          const group = prompt("Blood group", "O+");
          if (!group) return;
          const now = new Date();
          const expiry = new Date(now.getTime()+30*86400000);
          await api.createUnit({bloodGroup:group, donorReference:"DONOR-DEMO", donatedAt:now.toISOString(), expiresAt:expiry.toISOString()});
          refresh();
        }} />}
        {tab === "requests" && <Requests requests={requests} onCreate={async () => {
          await api.createRequest({bloodGroup:"O+",quantity:1,urgency:"ROUTINE"});
          refresh();
        }} />}
        {tab === "deliveries" && <Deliveries deliveries={deliveries} onSelect={async (id:string) => {
          setSelected(await api.delivery(id));
        }} selected={selected} onStatus={async (id:string,status:string)=>{await api.deliveryStatus(id,status);refresh();setSelected(await api.delivery(id));}} />}
        {tab === "scan" && <Scan onScan={(value:string) => {
          const id = value.includes("/track/") ? value.split("/track/")[1] : value;
          setVerifyId(id); setTab("verify");
        }} />}
        {tab === "verify" && <Verify verifyId={verifyId} setVerifyId={setVerifyId} verification={verification} setVerification={setVerification} />}
      </main>
    </div>
  );
}

function Overview({data,deliveries}:{data:any,deliveries:any[]}) {
  const cards = [
    ["Available units", data?.availableUnits ?? 0, Box],
    ["Pending requests", data?.pendingRequests ?? 0, Database],
    ["Active deliveries", data?.activeDeliveries ?? 0, Thermometer],
    ["Temperature alerts", data?.alerts24h ?? 0, AlertTriangle]
  ];
  return <section>
    <div className="hero">
      <div><span className="eyebrow">END-TO-END TRACEABILITY</span><h2>Blood logistics you can verify.</h2><p>Inventory, delivery state, live environmental monitoring and tamper-evident lifecycle records in one workspace.</p></div>
      <div className="hero-icon"><Droplets size={64}/></div>
    </div>
    <div className="stats">{cards.map(([label,value,Icon]:any)=><div className="stat" key={label}><Icon/><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="panel"><div className="panel-head"><h3>Active deliveries</h3><span>{deliveries.length} records</span></div>
      <table><thead><tr><th>Delivery</th><th>Blood</th><th>Status</th><th>Route</th></tr></thead>
      <tbody>{deliveries.slice(0,8).map(d=><tr key={d.delivery_code}><td><code>{d.delivery_code}</code></td><td>{d.blood_group}</td><td><Status status={d.status}/></td><td>{d.origin} → {d.destination}</td></tr>)}</tbody></table>
    </div>
  </section>
}

function Inventory({units,onCreate}:{units:any[],onCreate:()=>void}) {
  return <section><div className="toolbar"><button className="primary" onClick={onCreate}>+ Register blood unit</button></div>
    <div className="panel"><table><thead><tr><th>Unit</th><th>Group</th><th>Status</th><th>Expires</th><th>Blockchain TX</th></tr></thead>
    <tbody>{units.map(u=><tr key={u.unit_code}><td><code>{u.unit_code}</code></td><td><b>{u.blood_group}</b></td><td><Status status={u.status}/></td><td>{new Date(u.expires_at).toLocaleDateString()}</td><td>{u.blockchain_tx ? <code>{u.blockchain_tx.slice(0,12)}…</code> : "pending"}</td></tr>)}</tbody></table></div>
  </section>
}

function Requests({requests,onCreate}:{requests:any[],onCreate:()=>void}) {
  return <section><div className="toolbar"><button className="primary" onClick={onCreate}>+ Create demo request</button></div>
  <div className="panel"><table><thead><tr><th>Request</th><th>Hospital</th><th>Group</th><th>Qty</th><th>Urgency</th><th>Status</th></tr></thead>
  <tbody>{requests.map(r=><tr key={r.request_code}><td><code>{r.request_code}</code></td><td>{r.hospital_name}</td><td>{r.blood_group}</td><td>{r.quantity}</td><td>{r.urgency}</td><td><Status status={r.status}/></td></tr>)}</tbody></table></div></section>
}

function Deliveries({deliveries,selected,onSelect,onStatus}:{deliveries:any[],selected:any,onSelect:(id:string)=>void,onStatus:(id:string,s:string)=>void}) {
  return <section><div className="two-col"><div className="panel"><div className="panel-head"><h3>Deliveries</h3></div>{deliveries.map(d=><button className="list-row" key={d.delivery_code} onClick={()=>onSelect(d.delivery_code)}><div><b>{d.delivery_code}</b><span>{d.unit_code} · {d.blood_group}</span></div><Status status={d.status}/></button>)}</div>
  {selected ? <div className="panel detail"><div className="panel-head"><h3>{selected.delivery_code}</h3><Status status={selected.status}/></div><p>{selected.origin} → {selected.destination}</p><div className="temp-current"><Thermometer/><strong>{selected.readings?.[0] ? `${selected.readings[0].temperature_c}°C` : "No reading"}</strong><span>{selected.readings?.[0]?.alert ? "ALERT" : "NORMAL"}</span></div>{selected.readings?.length>0&&<TempChart readings={selected.readings}/>}<div className="button-row">{["APPROVED","DISPATCHED","IN_TRANSIT","DELIVERED"].map(s=><button className="secondary" key={s} onClick={()=>onStatus(selected.delivery_code,s)}>{s}</button>)}</div><QRCodeCard value={`${location.origin}/track/${selected.delivery_code}`}/></div> : <div className="empty">Select a delivery to inspect live monitoring.</div>}</div></section>
}

function Scan({onScan}:{onScan:(v:string)=>void}) {
  return <section><div className="panel scan-panel"><h3>Scan blood/delivery QR</h3><p className="muted">Use your camera to resolve a unit or delivery identifier.</p><QRScanner onScan={onScan}/></div></section>
}

function Verify({verifyId,setVerifyId,verification,setVerification}:{verifyId:string,setVerifyId:(v:string)=>void,verification:any,setVerification:(v:any)=>void}) {
  return <section><div className="panel"><div className="verify-form"><input value={verifyId} onChange={e=>setVerifyId(e.target.value)} placeholder="BLD-..." /><button className="primary" onClick={async()=>{try{setVerification(await api.verify(verifyId))}catch(e){setVerification({error:(e as Error).message})}}}>Verify on-chain</button></div>{verification&&<div className="verification">{verification.error?<div className="error">{verification.error}</div>:<><div className="verified"><LinkIcon/> BLOCKCHAIN RECORD FOUND</div><pre>{JSON.stringify(verification,null,2)}</pre></>}</div>}</div></section>
}

function Status({status}:{status:string}) {
  return <span className={`status ${status?.toLowerCase()}`}>{status}</span>
}

export default App;
