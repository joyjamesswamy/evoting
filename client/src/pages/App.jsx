import { useEffect, useState } from "react";
import api from "../api";

export default function App(){
  const [page, setPage] = useState("polls");
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({
    full_name: "", username: "", email: "", password: "", confirmPassword: ""
  });
  const [polls, setPolls] = useState([]);
  const [newPoll, setNewPoll] = useState({ title: "", options: "" });
  const [message, setMessage] = useState("");

  useEffect(()=>{
    loadPolls();
    const token = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (token && u) setUser(JSON.parse(u));
  },[]);

  const loadPolls = async () => {
    const res = await api.get("/api/polls?status=active");
    setPolls(res.data.polls || []);
  };

  const register = async (e) => {
    e.preventDefault();
    const { full_name, username, email, password, confirmPassword } = authForm;
    if (!full_name || !username || !email || !password || !confirmPassword) {
      setMessage("Please fill all fields");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }
    try {
      await api.post("/api/auth/register", { full_name, username, email, password });
      setMessage("Registered! Please login.");
      setPage("login");
    } catch (e) { setMessage(e.response?.data?.error || e.message); }
  };

  // We reuse the same input for "Username or Email": it's authForm.email
  const login = async (e) => {
    e.preventDefault();
    const loginId = authForm.email;
    const { password } = authForm;
    try {
      const res = await api.post("/api/auth/login", { loginId, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setMessage("Logged in!");
      setPage("polls");
    } catch (e) { setMessage(e.response?.data?.error || e.message); }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setMessage("Logged out");
  };

  const createPoll = async (e) => {
    e.preventDefault();
    const options = newPoll.options.split(",").map(s => s.trim()).filter(Boolean);
    try {
      await api.post("/api/polls", { title: newPoll.title, options });
      setMessage("Poll created");
      setNewPoll({ title: "", options: "" });
      await loadPolls();
    } catch (e) { setMessage(e.response?.data?.error || e.message); }
  };

  const vote = async (pollId, option) => {
    try {
      await api.post(`/api/polls/${pollId}/vote`, { option });
      setMessage("Vote recorded");
    } catch (e) {
      setMessage(e.response?.data?.error || e.message);
    }
  };

  const viewResults = async (pollId) => {
    setPage(`results:${pollId}`);
  };

  const Results = ({ pollId }) => {
    const [data, setData] = useState(null);
    useEffect(()=>{
      api.get(`/api/polls/${pollId}/results`).then(res => setData(res.data));
    },[pollId]);
    if(!data) return <div className="mt-3">Loading...</div>;
    return (
      <div className="card p-3 mt-3">
        <h4>{data.poll.title}</h4>
        <table className="table table-bordered mt-3">
          <thead><tr><th>Option</th><th>Votes</th></tr></thead>
          <tbody>
            {data.poll.options.map(o => (
              <tr key={o}><td>{o}</td><td>{data.counts[o] || 0}</td></tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn.secondary" onClick={()=>setPage("polls")}>Back</button>
      </div>
    );
  };

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center">
        <h2>E-Voting & Opinion Polls</h2>
        <div>
          {user ? (
            <>
              <span className="me-3">Hello, {user.full_name || user.name}</span>
              <button className="btn btn-outline-danger btn-sm" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline-primary btn-sm me-2" onClick={()=>setPage("login")}>Login</button>
              <button className="btn btn-primary btn-sm" onClick={()=>setPage("register")}>Register</button>
            </>
          )}
        </div>
      </div>

      {message && <div className="alert alert-info mt-3">{message}</div>}

      {page === "register" && (
        <div className="card p-3 mt-3">
          <h4>Register</h4>
          <form onSubmit={register} className="mt-2">
            <input className="form-control mb-2" placeholder="Full Name" value={authForm.full_name} onChange={e=>setAuthForm({...authForm, full_name:e.target.value})} required/>
            <input className="form-control mb-2" placeholder="Username" value={authForm.username} onChange={e=>setAuthForm({...authForm, username:e.target.value})} required/>
            <input className="form-control mb-2" placeholder="Email" type="email" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} required/>
            <input className="form-control mb-2" placeholder="Password (min 6 chars)" type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} required/>
            <input className="form-control mb-2" placeholder="Confirm Password" type="password" value={authForm.confirmPassword} onChange={e=>setAuthForm({...authForm, confirmPassword:e.target.value})} required/>
            <button className="btn btn-primary">Create account</button>
          </form>
        </div>
      )}

      {page === "login" && (
        <div className="card p-3 mt-3">
          <h4>Login</h4>
          <form onSubmit={login} className="mt-2">
            <input className="form-control mb-2" placeholder="Username or Email" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} required/>
            <input className="form-control mb-2" placeholder="Password" type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} required/>
            <button className="btn btn-primary">Login</button>
          </form>
        </div>
      )}

      {page === "polls" && (
        <div className="row mt-3">
          <div className="col-lg-6">
            <div className="card p-3">
              <h5>Active Polls</h5>
              {!polls.length && <div>No active polls</div>}
              {polls.map(p => (
                <div className="border rounded p-2 my-2" key={p._id}>
                  <div className="fw-bold">{p.title}</div>
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    {p.options.map(o => (
                      <button key={o} className="btn btn-outline-primary btn-sm" onClick={()=>vote(p._id, o)}>{o}</button>
                    ))}
                    <button className="btn btn-secondary btn-sm ms-auto" onClick={()=>viewResults(p._id)}>View Results</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card p-3">
              <h5>Create a Poll</h5>
              {!user && <div className="text-muted">Login to create a poll.</div>}
              {user && (
                <form onSubmit={createPoll} className="mt-2">
                  <input className="form-control mb-2" placeholder="Poll title" value={newPoll.title} onChange={e=>setNewPoll({...newPoll, title:e.target.value})}/>
                  <input className="form-control mb-2" placeholder="Options (comma-separated)" value={newPoll.options} onChange={e=>setNewPoll({...newPoll, options:e.target.value})}/>
                  <button className="btn btn-primary">Create</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {page.startsWith("results:") && <Results pollId={page.split(":")[1]} />}
    </div>
  );
}
